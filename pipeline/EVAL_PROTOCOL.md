# Evaluation protocol of the Macro Forecast Arena

Status: written before any contestant was run on real data. Frozen on 2026-11-24. After the freeze only the roster may change, through the substitution rules in section 10, and each change is a dated line under "Roster changes" at the end.

## 1. Question and scope

Who forecasts the first published US macroeconomic numbers best: professional forecasters, classical statistical models, or time series foundation models, when every forecast is made with only the information that was public on the day it was made and is scored against the number as first published? The arena reports accuracy, honest uncertainty intervals and a leakage audit. It makes no claim about forecasting revised data, other countries or other horizons.

## 2. Targets

Each target is computed inside one data vintage, the vintage that first published the reference period. Values from different vintages are never mixed, so the base period used in a growth rate is the value known in that same vintage.

| id | definition | unit | frequency | series | first print |
| --- | --- | --- | --- | --- | --- |
| `gdp` | annualized quarter over quarter growth of real GDP | percent | quarterly | GDPC1 | the advance estimate |
| `cpi` | month over month change of the seasonally adjusted CPI index | percent | monthly | CPIAUCSL | the first monthly release |
| `payrolls` | month over month change of total nonfarm employment | thousands of jobs | monthly | PAYEMS | the first monthly release |

The first print of a period is the first vintage in which the period has a value. The date it became public is that vintage's real time start, converted with the existing release calendar rules. A period with no first print yet has no actual and appears only in the live forecast.

## 3. Origins and the information rule

A contestant sees only what was public on `made_on`. Data are filtered with `known_from <= made_on` (survey forecasts) and `realtime_start <= made_on` (vintage data). A forecast cannot be made after its own answer is public: for every origin `made_on` is earlier than the first print date of its period.

All contestants forecasting the same target and period share one `made_on` and one information set.

| target | `made_on` | what is knowable that day |
| --- | --- | --- |
| `gdp` | the official news release date of the Survey of Professional Forecasters survey of the target quarter | every vintage published on or before that date, including the survey itself |
| `cpi`, `payrolls` | the day after the previous month's value was first published | every vintage published on or before that day |

The survey release date comes from the official release calendar. Where the calendar has no usable date the survey is not used for that origin, and the origin is dropped for every contestant of that target rather than given a different date.

## 4. Contestants

Eight slots. A contestant that cannot forecast an origin returns nothing; it is never given a guess.

| id | kind | description | targets |
| --- | --- | --- | --- |
| `naive` | baseline | the previous first print known at `made_on` | all |
| `ar` | classical | autoregression by least squares with an intercept, lag chosen by BIC from 1 to 4 on data known at `made_on`, at least 20 observations | all |
| `ridge` | classical | ridge regression on lagged first prints and the monthly indicators known at `made_on` (the existing nowcast ridge for `gdp`) | all |
| `factor_ridge` | classical | principal components of the standardized indicator panel, then ridge on 1 to 4 factors | all |
| `lasso` | classical | LASSO by coordinate descent on the standardized indicator panel | all |
| `foundation_a` | foundation | first usable model by the substitution rules in section 10, zero shot | all |
| `foundation_b` | foundation | second usable model by the same rules | all |
| `spf` | human | median forecast of the current quarter from the Survey of Professional Forecasters | `gdp` only |

The survey publishes quarterly average inflation and quarterly employment levels, which do not match the monthly `cpi` and `payrolls` targets. `spf` therefore forecasts `gdp` only. It is never rescaled or approximated for the other targets, and the page says it did not take part in them.

## 5. Training rule

Every model is refit at every origin with an expanding window of data known at `made_on`. Penalties, lags and factor counts are chosen inside that window by an inner walk forward evaluation, never on later data. Standardization uses statistics of the training window only. Pandemic periods stay in the scored periods. For fitting coefficients they follow the rule already used by the nowcast code. Foundation models are not trained; they receive only the history known at `made_on`.

## 6. Metrics

Per target, contestant and window: root mean squared error, mean absolute error, pinball loss at quantiles 0.05, 0.5 and 0.95, and the empirical coverage of the 90 percent interval with a Wilson confidence interval. The difference to `naive` is reported as a percent difference of root mean squared error and is undefined when the naive error is zero.

