# Macro Event Lab: build journal

This is the working record of Macro Event Lab: discussions, product decisions, research findings, bugs, fixes, checks and unresolved questions. It covers the data pipeline (Kalshi, ALFRED, FRED, the Fed calendar), the statistics and the React website. The record begins on 26 October 2026 and continues as work proceeds.

The technical entries follow this loop:

**Symptom** what was seen. **Diagnosis** the real cause. **Fix** the change. **Test** how it stays fixed. **Lesson** what to carry forward.

The dated working log also records the question being discussed, alternatives, the decision, its status and the evidence available. A proposal is not an implemented feature, and passing tests are not evidence that readers find the site interesting. Earlier discussions are reconstructed from the conversation and existing project records, rather than presented as a verbatim transcript.

All numbers come from the real data, test output or commit history. Nothing here is illustrative. Restricted research outputs stay local, and secrets and raw API responses are never included in this journal.

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
14. [Working conversation and decision log](#14-working-conversation-and-decision-log)

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

## 14. Working conversation and decision log

Dates use America/Chicago. The entries below consolidate the discussions and work leading to the product review on 29 October 2026. They preserve decisions and rejected directions without treating every earlier message as a separately timestamped event.

### 14.1 How to maintain this record

**Status: DECIDED, 29 October 2026.**

An asked for a record of what we discuss, discover, build and debug, so a later report can explain the reasoning as well as the result. Keep the technical sections above and append dated working entries here. Each entry should contain the request or question, the options considered, the decision and reason, the work actually performed, the checks and the open work. Record corrections instead of quietly turning an abandoned proposal into an achievement.

Use these status words consistently:

- **PROPOSED:** discussed but not approved or implemented.
- **DECIDED:** the direction has been accepted; implementation may still be pending.
- **IMPLEMENTED:** the change exists in the working tree or a named commit.
- **VERIFIED:** a named check passed for the state being described.
- **OPEN:** a question or requirement still needs work.
- **DEFERRED:** intentionally outside the immediate priority.
- **SUPERSEDED:** a previous direction has been replaced, with its reason preserved.

For a bug, record the observed failure, cause, fix and regression check. For a research finding, distinguish descriptive results from held-out evaluation and keep the data scope, cutoff and limitations. For an interface decision, distinguish an engineering check from An's reading feedback. Never invent a measurement, a quotation or a missing part of the conversation.

ROADMAP records what should happen next. This journal records what happened and why. README describes the current product and how to run it. These documents should agree about the product without pretending that pending work is complete.

### 14.2 Reviewing the research before adding more models

**Status: IMPLEMENTED and VERIFIED in commits `9172de8` and `663da3a`.**

The handoff described the GDP nowcast as unfinished, but the repository already contained its initial implementation in `62fcef4`. The first task was therefore to inspect and strengthen the existing work, rather than create another version from the brief alone. The technical details are in sections 9.5 through 9.8.

The review found several ways apparently reasonable evaluation could gain hindsight or change meaning. Inner validation needed to respect when training labels became available. The naive forecast needed the previous GDP print available at that cutoff. Bootstrap coefficients needed a common original feature scale, and resampled blocks could not cross missing quarters. A comparison with the market needed to identify both the statistic being compared and the difference in forecast times. These became implementation changes and regression tests.

Calibration then grew from a fixed-prior MAP model into two explicitly different Bayesian formulations. The event-weighted binary model is a generalized posterior, not a joint model of dependent contracts. The categorical model gives an event one shared outcome at T-1h and derives its contract outcomes together. Its support mixture is an explicit modelling assumption. Neither implementation alone proves better future forecasts.

The evaluation keeps whole events together and checks label availability before each training cutoff. Raw prices, isotonic prices and MAP predictions are compared on paired observations, with event bootstrap uncertainty and prior sensitivity. Multiple-comparison correction matters when interpreting an apparent improvement. The detailed numerical outputs remain local. This log does not claim a robust predictive advantage merely because a model was fitted successfully.

Sampling checks also changed the completion criterion. A fit must pass the convergence and divergence gate; returning samples is insufficient. Comparing posterior medians with a MAP fit using another prior or likelihood would test the wrong claim. Matching objectives and gradients at fixed scales is a valid implementation check, while predictive evaluation is a separate task.

Both named commits were pushed and their CI runs passed. Bayesian walk-forward evaluation, support-mixture sensitivity and hyperprior sensitivity remain open. The later decision to prioritize the reading experience does not erase these research limitations.

### 14.3 Test failures caused by the local environment

**Status: RESOLVED locally.**

A pipeline baseline initially failed because the default temporary directory was not usable in the current environment. An attempt to use a project-local temporary directory also needed its parent directory to exist. Creating the ignored local test directory allowed the tests to run. This was an execution-environment problem, not evidence of a defect in the pipeline's scientific logic.

Other checks caught implementation and test issues during the website work. A mocked fetch without an explicit input type caused TypeScript tuple inference errors when the test inspected its arguments. Giving the mock the proper request type fixed the build. A new Python export test also needed a long line wrapped to satisfy ruff. Numerical equivalence checks needed floating-point tolerances rather than exact equality for round-off differences.

The lesson is to record the failing check and its cause before changing product code. An environment failure, a test typing error and a statistical defect require different fixes.

### 14.4 The website had pages but no clear first read

**Status: DECIDED; navigation and page scaffolding IMPLEMENTED locally.**

An found the site cluttered: seven peer pages competed in the menu, and the initial destination was the dense Events explorer. The request was to create an Overview, simplify navigation, preserve existing event links and add an ALFRED-only GDP Models page. The web baseline passed its tests and production build before this work, and the existing development server at localhost:8000 was reused.

Overview became the default route. An explicit `?page=events` still opens Events, and an existing `?event=...&h=...` link still opens the selected event rather than being redirected to the new home page. The Events links in the story path now use the explicit page route. URL tests cover the route distinction.

The initial menu proposal put About inside Learn. An challenged this because a new visitor should be able to find the project's purpose and author directly. The accepted arrangement keeps Overview, Events, Compare, Scorecard, Revisions and About visible. Learn holds supporting pages, including Models, Method and Glossary. The footer retains every page.

The local implementation reuses the designed Select/listbox pattern for Learn. One subtle state issue was that a page outside the dropdown could appear to select an unrelated option. An unmatched selection now stays unmatched, while opening the list gives keyboard navigation a valid starting point. Interaction tests cover the menu and focus behavior. About and Overview have different jobs: Overview invites exploration; About explains the author, motivation and project choices.

### 14.5 Why the first Overview still felt dull

**Status: OPEN, based on An's reading feedback.**

The first Overview offered a large headline, three findings and links to the story pages. The findings came from the existing summary and revisions exports, not invented examples. An still found it boring. The information was present, but the page explained the project before giving a reader a reason to care about the next question.

We considered a stronger opening interaction and researched examples of evidence-led storytelling. References included The Pudding's Gyllenhaal and Kidz Bop stories and Neal's Deep Sea. Their relevance was the way a concrete observation or action opens a larger explanation. A referenced newspaper interactive could not be inspected directly, so its execution was not treated as verified evidence. An also noted that the portfolio already uses a scroll-to-depth idea; copying that device would not solve this project's reading problem.

The design lesson was to borrow a question-and-discovery structure rather than a visual effect. More cyan, a larger headline, more cards or additional animation cannot establish that a reader wants to continue. An's feedback is the evidence that the current introduction still needs work.

### 14.6 A revision reveal was built, then its role was reconsidered

**Status: IMPLEMENTED locally; its role as the main hook is SUPERSEDED.**

A local prototype reveals the difference between a jobs report's first print and a later vintage. The example is selected from the revisions data using an explicit criterion: the largest upward revision among the eligible settled jobs periods. It must not be described as a typical jobs revision. The example and display values are derived from the export rather than hardcoded illustrative numbers.

The component adds a small reveal interaction and motion with a reduced-motion alternative. The guide and hero interaction have tests. These checks establish behavior, not audience engagement.

The revision example makes point-in-time data tangible, but it also shifted the opening toward revisions. That is only one part of Macro Event Lab. The central question starts with market expectations before a release, then asks what arrived and how markets reacted. The revision reveal can support that explanation later without carrying the whole opening. Recentring the actual hero is still pending; changing the roadmap does not mean the page has already changed.

### 14.7 Moving instructions out of About

**Status: IMPLEMENTED locally; final reading review OPEN.**

An asked whether the How to use this site section belonged on Overview instead of About. We moved the reading guidance into a dedicated Overview component. The main sequence is four steps: choose a release, get the plain-language story, rewind expectations and put the result in perspective. Chart inspection, glossary help and sharing a timestamp remain in an expandable tips area.

About links to the guide rather than repeating all of its instructions, and its contents rail no longer advertises the removed section. This keeps the author page focused and places orientation near the reader's entry point.

An's later screenshot showed that a long instructional section could still feel flat. The move was useful information architecture, but instructions alone are not the hook. The next pass needs to reconsider their length and position after the opening gives a reader a question worth exploring.

### 14.8 GDP modelling started to compete with the site's purpose

**Status: GDP page IMPLEMENTED locally; model-led opening SUPERSEDED; scenario controls DEFERRED.**

The requested Models page is a separate GDP nowcast based on ALFRED data. Its small export reads the GDP nowcast and coefficient gold tables through an explicit field allowlist. The page compares the nowcast with the first published estimate over time, shows coefficient intervals and explains the method in plain words. It does not export a market comparison or calibration results. Python export tests and web data tests protect that boundary.

An then asked why a model was present without letting users toggle variables and see how it responded. We discussed making a small model lab more central to the opening. That was a proposal, not an implemented feature. An subsequently pointed out that supervised machine learning felt unrelated to the site's story.

The accepted correction is that calibration belongs naturally beside forecast quality in Scorecard, whereas predicting GDP from monthly indicators answers a separate research question. GDP nowcasting can remain accessible as supplementary research, but it should not redefine Overview or the main journey. We are not adding variable controls merely to make a model feel interactive.

If scenario controls are revisited, changing an input must be distinguished from removing a feature and fitting a new model. Either needs a clear user question, a valid point-in-time fitted state and an explanation that model response is not a causal effect. No such control is complete or promised by the current prototype.

### 14.9 Browser checks need a stable state and an honest completion claim

**Status: PARTIALLY VERIFIED; final acceptance matrix OPEN.**

The Models page was inspected at 375, 768 and 1280px in both themes, and screenshots were saved locally. Narrow layouts and dropdown placement were also investigated. During this work, a viewport check initially measured a different selected tab than expected. Reading the actual viewport width caught the mismatch before treating the narrow-screen result as valid.

A contrast script also produced misleading failures when it sampled text during a theme transition or counted content inside a closed disclosure. Measurements must use visible content after the theme settles. A subsequent stable dark desktop check found no failures in that sampled view, but that does not verify every page, theme, interaction state or width.

The last recorded development checks passed 124 web tests, the TypeScript production build, 194 pipeline tests and ruff. Those results belong to the local implementation at that point. They do not close the requested final browser review after the next hero revision, prove dual-screen behavior or demonstrate that An enjoys the reading flow.

The final pass still needs the specified 375, 768 and 1280px matrix in both themes, additional 280px and wide layouts, focus and menu states, reduced motion and visible text contrast. The website changes remain uncommitted.

### 14.10 Reorienting the roadmap around wanting to read on

**Status: DECIDED and DOCUMENTED, 29 October 2026; website revision OPEN.**

An's acceptance criterion is personal and concrete: if the site makes him interested enough to read the whole main story, it has succeeded. He asked to redesign the roadmap around that goal and preserve our discussions as report material.

The accepted main journey is Overview, Events, Compare, Scorecard and Revisions. It moves from why the question matters to one release, patterns across releases, forecast quality and the changing official record. Supporting pages stay available without becoming required reading. The opening should create curiosity with real evidence, offer one clear action and let experienced readers go directly to the data.

Interaction should reveal information relevant to that story. Rewinding expectations already exists in Events. Hiding the first print and then revealing it, followed by the day's yield change, is a proposed next interaction, not a completed feature. Daily Treasury series cannot support an intraday reaction claim or establish causality.

The current Overview request limits its data inputs to summary.json and revisions.json. That is enough to reconsider the message and findings. A complete event-level distribution replay would need an additional data input and is not silently included in this documentation change.

The local ROADMAP was rewritten around the central question, page roles, current implementation evidence, the immediate reading pass, acceptance criteria, later research and publication gates. The previous plan was archived before the rewrite. Detailed modelling work remains in the research backlog instead of competing with the immediate product task.

The next product step is a short Overview prototype aligned with expectations, first publication and reaction, followed by An's reading feedback. The final layout, browser checks and permission to commit remain separate completion gates. No claim of a successful reading experience has been made yet.

### 14.11 Publication is a separate decision from local exploration

**Status: OPEN permissions; existing restrictions retained.**

The site can use restricted data in its local research preview without gaining permission to publish it. Putting an export in a local public/data folder does not make its contents publishable. Kalshi-derived figures, charts, animations and comparisons remain private pending written permission, and new Kalshi ingestion remains paused. Industry returns from Kenneth French also remain local pending permission.

The ALFRED-only nowcast export has a separate boundary so a future allowed build can avoid restricted outputs. Source terms, attribution and the actual deployed file set still need review before publication. No deployment or publication was performed as part of the roadmap rewrite.

### 14.12 Material available for a later report

**Status: DOCUMENTED; report writing DEFERRED.**

- **Problem and product framing:** sections 14.4 through 14.10 explain the overloaded navigation, weak opening, rejected model-led direction and accepted reader journey.
- **Data engineering:** sections 1 through 6 cover resumable ingestion, vintages, timing, narrow anomaly exceptions, distribution construction and release matching.
- **Research discipline:** sections 9.5 through 9.8 and 14.2 explain leakage checks, bootstrap design, paired evaluation, likelihood choices and limits on inference.
- **Interface reliability:** sections 10 and 14.9 distinguish responsive behavior, accessible controls and motion correctness from reader engagement.
- **Constraints and judgement:** sections 7, 8 and 14.11 record security and publication boundaries.
- **Evidence still needed:** An's reading feedback on the next Overview, final browser acceptance and any future out-of-sample research belong in new entries when they actually happen.

This is source material for a later narrative, not a retrospective claim that every idea worked. Preserve the disagreements, corrections and unfinished work so the eventual report can explain why the final product took its shape.

### 14.13 Separating the frontend by responsibility

**Status: IMPLEMENTED and VERIFIED locally, 29 October 2026; uncommitted.**

An asked to split the frontend into multiple files for easier refactoring, believing the site lived in one index.html. Inspection showed that index.html was already a small Vite entry document and React components held the content. The remaining structural problems were a shared folder mixing pages with reusable components, Events orchestration in App and a long stylesheet.

The accepted change keeps one HTML entry and organizes the source by responsibility. Nine page components now live in src/pages. Shared controls and charts remain in src/components. Browser navigation, Events state, chart measurement and animation live in src/hooks. App composes the active page and shared shell. Events state remains above the page so switching pages preserves the selection and filter.

The stylesheet was split into eighteen ordered imports covering theme tokens, shared rules and page rules. Before any visual addition, flattening those files reproduced the original stylesheet exactly, and the production CSS filename hash stayed unchanged. The later TBA card is a deliberate, separately tested footer addition. The web README documents the structure and the importance of CSS import order.

The baseline passed 124 web tests and the production build. New integration tests exercise default and legacy routes, manifest isolation, selection and filter retention, history restoration, loading and error states. Browser checks loaded all nine pages at 375, 768 and 1280px in both themes, with no data alerts or document-level horizontal overflow in those 54 observations. A 280px check confirmed the Learn menu stayed inside the viewport and Escape returned focus to its trigger. These observations do not close the pending Overview content redesign or prove reader engagement.

### 14.14 Browser history exposed two timing problems

**Status: FIXED and VERIFIED locally, 29 October 2026.**

Returning from About to an event at T-24h unexpectedly reset the view to T-1h. One cause was introduced during extraction: the route's restored hour was copied into local state in an effect, after the detail component had already mounted and captured its initial hour. The hook now derives the initial hour synchronously from the route, with a separate marker for a manual event selection that should use the default hour.

An integration regression test failed before that fix and passed afterward, but the real browser still reset the hour. The initial chart mock did not represent a second, pre-existing behavior. A cached Explorer mounts with its event already available. Under StrictMode the initialization effect runs again, and clearing its initial-hour ref during the first run made the second run choose the default. The ref now remains stable for that mounted detail, making initialization repeatable.

A test using the real Explorer warms its cache, unmounts it and mounts it again under StrictMode. It reproduced the T-1h failure before the one-line correction. After both fixes, the test and browser preserved T-24h in the URL and slider after navigating to About and pressing Back. This is why a passing test with a simplified chart stub was insufficient evidence to close the bug.

### 14.15 Keeping the local preview alive

**Status: RESOLVED locally, 29 October 2026.**

The browser initially could not reach localhost:8000. Starting Vite in a restricted execution session produced a listening process that did not serve a successful browser response. An pointed out that repeated server interruptions were disruptive.

Only the process started during this work was stopped. Vite was then started as a hidden, independent background process on the same port, with local logs and its process ID under ignored data/dev-server. The browser successfully loaded the site afterward. Keep reusing that server rather than restarting it for edits or tests. The failed launch was an execution mistake, not a reason to change application code or ask An to troubleshoot the site.

### 14.16 The public journal entry is a placeholder

**Status: IMPLEMENTED and VERIFIED locally, then SUPERSEDED by section 14.17, 29 October 2026.**

An asked that the footer's Build journal action stop linking directly to JOURNEY.md. The journal remains a working document for later report preparation. An initial local version showed a TBA card when the action was activated.

BuildJournal is its own component. It uses a button with an expanded state and a linked status card. Clicking again or pressing Escape closes the card, and Escape returns focus to the button. There is no journal URL or new-tab navigation. A component test covers those interactions, and a footer regression check rejects the Markdown link.

The card was checked at 375, 768 and 1280px in both themes. It stayed within the page, displayed TBA and exposed no footer link to the journal file. Its measured text contrast was above 4.5:1 in each theme. The final local checks passed 137 web tests and the TypeScript production build. No commit, push or deployment was performed.

### 14.17 Reusing the existing construction page

**Status: IMPLEMENTED and VERIFIED locally, 29 October 2026; supersedes the inline TBA card.**

An pointed out an existing construction page on the portfolio and permitted reusing it. Inspection of the local portfolio source found its under-construction.html permalink. A browser visit to the GitHub Pages address redirected to https://aansensei.dev/under-construction.html and showed the Under Construction title, building sticker and animated background.

The footer now opens that existing page in a new tab through the shared ExternalLink component. It does not link to the working journal. The temporary card component, its styles and its superseded interaction test were removed; a footer regression test checks the exact destination, new-tab attributes and absence of the Markdown link. No copy of the portfolio animation or assets was added to this frontend, and no portfolio files were modified.

Clicking the footer link opened the verified Under Construction page in a new browser tab. The final link was also checked at 375, 768 and 1280px in both themes, measuring the actual viewport width. All six checks found the correct destination, no journal Markdown link and no document-level horizontal overflow. The final suite passes 136 web tests and the production build. Flattening the eighteen stylesheet imports again matches the original stylesheet exactly after removal of the temporary card. The local server remains running; no commit, push or deployment was performed.

### 14.18 Asking crawlers to leave the site alone

**Status: IMPLEMENTED and VERIFIED locally, 29 October 2026.**

An requested robots.txt after raising concern about bots cloning websites. The Macro Event Lab frontend now includes public/robots.txt with a wildcard user-agent group and Disallow: /. This asks all conforming crawlers, including search engines, not to crawl any path.

The policy follows the Robots Exclusion Protocol in [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). It is a request to cooperating clients, not authentication or an enforceable barrier against copying. A crawler can ignore it, and it does not protect the locally held research data. The file needs to be served at the deployed origin's /robots.txt; a file under a project subpath alone does not establish an origin-wide policy. No portfolio files were changed, and no publication or deployment was performed.

The local server returned HTTP 200 and text/plain for /robots.txt. The production build copied the file unchanged into dist, and a parser check rejected crawling both the root and a data path for arbitrary crawler names. Before the requested commit and push, the combined changes passed ruff, 194 pipeline tests, 136 web tests and the TypeScript production build. Private data and ignored planning files remain outside the commit scope.

The staged-file audit needed to compare both sides of Git-detected renames rather than only destination names. It also caught trailing blank lines at the ends of the extracted stylesheets, which were normalized before commit. Their production CSS hash remained unchanged. One build command was accidentally issued from the repository root, where there is no package.json; rerunning it from web succeeded. These were packaging and command-location issues, not application defects.
