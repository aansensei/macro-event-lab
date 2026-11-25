# Models and formulas

This page states exactly what each contestant of the forecast arena computes and how the scores are calculated. It describes the code as it runs today. The rules that were fixed before any result was read are in [`pipeline/EVAL_PROTOCOL.md`](../pipeline/EVAL_PROTOCOL.md). Results are preliminary and the arena does not name a winner.

## Targets and the number being forecast

| Target | Number | Unit |
| --- | --- | --- |
| `gdp` | Real GDP growth, quarter over quarter, annualized | percent |
| `cpi` | Month over month change of the seasonally adjusted consumer price index | percent |
| `payrolls` | Month over month change of total nonfarm employment | thousands of jobs |

The number scored is always the **first published** value. A forecast made on a date may use only data that was public on that date. Every model is fitted only on rows whose answers were already public and is refit at every origin with an expanding window.

## The contestants

Notation: `y` is the target, `Z` is the matrix of features standardized with the mean and the standard deviation of the training rows only (divisor n), and `ybar` is the mean of the training targets.

### Naive

```text
forecast(t) = y(t - 1)        the previous first published number
```

### Autoregression

```text
y(t) = c + phi_1 y(t-1) + ... + phi_p y(t-p) + e(t)
p chosen from 1, 2, 3, 4 by the Bayesian information criterion on a common sample
(all rows except the first 4 observations, so every lag is compared on the same rows)
estimated by least squares on that common sample, at least 20 observations
the forecast uses the coefficients of the chosen lag from that fit, with no refit on more rows
```

### Ridge regression

```text
beta = argmin  sum (y - ybar - Z beta)^2 + lambda * sum beta^2
     = (Z'Z + lambda I)^(-1) Z'(y - ybar)
forecast = ybar + z_now * beta
lambda chosen from 0.01, 0.1, 1, 3, 10, 30, 100, 300, 1000
by an inner walk forward evaluation over the last 8 training rows
```

Features. For `gdp`: the quarterly growth (or change, for the unemployment rate) of payroll employment, industrial production, real personal consumption, real retail sales, housing starts and the unemployment rate, plus the previous quarter's GDP growth. For `cpi` and `payrolls`: the last three first published values of the target and the same indicators at monthly frequency. For `payrolls` the employment indicator is left out because it is almost the same column as the lagged first prints. A feature not yet published on the forecast date takes the mean of the training rows. For the monthly targets an indicator with no value yet for the month before the target month takes the value of the month before that, and only when neither exists is it treated as missing.

### Ridge on principal components (factor ridge)

```text
Z = U S V'                          singular value decomposition of the training matrix
F = Z V_r                           the first r principal component scores
beta = ridge fit of y on F with penalty lambda
candidates (r, lambda): r in 1, 2, 3, 4 and lambda in 0.1, 1, 10, 100
the pair with the smallest inner walk forward error is used
```

### LASSO

```text
b = argmin  (1 / 2n) sum (y - ybar - Z b)^2 + lambda * sum |b|
solved by coordinate descent: b_j <- soft(Z_j . r / n + c_j b_j, lambda) / c_j
soft(v, t) = sign(v) * max(|v| - t, 0),  c_j = mean of Z_j squared
lambda grid: 30 values from lambda_max = max_j |Z_j'(y - ybar)| / n down to lambda_max / 1000
lambda chosen by the inner walk forward evaluation
```

### Survey of Professional Forecasters (GDP only)

The median forecast of current quarter real GDP growth from the Federal Reserve Bank of Philadelphia, used only if it was published on or before the forecast date.

### Two foundation models (planned, not yet run)

Time series foundation models are planned as the last two contestants. They are not part of any result yet.

## Intervals and scores

```text
90 percent interval = forecast +- q
q = the value at position k = ceil((n + 1) * 0.9) of the sorted absolute errors of the last n = 40
    forecasts whose first print was public at the origin (position 37 of 40); no interval with fewer
```

```text
error(t)  = first print(t) - forecast(t)
RMSE      = sqrt( mean( error^2 ) )
MAE       = mean( |error| )
coverage  = share of first prints inside the 90 percent interval
worst period share = max error(t)^2 / sum error(t)^2
RMSE without 2020  = the RMSE over the periods that do not start in 2020 (a sensitivity check)
```

### Test against the naive forecast (Diebold and Mariano)

```text
d(t) = error_model(t)^2 - error_naive(t)^2
DM   = mean(d) / sqrt( V / n )
V    = the variance of d with divisor n (one step ahead, so no autocovariance terms)
corrected statistic = DM * sqrt( (n - 1) / n )        Harvey, Leybourne and Newbold
p value = two sided, Student t with n - 1 degrees of freedom
```

The p values are not adjusted for the number of comparisons and describe a short sample.

## Where each piece lives

| Piece | File |
| --- | --- |
| Targets, origins, first prints | `pipeline/src/macro_event_lab/arena/targets.py` |
| Contestants | `pipeline/src/macro_event_lab/arena/contestants.py` |
| Standardization, principal components, LASSO | `pipeline/src/macro_event_lab/arena/linalg.py` |
| Inner walk forward selection | `pipeline/src/macro_event_lab/arena/selection.py` |
| Intervals | `pipeline/src/macro_event_lab/arena/conformal.py` |
| Scores and tests | `pipeline/src/macro_event_lab/arena/metrics.py` |
| Walk forward runner | `pipeline/src/macro_event_lab/arena/harness.py` |