Windows: `all` is every scored period. `clean` is the periods after the contestant's training cutoff, and equals `all` for contestants without a cutoff.

## 7. Intervals

Split conformal prediction on the last 40 origins of absolute errors, level 0.9. With `n` residuals the interval half width is the value at position `ceil((n + 1) * 0.9)` of the sorted absolute residuals, so 37 for `n = 40`. Intervals are symmetric around the point forecast. A residual enters the calibration set only once its own actual was public at the origin being forecast. The first 40 origins of a contestant are calibration only and are not scored for coverage. With fewer than 40 residuals no interval is published. Adaptive conformal inference with step 0.01 is reported as a sensitivity check and never as the headline.

## 8. Significance

Diebold and Mariano test of equal squared error against `naive`. The long run variance uses Newey and West weights with `h - 1` lags, where `h` is the horizon in periods; here `h = 1`, so the variance is the plain sample variance of the loss difference. The Harvey, Leybourne and Newbold correction is applied and the reference distribution is Student t with `n - 1` degrees of freedom, two sided. The Clark and West adjusted test is a secondary table for nested pairs (`ar` against `naive`, `ridge` against `ar`). p values are reported as numbers next to the percent differences and never combined with them. No correction for multiple comparisons is applied; the page states how many tests were made. A large p value does not show that two contestants are equally good.

## 9. Leakage rule

For each foundation model the cutoff is the published training cutoff when the model card or paper states one. When none is published the cutoff is the date the weights first became public, the earlier of the repository creation date and its first commit date, and the page states that this is a proxy and not proof. Origins with `made_on` on or before the cutoff are `before`, the others `after`. The audit reports the number of origins on each side and, where the units allow, the error on each side.

Public benchmark corpora used to train or evaluate foundation models can contain macroeconomic series. In particular the benchmark used for Chronos-2 includes monthly and quarterly US macroeconomic datasets built from the same public data as this arena. This risk is stated on the page and every foundation result is shown beside its `clean` window.

## 10. Substitution rules

Fixed now. If Chronos-2 or TimesFM 2.5 is unusable, replace it with Granite TTM R2 (only the repository under the `ibm-granite` organization), then Moirai 2.0 (its weights license allows non commercial use only). If the survey cannot be published, the human slot stays in private scoring only. If no foundation model is usable the arena runs the classical roster and says so. Market data never enters the roster without written permission. Institutional nowcasts from regional Federal Reserve Banks are not in the roster; they are on the backlog.

## 11. What will be reported whatever the outcome

All contestants, all windows, losses as prominently as wins, the number of scored periods and of tests, and the limits: a short clean window, few quarters of GDP, and a first print target that is later revised.

## 12. Change log

2026-11-24: protocol frozen.

<!-- roster-changes-below -->

## Roster changes

### 2026-11-24, implementation choices made explicit

These sentences state values the code already used when the first results were produced. They change no forecast and no rule above the marker line.

- Standardization divides by the population standard deviation (divisor n, not n minus 1).
- A multivariate contestant needs at least 20 training rows whose actual was public at the origin before it publishes a forecast.
- Ridge chooses its penalty from 0.01, 0.1, 1, 3, 10, 30, 100, 300 and 1000 by an inner walk forward evaluation over the last 8 training rows.
- Factor ridge chooses the pair of factor count (1, 2, 3 or 4) and penalty (0.1, 1, 10 or 100) with the smallest inner walk forward error.
- LASSO uses 30 penalties spaced geometrically from the smallest penalty that sets every coefficient to zero down to one thousandth of it, with coordinate descent that stops when the largest coefficient change is below 1e-8 or after 5000 sweeps.
- A missing feature takes the mean of the kept training rows, and a column with no observed value takes zero.
- The Diebold and Mariano variance divides by n (not n minus 1), and the Harvey, Leybourne and Newbold factor is applied as stated in section 8.

### 2026-11-24, monthly indicators exclude the target's own series

For the `payrolls` target the indicator `PAYEMS` is not used, because the same series enters the model through the lagged first prints and the two columns are almost identical, which makes the penalized fits ill conditioned and very slow. The `cpi` target keeps all six indicators. No payrolls forecast from `ridge`, `factor_ridge` or `lasso` had been published before this rule.

