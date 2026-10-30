# Calibration MAP and GDP nowcast

## Calibration stage

Run `python -m macro_event_lab model` after building the local silver and gold tables.
It writes `data/gold/calibration_rows.parquet`, `data/gold/calibration_map.parquet`,
`data/gold/calibration_predictions.parquet` and `data/gold/model_scores.parquet`.
These tables are private. They are not copied to the website or published.

The inputs are finalized binary contracts at T-1h, T-24h and T-7d before market close.
The probability feature is the isotonic fitted price, clipped to [0.01, 0.99] before
taking its logit. It is not the unadjusted quote. Features use the snapshot timestamp;
settlement outcomes are retrospective labels.

For series s, the fitted log odds are:

```
logit(p) = shared_bias + bias_deviation[s]
         + (shared_confidence + confidence_deviation[s]) * market_logit
```

Shared bias has a normal prior centred at zero and shared confidence at one.
Each series deviation has a normal prior centred at zero. All prior standard deviations
are fixed at one. This gives partial pooling with fixed variance, not a fitted variance
hierarchy. Other covariates and learned prior scales remain future work.

Every event has total likelihood weight one, split across its contracts and horizons.
This prevents events with many contracts from dominating, but does not make their labels
independent. The fitted values are a penalized descriptive estimate. No posterior
probabilities or credible intervals are reported. Temporal scores describe a separate evaluation.

The optimizer minimizes weighted Bernoulli negative log likelihood plus half the squared
distance from the prior centre. IRLS solves augmented weighted least squares with a line
search. SVD exposes rank deficiency in the design; the positive prior precision makes the
optimization unique even though shared and series columns are linearly dependent.
A separate gradient descent solver uses a spectral Lipschitz bound for its step size.

Tests compare IRLS with gradient descent for nonzero prior centres, and with
[scikit-learn LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)
for the equivalent zero-centred, weighted L2 objective. The latter uses `C = 1 / precision`
and an explicit intercept column with `fit_intercept=False`, so that intercept is penalized too.

## Temporal calibration evaluation

Label availability uses the API's `settlement_ts`, documented in
[Get Market](https://docs.kalshi.com/api-reference/market/get-market).
When absent, the timestamp of the downloaded finalized result is a conservative upper bound.
That source is recorded per row. The timestamp is supplied retrospectively by the venue;
we do not have a history of every settlement correction or dispute.

Every event's contracts and horizons stay together in the test set. A single model is fitted
before its earliest available snapshot. All training events must have every label and snapshot
strictly earlier than that cutoff. Missing label times exclude the whole event from training.
At least 20 prior events across the four series are required. This conservative design does
not refit on newer information between T-7d and T-1h of the same event.

Scores compare raw market probabilities with the combined isotonic and MAP prediction on
identical held-out rows. They do not isolate MAP's incremental benefit over isotonic alone.
Contracts are averaged within each event and horizon before events are averaged equally.
Log loss clips probabilities at 1e-12 for numerical safety; Brier uses the unmodified values.
Paired bootstrap resamples event-level score differences with seed 0 and 2000 draws.
Negative differences favour the model. Intervals are exploratory percentile intervals,
uncorrected for comparing four series and multiple horizons. They assume event independence
and do not refit models in bootstrap samples or include prior-choice uncertainty.

Leakage tests change future labels and features, flip the held-out event's labels, delay one
training label, and place a label exactly on the cutoff. Earlier predictions stay fixed and
an event never enters training until all of its labels are available.

Posterior inference, extra covariates, learned variance scales, multiple-testing correction
and comparison against isotonic alone remain future work. The prior is fixed without tuning
on the evaluation sample. Further model choices after inspecting these results require fresh
validation; these scores do not constitute a prospective trading result.

## GDP nowcast review

Features use monthly vintages available by the day before the advance GDP release.
The prior-quarter baseline is populated only if that quarter's first print was already public.
Both outer training and inner penalty selection check label release dates against forecast
cutoffs. Standardization is fitted only on each training sample.

Coefficient bootstrap draws are expressed in the original sample's feature SD units.
Blocks stop at missing quarters and at the sample end, so excluded quarters do not create
false temporal neighbours. The intervals condition on the selected penalty and on the
chosen exclusions. They do not account for penalty selection uncertainty or prove causal effects.
The full walk-forward evaluation retains pandemic quarters.

The market comparison uses the T-1h median on common quarters. Its information cutoff differs
from the nowcast's prior-day cutoff; this is not a controlled same-information contest.
Baseline errors are evaluated on common nonmissing rows.
