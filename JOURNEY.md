# Macro Event Lab: build journal

This is the record of what went wrong while building Macro Event Lab, how each problem was found, what caused it, how it was fixed and how the fix was tested. It covers the data pipeline (Kalshi, ALFRED, FRED, the Fed calendar), the statistics, and the React website, from 26 to 29 October 2026.

Every entry follows the same loop:

**Symptom** what was seen. **Diagnosis** the real cause. **Fix** the change. **Test** how it stays fixed. **Lesson** what to carry forward.

All numbers come from the real data or the commit history. Nothing here is illustrative.

## Contents

1. [Ingestion](#1-ingestion)
2. [Point in time](#2-point-in-time)
3. [Data quality](#3-data-quality)
4. [From prices to probabilities](#4-from-prices-to-probabilities)
5. [Matching each market to its outcome](#5-matching-each-market-to-its-outcome)
6. [Release-day reactions](#6-release-day-reactions)
7. [Security](#7-security)
8. [Data licensing](#8-data-licensing)
9. [Inference and scoring](#9-inference-and-scoring)
10. [Website](#10-website)
11. [Repository hygiene](#11-repository-hygiene)
12. [Lessons in one page](#12-lessons-in-one-page)
13. [Interview stories](#13-interview-stories)

## 1. Ingestion

### 1.1 A Windows restart killed a long download

- **Symptom:** the overnight Kalshi download stopped after 20 minutes and 4,743 responses, partway through the CPI series.
- **Diagnosis:** the code was fine. Windows restarted at 4:40 in the morning for an update. A full run needs about 25,500 requests, so starting over after every interruption would never finish.
- **Fix:** the download became resumable. The raw store is content addressed, so before each request the ingester checks whether that candle window is already stored. A window is skipped only if its last period had already closed when it was fetched, because that data can no longer change. Windows that were still open are fetched again.
- **Test:** two unit tests cover the skip rule. The real rerun skipped 4,710 stored windows.
- **Result:** the full run finished with 1,859 markets, 25,523 candle requests and about 1 hour 47 minutes of actual downloading, even though the laptop slept for hours in between.
- **Lesson:** any job longer than a few minutes must be resumable. Design for interruption, not for the happy path.

### 1.2 Threads would not have made it faster

- **Symptom:** the download looked slow, and the obvious idea was to add threads.
- **Diagnosis:** the bottleneck was Kalshi's rate limit of 5 requests per second, and the client already reached about 4 per second. More threads would only produce more rate limit errors.
- **Fix:** none. A rate-limited client with retries stayed single threaded.
- **Lesson:** measure where the bottleneck is before adding concurrency.

### 1.3 Unsettled markets sent empty strings, and empty columns lost their type

- **Symptom:** the first live run produced silver tables with columns of type `Null`, and unsettled markets had `""` as their result.
- **Diagnosis:** Kalshi sends `result=""` and `expiration_value=""` for markets that have not settled. Separately, when every value in a column was missing in one build (for example `cap_strike` for series that only have "greater than" markets), Polars wrote the column as type `Null`, so its schema changed from build to build.
- **Fix:** empty strings are parsed as null, and every silver table is written with a fixed schema.
- **Test:** a test for each bug, confirmed to fail before the fix and pass after.
- **Lesson:** never let a type be inferred from one batch of data. Pin schemas at the boundary.

### 1.4 Live and historical endpoints use different field names

- **Diagnosis:** live candles use `close_dollars`, `volume_fp`, `open_interest_fp`; historical candles use `close`, `volume`, `open_interest`. Historical data has a cutoff date that moves.
- **Fix:** one parser maps both shapes into the same silver columns, checked against a real call to each endpoint.
- **Lesson:** read real responses before trusting documentation.

## 2. Point in time

The core rule of the project: every number must be shown as it was known at that moment, never with hindsight.

### 2.1 Revisions would leak into the past

- **Symptom:** FRED's normal API returns today's revised numbers. August 2025 CPI was first published as 323.364 and revised to 323.291 the next February.
- **Fix:** macro data comes from ALFRED, which keeps every vintage. Each row gets `known_from`: the official release moment (08:30 New York for BLS and BEA, 14:00 for the Fed) when the vintage date is a release date, otherwise the end of that New York day, so the pipeline can never know something earlier than the public did.
- **Test:** `as_of` is written with DuckDB `ASOF JOIN`. A Hypothesis property test runs 200 random cases against a brute-force answer. To prove the test works, a one-hour look-ahead bug was planted on purpose, and the test caught it immediately.
- **Lesson:** a test you have never seen fail is not yet a test.

### 2.2 Time zones on Windows

- **Symptom:** `zoneinfo` failed on Windows.
- **Diagnosis:** Windows has no IANA time zone database.
- **Fix:** add `tzdata` as a dependency. All release times go through the New York zone, so daylight saving changes are handled.
- **Lesson:** CI on Linux and development on Windows catch different bugs. Both matter.

### 2.3 Moved release dates stayed behind

- **Symptom:** the 2025 government shutdown pushed September CPI from 15 October to 24 October. An old download still had the original date.
- **Fix:** when building the release calendar, only the newest download of each calendar is used.
- **Test:** a dedicated test for a moved date.

### 2.4 Snapshots built from stale prices

- **Symptom:** far future events (2027 FOMC meetings) had hourly snapshots built from prices weeks old.
- **Fix:** no snapshot is created after the last available price.
- **Lesson:** an as-of join answers "what was the latest value", not "was it still fresh". Check age separately.

## 3. Data quality

### 3.1 A check that fails loudly

- **Built:** a `check` command where every rule is one SQL query returning one row per problem. An empty result is a pass. Errors (duplicates, bid above ask, prices outside 0 to 1) exit with code 1. Warnings report known gaps. Tables not built yet are skipped instead of crashing.
- **Lesson:** a quality check should point at the exact bad rows, not just say "failed".

### 3.2 Five crossed candles out of 1.9 million

- **Symptom:** on the first full build, `check` failed: 5 candles where the bid was above the ask.
- **Diagnosis:** all 5 belonged to one market, `FED-22DEC-T4.50`, over 14 to 15 November 2022. The bid sat frozen at 0.22 while the ask fell to 0.21 and 0.19, and real trades printed at 0.21 and 0.19, below the bid. In a live order book that cannot happen. The archived bid was stale.
- **Fix:** bid above ask stays an error, but a registry of known anomalies (check, ticker, time window, written reason) marks those rows as excused. Any crossed row outside a registered window still fails. Later, the price rule never uses a mid from a crossed book.
- **Test:** tests for an excused row, an unexcused row, and rows just outside the window.
- **Lesson:** do not loosen a rule to make one case pass. Document the exception narrowly and keep the rule strict.

### 3.3 The October 2025 hole

- **Symptom:** a missing month warning for October 2025 in CPI, core CPI, shelter and the unemployment rate, but not payrolls.
- **Diagnosis:** BLS never published those numbers because of the shutdown. Payrolls come from a different survey (establishments, not households), so they exist.
- **Fix:** the gap is reported as a warning and treated as "no outcome", never filled.
- **Lesson:** a gap can be the true state of the world. Know the domain before "fixing" data.

### 3.4 240 markets had no strike

- **Symptom:** 240 older markets (`CPI-`, `FED-`, `GDP-` and two early 2025 events) had no strike fields.
- **Diagnosis:** the threshold only lives in the ticker, in three forms: `T0.4`, `T-100000` and `TN0.1`, where `N` means negative.
- **Fix:** `strike_from_ticker` parses it and keeps it only when the market title states the same number. Anything unrecognised stays null instead of being guessed. A new column records whether each strike came from the API or the ticker.
- **Test:** a new error check: every settled "greater than" market must have resolved yes exactly when the published value is above its strike. On the real data all 240 parsed strikes and all 1,234 API strikes agree. The first run flagged one market, `KXFED-26JAN-T3.50`, and the cause was a settlement stored as text ("Above 3.50%"), not a wrong strike.
- **Lesson:** when you infer a field, verify it against an independent source in the same data.

## 4. From prices to probabilities

### 4.1 Choosing one price per hour

- **Rule:** the bid/ask mid when the book is not crossed and the spread is at most 10 cents, else the last trade, else nothing. In the final week, 96 to 99.7% of candles get a mid.

### 4.2 Raw prices are not a valid distribution

- **Symptom:** the probability of "above k" should fall as k rises, but raw prices sometimes went up, which would give negative bin probabilities.
- **Fix:** isotonic regression (pool adjacent violators) forces the curve to be non increasing. Bin probabilities are differences of that curve, so they sum to 1 by construction, with no renormalisation step.
- **Test:** Hypothesis property tests: the fit is always non increasing and keeps the mean; bins are never negative and always sum to 1. On the real data the largest sum error is 2.2e-16 and only 6.3% of prices are adjusted.

### 4.3 One bad price dragged its neighbours

- **Symptom:** a single price of 0.51 on "payrolls above minus 100k" pulled the correct prices next to it down to about 0.79.
- **Diagnosis:** plain isotonic regression trusts every price equally.
- **Fix:** weight each price by the inverse of its spread (a 1 cent book weighs 100, a 10 cent book 10), cap trades at the weight of a 10 cent book, and pool with weighted means.
- **Test:** a test with the bad price: unweighted pulls the group to 0.83, weighted keeps the good prices above 0.96. On the real data, against actual settlements on the 16,217 adjusted prices, the Brier score drops from 0.01858 (raw) to 0.01797 (unweighted, 3.3% better) to 0.01763 (weighted, 5.1% better).
- **Lesson:** compare a modelling choice against ground truth on real data before keeping it.

### 4.4 The midpoint of a bin is the wrong centre

- **Symptom:** a bin like "CPI between 0.3% and 0.4%" is normally centred at 0.35.
- **Diagnosis:** CPI is published rounded to one decimal, so that bin can only ever contain the published value 0.4. Using midpoints biases every mean down by half a step (0.05 points), and that bias goes straight into the surprise.
- **Fix:** each series has a publication resolution measured from settled values (CPI and GDP 0.1, Fed 0.25, payrolls 1,000). A bin (a, b] spreads its probability over (a + r/2, b + r/2].
- **Test:** at T-1h, published CPI lands inside the market's 50% range 55% of the time and the 90% range 88% of the time, with a mean error of minus 0.0017. Midpoints would have given about minus 0.05.
- **Lesson:** small rounding conventions can become systematic bias. Think about what values are physically possible.

## 5. Matching each market to its outcome

### 5.1 Release windows matched the wrong month

- **Symptom:** the first approach matched each event to the first release within 14 days of the market close. For `KXPAYROLLS-25OCT` it silently matched September's number.
- **Diagnosis:** the shutdown delayed releases by weeks (September 2025 payrolls by 48 days, Q3 2025 GDP by 54 days), so "the next release" was the wrong one.
- **Fix:** read the reference period from the ticker (month for CPI and payrolls; for GDP the quarter-end date on old tickers, or the quarter before the release date on new ones, plus one odd form `GDP-232022 Q4`). The 14 day window stays only as a fallback, and a column records which method matched.
- **Test:** 13 tests, including 12 real ticker shapes and a release delayed 48 days. Every CPI, GDP and payrolls event now matches by period.
- **Result:** ALFRED's first print equals Kalshi's settlement for 124 of 125 events. The one exception, Q3 2025 GDP (4.3 in ALFRED, settled at 3.8), is documented and the official number is used.
- **Lesson:** match on identity (which period), not on proximity (which date is close).

### 5.2 First prints must use the vintage of their own release day

- **Fix:** converting index levels into the unit Kalshi settles on (CPI month over month, jobs added, GDP annualised) uses both levels as published that same day, so a same-day revision of the prior month is included, exactly as the agency reported it.

### 5.3 FOMC settlements stored as text

- **Symptom:** three 2026 FOMC meetings had no outcome and no surprise.
- **Diagnosis:** Kalshi stored their settlement as "Above 3.50%" or "Yes" instead of a number.
- **Fix:** `settled_from_results` brackets the outcome between the highest strike that resolved yes and the lowest that resolved no. One step apart gives a single value; anything wider stays unknown. A numeric settlement always wins.
- **Result:** January, March and June 2026 now read 3.75%, matching April.

### 5.4 Early markets had a single contract

- **Symptom:** the page for July 2021 CPI showed "No estimate", "N/A" and "No surprise". It looked broken.
- **Diagnosis:** not a calculation bug. From 2021 to early 2022, Kalshi listed one contract per release ("will CPI be above 0.7%?"). One price gives one probability, not a distribution, so there is no median and no surprise to measure. Ten events are like this, and those markets also closed at 19:00 New York time the evening before the release.
- **Fix:** the manifest records how many contracts each event had. Those pages now show the contract's odds as the headline figure, a short explanation banner, a plain words reading ("traders put that at 37%; the contract paid no and the market had leaned the right way"), odds lines over time instead of an empty median chart, and a note saying when trading closed.
- **Test:** unit tests for the contract count, the plain words branch and the day count between close and release.
- **Lesson:** "missing" output needs an explanation in the interface, not just a dash. Users read a blank as a bug.

### 5.5 FOMC decision dates were the close dates

- **Symptom:** while checking 5.4, the July 2021 FOMC page said "Decided Jul 26 2021". The meeting decided on 28 July.
- **Diagnosis:** FOMC events used the New York date of the market close as the decision day. Modern markets close minutes before the 14:00 statement, so that worked, but early markets closed one or two days earlier. The release-day yield reaction was therefore measured on the wrong day too.
- **Fix:** each FOMC event takes the statement date of the first scheduled meeting within 7 days after its close, from the Fed calendar seed file. The reaction day uses that date.
- **Test:** a test with a market closing two days before its meeting, one closing on the day, and one with no meeting nearby (stays empty). On the real data the first four meetings now read 28 July, 22 September, 15 December 2021 and 26 January 2022.
- **Lesson:** an assumption that is true for recent data ("the close is the event") can be false for older data. Check the oldest rows, not just the newest.

## 6. Release-day reactions

### 6.1 ALFRED refuses full vintage history for daily series

- **Symptom:** requesting every vintage of the 2 and 10 year Treasury yields returned HTTP 400.
- **Fix:** daily yields come from FRED's current values instead. Treasury closes are not revised in practice, so each close is treated as known at the end of its New York day. The rows go into the same table, so every point-in-time join works unchanged.

### 6.2 An unpublished month borrowed another month's reaction

- **Symptom:** October 2025 CPI, which was never published, showed a yield reaction.
- **Diagnosis:** ALFRED lists the empty October row on the date November was released, so the event picked up November's release day.
- **Fix:** an event gets a reaction day only if it actually has a first print.
- **Test:** a test for exactly this case, confirmed to fail before the fix.

### 6.3 Holidays

- **Fix:** the change is measured from the last trading close before the release day. If the release day itself is a bond market holiday, there is no reaction.
- **Test:** a test with a Friday holiday and a release on a closed day.

## 7. Security

### 7.1 An API key appeared in an error message

- **Symptom:** when FRED returned an error, the exception printed by the HTTP library contained the full request URL, including the API key in the query string.
- **Diagnosis:** the key never reached git, data files or logs, but it was displayed in a terminal session. Policy: once displayed, treat it as exposed.
- **Fix:** every HTTP error now names the path, the parameters with the key masked, and the server's message. Never the full URL. The key was rotated the same day and the new one verified without printing it.
- **Test:** `test_http.py` asserts the key never appears in any error message.
- **Lesson:** secrets leak through error messages and stack traces, not only through code. Redact at the place errors are created.

### 7.2 Keeping data out of the public repo

- **Rules:** `.env` and `data/` are ignored, the website's copied data folder is ignored, and files are staged by explicit path, never with "add all".

## 8. Data licensing

### 8.1 Kalshi data cannot be published without permission

- **Finding:** before deploying, the Kalshi Developer Agreement and Data Terms of Use were read in full. Publicly displaying Kalshi data or works derived from it (implied distributions, charts, surprises) requires prior written permission.
- **Action:** deployment was paused. A permission request was emailed. Kalshi's institutional support replied offering a one-time, limited, no-cost exception for non-commercial research and asked for a request form, which was submitted. The site stays local until the answer arrives.
- **Lesson:** licensing is part of engineering. Check terms before you build the thing you want to publish, not after.

### 8.2 Choosing a source for sector returns

- **Problem:** the release-day block was meant to show sector ETF returns.
- **Research:** Tiingo's free plan is internal use only, Alpha Vantage's licence is personal and non-commercial, Stooq forbids redistribution, and Market Data's display rights start with a commercial plan listed at $333 a quarter.
- **Decision:** use the Kenneth French Data Library's daily industry portfolios instead. They are free, standard in academic finance and go back decades. They lag by a month or two and use industry names instead of ETF tickers. Permission to show derived numbers was requested by email, and the returns stay local until a reply.
- **Lesson:** "free to download" is not "free to publish". The best source can also be the most credible one.

## 9. Inference and scoring

### 9.1 What the data says

These are the cross-event results, computed at one hour before each release:

| Series | Events | Real number inside the market's 90% range | inside the 50% range | 2-year yield per 1 SD of surprise |
| --- | --- | --- | --- | --- |
| CPI | 58 | 88% | 53% | 6.1 bp (correlation 0.55) |
| Jobs | 43 | 86% | 40% | 4.5 bp (correlation 0.48) |
| GDP | 19 | 79% | 42% | 0.3 bp (correlation 0.04): barely moves yields |
| FOMC | 37 | 100% | 97% | not meaningful: the average surprise is only 0.08 SD, so the decision was priced in ahead |

CPI markets are well calibrated (ideal: 90% and 50%). Jobs and GDP markets are a little overconfident: their ranges are too narrow. CPI surprises average minus 0.01 SD with a spread of 0.98 across 58 events, close to the ideal 0 and 1.

### 9.2 Weak relationships are not reported as typical

- **Problem:** a regression slope always exists, even when it means nothing. FOMC surprises are so small that the fitted slope comes out near minus 13 bp per SD with a correlation of only minus 0.2.
- **Fix:** the plain words text only quotes a "typical move" when the correlation is at least 0.3; otherwise it says the release barely moves yields.
- **Lesson:** an honest interface knows when to say "no clear effect".

### 9.3 Scoring the forecasts

- **Built:** for every event, the Brier score of each contract, the exact CRPS of the piecewise uniform distribution, the PIT value, and the absolute error of the market median against a naive forecast (repeat the previous number).
- **Test:** CRPS is checked against the closed form for a uniform distribution (1/12) and against numerical integration; PIT and Brier have their own tests.
- **Results:** the market median beats the naive forecast by 67% for CPI (typical miss 0.08 points against 0.25), 30% for jobs, 70% for GDP and 96% for FOMC. For FOMC, the real number never landed in the outer tenths of the market's odds (0% against an ideal 20%), so its ranges were wider than needed.

### 9.4 Writing explanations from numbers

- **Built:** every event page opens with an "In plain words" paragraph generated from the event's own numbers and how it compares with its series, for readers without an economics background. A glossary page defines 26 terms, and terms on the page show short hints.
- **Test:** each generator is a pure function with unit tests on real shaped inputs.

### 9.5 Reviewing the GDP nowcast

- **Symptom:** bootstrap coefficients varied partly because every resample defined a different feature SD. The market comparator also used the mean despite the intended median comparison.
- **Fix:** express each bootstrap coefficient in original-sample SD units, stop blocks at missing quarters, and compare with the T-1h market median. State the difference in information cutoffs explicitly.
- **Timing:** inner penalty selection checks each validation cutoff against label release dates. The naive prior-quarter forecast is empty when that print was not yet public.
- **Test:** a noiseless linear example catches changing coefficient units; isolated quarters catch blocks crossing gaps; delayed publication tests guard the inner split and naive baseline; a deliberately different mean and median catches the comparator error.
- **Limit:** coefficient intervals condition on the selected penalty and excluded quarters. They are not causal estimates.

### 9.6 A descriptive calibration model before predictive claims

- **Built:** fixed-prior MAP calibration with shared bias and confidence plus series deviations. Every event has total weight one across contracts and horizons.
- **Test:** IRLS agrees with gradient descent under the market-centred prior and with an independent logistic regression implementation under the equivalent zero-centred prior. Duplicating all rows leaves the fit unchanged, and collinear designs remain finite under the prior.
- **Evaluation:** whole-event walk-forward fits before each event's earliest snapshot. All training labels must have settled strictly before that cutoff. Missing settlement times use a recorded fetch-time upper bound. Raw quotes remain separate from isotonic probabilities for score comparisons.
- **Test:** future-data perturbations, held-out label flips, incomplete event labels and exact-cutoff timestamps guard temporal splitting. Score tests verify equal event weighting, pairing, reproducibility and finite log loss at extreme probabilities.
- **Attribution:** scores compare raw prices, isotonic and isotonic plus MAP on identical rows. Shared event bootstrap draws separate the isotonic improvement from MAP's incremental contribution. Tests check additive mean differences and a case where isotonic helps but MAP hurts.
- **Multiplicity:** nominal Bonferroni intervals cover the fixed family of series, horizons, metrics, method comparisons and prior scales. Sensitivity fits keep the same event splits and report every prior scale without selecting a winner. Tests verify adjusted quantiles, interval nesting, shrinkage, equal samples and leakage protection across scales.
- **Limit:** posterior uncertainty remains separate work. Simultaneous percentile intervals are approximate, with small event samples and limited simulation draws in the extreme tails. Prior sensitivity varies common shrinkage strength only.

### 9.7 Sampling hierarchical calibration without overstating uncertainty

- **Built:** a noncentred hierarchical model learns separate pooling scales for bias and confidence. A fixed-scale version has the same weighted log density as the NumPy MAP objective, checked through density differences and gradients at the optimum.
- **Dependence:** contracts and horizons within an event share an outcome. An event-weighted Bernoulli potential defines a generalized posterior; its intervals depend on that choice and do not prove that within-event dependence has been modelled.
- **Validation:** four NUTS chains are gated on R-hat, bulk and tail ESS, and divergences. Failed diagnostics mark local outputs unvalidated and exit with an error. Draws are retained alongside the summaries for inspection.
- **Sampling:** a divergence triggered the gate during a real run. The sampling settings use longer warmup and target acceptance 0.99; a run still has to pass the gate, regardless of those settings.
- **Predictive checks:** explicit Bernoulli simulations check marginal event-weighted rates only. They are not coherent joint simulations across strikes and cannot establish event-level predictive adequacy.
- **Lesson:** matching a posterior median to a MAP from a different prior is not a sound correctness test. Validate the shared objective first, then assess posterior geometry and model assumptions separately.

### 9.8 Giving each event one outcome

- **Problem:** weighted Bernoulli factors limit the influence of dense events but do not define the dependence between their contracts. Independent predictive draws can say no at a low strike and yes at a higher strike.
- **Fix:** a separate T-1h model observes one categorical settlement interval per event. Positive confidence preserves survival order, and adjacent survival differences define the category probabilities. Every predictive draw selects one category and derives all contract labels from it.
- **Support:** isotonic plateaus can give an observed category zero probability. A documented fixed uniform contamination mixture supplies support instead of dropping events based on their outcomes. Its sensitivity remains open.
- **Test:** NumPy and PyMC categorical likelihoods agree with ragged strike grids and tails; contradictory labels fail validation; simulated contract labels are monotone and recover the same category. Generalized-posterior outputs are preserved separately.
- **Limit:** the likelihood assumes conditional independence across events and uses only T-1h. Its log-confidence prior differs from the older MAP, and it still needs temporal evaluation and support-mixture sensitivity.

## 10. Website

### 10.1 A prototype that worked but did not look good

- **Diagnosis of the first draft:** 43 solid borders (everything boxed, so nothing stood out), weak hierarchy, draft labels left in the interface, neon blue on near black, and SVG text that shrank to about 7.5px because the chart was scaled down.
- **Fix:** hierarchy through whitespace and type size instead of boxes, fixed SVG sizing so labels render at 12px, every colour checked for WCAG contrast.
- **Lesson:** "it works" and "it is good" are different reviews. Be specific about why something looks off.

### 10.2 The method page described a pipeline that did not exist

- **Symptom:** the first method page mentioned renormalising negative bins, wrong ticker names, and T-1h as 07:30 ET.
- **Fix:** every paragraph was rewritten to match the code (the close is truncated to the hour, so T-1h before an 08:30 release is 07:00 ET; bins sum to 1 by construction, with no renormalisation).
- **Lesson:** documentation drifts from code. Review it against the code, line by line.

### 10.3 A data folder rule hid source code

- **Symptom:** `web/src/data` was not tracked by git.
- **Diagnosis:** the ignore rule `data/` matches any folder named data at any depth.
- **Fix:** anchor it to the root: `/data/`.

### 10.4 Dark scrollbars in light mode

- **Symptom:** with the operating system in dark mode and the site set to Light, scrollbars were dark.
- **Fix:** the page declares its active colour scheme, so the browser draws matching scrollbars.

### 10.5 Hover hints widened the page

- **Symptom:** horizontal scrolling on phones.
- **Diagnosis:** hidden glossary hint boxes still took layout space beyond the screen edge.
- **Fix:** hints are created only while shown, and the page clips horizontal overflow.
- **Test:** layout measured at 12 widths from 280px (folded phone cover screen) to 1920px. No page scrolls sideways, and no chart labels overlap. Label collisions found during that sweep ("T-1d" over "Close", rotated strike labels touching the axis) were fixed.

### 10.6 Animations that never finish

- **Symptom:** in a hidden browser tab, charts had zero width and count-up numbers stayed at 0.
- **Diagnosis:** browsers pause animation frames and resize observers in background tabs.
- **Fix:** charts measure their width before the first paint, and every animation has a timer fallback that lands on the final value. Screen readers get the final value immediately, and reduced motion settings turn animations off.
- **Lesson:** animation is progressive enhancement. The final state must be correct without it.

### 10.7 Designed controls instead of browser defaults

- **Built:** a custom listbox for the dropdowns (arrow keys, Home and End, type-ahead, Escape, focus returns to the button) and a custom range slider, because native popups looked different on every platform. Buttons and menus are not text-selectable, while reading text stays selectable.

### 10.8 Layouts for unusual screens

- **Built:** folded phone cover screens (280px) move the menu to its own row, short landscape screens unpin the time bar, and windows spanned across two screens put the event list on one side of the hinge and the event on the other.

## 11. Repository hygiene

- **CSS comments:** `//` is not a comment in CSS. The browser treats it as invalid and drops the next rule. CSS uses `/* one sentence */`.
- **Line endings:** files rewritten by a script on Windows came out with CRLF and were normalised back to LF before committing.
- **Commits:** files are staged by explicit path. Before every commit the staged file names, content and message are scanned. Once, the name of an AI tool used for a design draft reached file names and commit messages; the files were renamed, the history was rewritten and force pushed with lease, and the scan became a habit.
- **CI:** two jobs (pipeline: ruff and pytest; web: typecheck, tests and build). Actions were upgraded to the Node 24 versions after GitHub deprecated Node 20, checking each release's breaking changes first.
- **Determinism:** the web export writes no build time and rounds floats, so unchanged data rebuilds to identical bytes and diffs stay meaningful.

## 12. Lessons in one page

1. **Design for interruption.** Long jobs must resume from where they stopped.
2. **Pin schemas at the boundary.** Never infer types from one batch.
3. **Point in time is a test, not a promise.** Plant the bug once to prove the test catches it.
4. **Match on identity, not proximity.** A reference period beats "the next release date".
5. **Check the oldest data, not just the newest.** Old markets broke assumptions that new ones satisfy.
6. **Keep rules strict and exceptions narrow.** A registry of known anomalies with reasons beats a looser rule.
7. **Validate modelling choices against ground truth.** Weighted isotonic regression earned its place with a lower Brier score.
8. **Rounding is a modelling decision.** Bin centres follow what can actually be published.
9. **Redact secrets where errors are created.** Rotate on any exposure.
10. **Read the licence before you build the thing you will publish.**
11. **Explain empty states.** A blank looks like a bug.
12. **Animation must never be required for correctness.**
13. **Documentation drifts.** Review it against code.
14. **Measure before optimising.** The rate limit, not the thread count, set the speed.

## 13. Interview stories

Short versions for "tell me about a bug you found" or "a time data surprised you".

**The stale bid.** On the first full build, my quality check failed on 5 of 1.9 million candles where the bid was above the ask. Instead of deleting them, I looked: one 2022 Fed market, a bid frozen at 0.22 while trades printed below it. That is a stale archive, not a crossed market. I kept the rule as an error, added a narrow registry of documented exceptions, and made sure prices never come from a crossed book.

**The shutdown.** Matching each market to "the next release" silently gave October 2025 payrolls the September number, because the shutdown delayed releases by up to 54 days. I switched to reading the reference period from the ticker, kept the date window only as a fallback, and recorded which method matched each event. The official number now agrees with Kalshi's settlement in 124 of 125 events, and the one exception is documented.

**Half a step of bias.** Centring bins on their midpoint would have biased every CPI expectation down by 0.05 points, because CPI is published to one decimal. Centring on publishable values brought the mean error to minus 0.0017 and calibration to 55% and 88% for the 50% and 90% ranges.

**The planted bug.** To prove my point-in-time query could not see the future, I wrote a property test against a brute-force answer, then deliberately introduced a one-hour look-ahead. The test failed at once, so I trust it.

**The early markets.** A user asked why a 2021 CPI page looked broken. The cause was not a bug: those markets had one contract, so no distribution exists. While fixing the page to explain that, I noticed the 2021 Fed pages had the wrong decision dates, because early markets closed two days before the meeting. I matched them to the Fed calendar, which also corrected their yield reactions.

**The leaked key.** An HTTP library put the full URL, key included, into an exception message. I rotated the key, changed every error to show only the path and masked parameters, and added a test that the key can never appear in an error.