### 2026-11-24, further implementation choices and the status of the reporting items

These sentences describe what the code does. They change no forecast and no rule above the marker line.

- First prints are rounded to the precision at which the statistical agencies publish them: CPI and GDP growth to 0.1, payrolls to thousands of jobs. The lagged first prints used as features are the same rounded numbers.
- The two spring 2020 quarters stay in every fit of every arena contestant. The GDP nowcast page leaves them out only when it draws the uncertainty of its coefficients, not when it fits them.
- The origin of a GDP forecast is the news release date of the survey for that quarter, so the monthly indicators of the quarter can cover one month or less.
- For the monthly targets, an indicator that has no value yet for the month before the target month at the origin takes the value of the month before that. When neither exists the feature is missing and takes the training mean.
- The mean used for a missing feature, and the penalty grid of the LASSO, are computed on the whole training window known at the origin, including the 8 rows of the inner evaluation, so the grid uses their answers. Penalties, lags and factor counts are still chosen only by fits that use rows earlier than the row they predict, and nothing after the origin enters. Changing this would change forecasts already recorded in the ledger, so it is kept and stated as a limitation.
- Reported on the Arena page now: root mean squared error, mean absolute error, coverage of the 90 percent interval, the Diebold and Mariano test and the number of tests shown in each table. A percent difference to `naive` compares both errors over the periods the contestant forecast.
- Not yet reported, although section 6, 7 and 8 name them: pinball loss, the Wilson interval for coverage, adaptive conformal inference and the Clark and West test.

### 2026-11-24, how the autoregression is estimated

These sentences describe what the code does. They change no forecast and no rule above the marker line.

- Every lag from 1 to 4 is fitted on the same rows, all rows except the first 4 observations, and the lag is chosen by the Bayesian information criterion on that common sample. The forecast uses the coefficients of the chosen lag from that fit. The model is not refitted on more rows after the lag is chosen. A second implementation written only from the earlier text refitted on all rows of the chosen lag and differed from the published forecasts, which is how this was found.

### 2026-11-24, the remaining scores are now reported

These sentences describe what the code does. They change no forecast and no rule above the marker line. They replace the earlier note that listed these scores as not yet reported.

- Each score row now also carries the number of forecasts that have an interval, the 95 percent Wilson interval of the coverage, the pinball loss at the quantile levels 0.05, 0.5 and 0.95 (the lower bound, the point forecast and the upper bound of the 90 percent interval stand for the three quantiles, over the forecasts that have an interval), and the coverage of adaptive conformal intervals. The Wilson interval is clamped to the range 0 to 1 at the edges.
- Adaptive conformal inference starts at a miscoverage of 0.1, moves it by 0.01 times the gap between the target miss rate and the observed miss, and takes the half width from the last 40 absolute errors that come before the error being scored in period order. Unlike the published split conformal interval, this sensitivity check does not wait for each earlier error to have been released, so it is a description of how the rule behaves on this sample, not a forecast anyone could have made. It is never shown as the headline interval.
- The Clark and West adjusted test compares `ar` with `naive` and `ridge` with `ar` for every target where both forecast, over the periods both forecast. The statistic divides the mean of the adjusted loss difference by its standard error computed with divisor n, and the p value is one sided from a Student t distribution with n minus 1 degrees of freedom: a small value means the larger model forecasts better than chance explains.

### 2026-11-24, an actual on the edge of an interval counts as inside

This sentence describes what the code does. It changes no forecast and no rule above the marker line.

- Published numbers move in steps of 0.1 and interval half widths are differences of such numbers, so an actual often sits exactly on an interval edge. An actual on the edge counts as covered. Edges are compared with a tolerance of 1e-9 so that floating point noise of the order of 1e-16 does not decide the outcome. Before this was added, one forecast in the inflation record of the naive forecast (September 2006, the actual of minus 0.5 against a lower edge computed as minus 0.49999999999999994) was counted as a miss, which moved that coverage by one forecast. The same tolerance is used by the adaptive conformal sensitivity check.
