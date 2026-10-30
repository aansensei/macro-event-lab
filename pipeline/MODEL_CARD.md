# Calibration MAP and GDP nowcast

## Calibration stage

Run `python -m macro_event_lab model` after building the local silver and gold tables.
It writes `data/gold/calibration_rows.parquet`, `data/gold/calibration_map.parquet`,
`data/gold/calibration_predictions.parquet`, `data/gold/model_scores.parquet` and
`data/gold/model_sensitivity.parquet`.
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
are one in the reference fit. Sensitivity fits use common prior SDs of 0.5 and 2 as well.
This gives partial pooling with fixed variance, not a fitted variance
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

Scores compare three predictions on identical held-out rows: raw market probabilities,
isotonic probabilities, and the combined isotonic and MAP prediction. Each metric reports
three pairs: isotonic minus raw, MAP minus isotonic, and MAP minus raw. The middle pair
measures MAP's incremental contribution. Mean differences add up across the two stages;
confidence interval endpoints generally do not.
Contracts are averaged within each event and horizon before events are averaged equally.
Log loss clips probabilities at 1e-12 for numerical safety; Brier uses the unmodified values.
Production scoring resamples event-level score differences with seed 0 and 100000 draws.
All three comparisons and both metrics reuse the same sampled event indices within each
series and horizon. Invalid or missing probabilities cause an error rather than different
sample sizes for different methods. Negative differences favour the candidate over its baseline.
The score table identifies `baseline` and `candidate` explicitly, with `baseline_score`,
`candidate_score`, `delta`, `lo`, `hi` and `n_events`. It replaces the two-method schema's
`market_score` and `model_score` fields. `lo` and `hi` are exploratory 95% percentile intervals.
`family_lo` and `family_hi` use Bonferroni tail probabilities of 0.05 / (2 * 216).
The fixed family includes four series, three horizons, two metrics, three method pairs and
three prior scales, including comparisons with no rows. `family_size` and `bootstrap_draws`
record the calculation. No p-values are inferred from the fraction of uncentred bootstrap
draws on either side of zero.

Bonferroni follows the family-wise adjustment principle described in
[R's multiple-comparison documentation](https://search.r-project.org/R/refmans/stats/html/p.adjust.html).
Percentile endpoints use resampled statistic quantiles as described in
[SciPy's bootstrap documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html).
These are nominal, approximate simultaneous intervals, not an exact finite-sample error
guarantee. They assume independent events and inherit the coverage limitations of percentile
bootstrap with small samples. Only about twelve draws fall in each adjusted tail at this
simulation size, so endpoint Monte Carlo error matters. They do not refit models in bootstrap
samples or include model-selection uncertainty from earlier exploratory work.

## Prior sensitivity

The fixed grid of prior SDs is 0.5, 1 and 2, corresponding to diagonal precisions 4, 1 and 0.25
on shared and series effects. All prior centres stay unchanged. Every scale refits the same
whole-event walk-forward splits; no test outcome selects a prior or changes the model.
All scales use identical event resamples for paired score calculations.
`model_sensitivity` reports every scale, with `prior_sd` identifying it. `model_scores`
is the SD = 1 slice. Reference predictions and descriptive coefficients remain the SD = 1 fit.
This tests shrinkage strength only; it does not separately test shared versus deviation scales.

Leakage tests change future labels and features, flip the held-out event's labels, delay one
training label, and place a label exactly on the cutoff. Earlier predictions stay fixed and
an event never enters training until all of its labels are available.

Extra covariates remain future work. A separate joint event model is described below.
The prior is fixed without tuning
on the evaluation sample. Further model choices after inspecting these results require fresh
validation; these scores do not constitute a prospective trading result.

## Hierarchical generalized posterior

Install the optional dependencies with `pip install -e ".[dev,bayes]"` from `pipeline/`.
After `model` builds training rows, run `python -m macro_event_lab model --bayesian` from
the repo root. `--draws` defaults to 1000 and `--tune` to 2000 per chain, with four sequential
chains, seed 0 and NUTS target acceptance 0.99. The Bayesian dependency set uses PyMC 6 and ArviZ 1
and requires Python 3.12 or newer; the base pipeline remains separate from that optional extra.
On Windows without a compiler, setting `PYTENSOR_FLAGS=cxx=` uses the Python execution path.

Shared bias and confidence retain Normal(0, 1) and Normal(1, 1) priors. Their series deviations
use separate learned HalfNormal(1) scales for bias and confidence, with a noncentred Normal
parameterization. Only four series inform these scales, so their uncertainty and hyperprior
sensitivity matter. Other covariates are not included yet.

The likelihood is the sum of Bernoulli log probabilities weighted so each event contributes
one unit across its contracts and horizons. This defines a **generalized posterior**, not a
generative likelihood for independent contracts. Weighting reduces domination by dense events
but does not identify their dependence or guarantee calibrated uncertainty. Posterior
probabilities and intervals are conditional on this weighting convention and model.

The fixed-scale version is tested against the NumPy MAP objective using log-density
differences and gradients at the fitted optimum. The learned-scale posterior is a different
model, and its median is not required to equal the fixed-scale MAP. A blanket median-equality
test would confuse posterior asymmetry, changed priors and Monte Carlo error with bugs.

Local outputs are `calibration_posterior`, `calibration_diagnostics` and
`calibration_marginal_checks` Parquet tables, plus `calibration_draws.npz` containing chain
draws, seed and sampling counts. Nothing is exported to website JSON. Posterior rows include
equal-tail 95% intervals and the conditional probability below zero for bias or below one
for confidence. `family_lo` and `family_hi` allocate posterior tail probability across all
eight series/parameter pairs, using 0.05 / 16 in each tail. These conditional posterior
intervals are distinct from the frequentist score bootstrap family.

Every sampled parameter and series effect must have R-hat at most 1.01, bulk ESS at least 400,
tail ESS at least 400, and zero divergences before outputs are marked `diagnostics_passed`.
A failed gate writes explicitly unvalidated results and exits with an error. These checks
assess sampling, not model adequacy or out-of-sample performance.

Marginal checks generate Bernoulli outcomes explicitly from each posterior draw and report
event-weighted outcome rates by series. They assume independent row-level simulation and
can generate inconsistent outcomes across strikes or horizons. They are limited marginal
checks, not a coherent joint posterior predictive check. This is explicit because
[PyMC Potential terms](https://www.pymc.io/projects/docs/en/stable/api/model/generated/pymc.model.core.Potential.html)
do not themselves supply a forward simulator. Sampling follows the
[PyMC NUTS API](https://www.pymc.io/projects/docs/en/stable/api/generated/pymc.sample.html).

Current posterior fits use all settled training rows descriptively. They do not replace
MAP walk-forward scores or establish Bayesian forecasting gains. Full Bayesian temporal
evaluation, coherent event simulation and sensitivity of learned-scale hyperpriors remain open.

## Joint event likelihood at T-1h

Run `python -m macro_event_lab model --joint` after building calibration rows. The
`--joint` and `--bayesian` modes are mutually exclusive. The generalized-posterior outputs
remain available for comparison; the joint model writes distinct `joint_calibration_*` tables.

This model selects the existing T-1h snapshot and observes one categorical outcome per event.
It uses all available settled greater-than contracts at that snapshot, sorted by strike.
Settlements must be a string of yes outcomes followed by no outcomes. The category is the
number of yes contracts, which identifies the interval containing the venue's settled result.
The target is this settlement interval, not an exact ALFRED first print. Events with one
contract yield two categories. Missing T-1h events are omitted without using another horizon.
Duplicate strikes, inconsistent timestamps, increasing survival probabilities or contradictory
labels fail validation. The model does not silently remove poorly predicted outcomes.

For series s and ordered market survival values S(k), the calibrated survival is
`sigmoid(a_s + b_s * logit(S(k)))`. Values of S are clipped to [0.01, 0.99] before the logit,
as in the contract-level model. Confidence is strictly positive: `b_s = exp(log_b_s)`.
This preserves order. Add survival boundaries 1 and 0; adjacent differences form a categorical
distribution over the intervals between strikes and the two open tails.

The categorical distribution is mixed with 1% uniform mass over its categories. This fixed
contamination assumption gives nonzero support to bins flattened by isotonic fitting and
does not select events based on their outcomes. The mixture is applied before observing a
category. Sensitivity to the 1% choice remains necessary. It is not an estimated error rate.
Internal array padding uses zero mass outside an event's true category set.

Shared bias is Normal(0, 1); shared log confidence is Normal(0, 0.5). Separate noncentred
series deviations have HalfNormal(1) bias scale and HalfNormal(0.5) log confidence scale.
The conditional prior median of confidence at the population centre is one. The prior mean
need not be one. This changes both the prior and likelihood relative to the weighted MAP,
so posterior medians are not expected to match the old fit.

PyMC's [Categorical distribution](https://www.pymc.io/projects/docs/en/stable/api/distributions/generated/pymc.Categorical.html)
observes one bin per event. Tests compare its likelihood against independent NumPy bin
probabilities, including ragged events and both tails. Cross-event conditional independence
is assumed; within an event, contracts are deterministic functions of its single category.
Other horizons are not treated as repeated independent observations.

Each posterior predictive replicate draws one category per event, then derives the label of
every contract as `category > strike_index`. Impossible combinations across strikes cannot
occur. `joint_calibration_checks` records observed and replicated fractions of yes contracts
per event. `joint_calibration_replicated` retains the shared category for every event and
flattened chain/draw index. These are in-sample adequacy checks, not forecasts.

`joint_calibration_posterior` and `joint_calibration_diagnostics` use the same sampler gates
and eight-parameter posterior interval convention as the generalized model. Raw parameter
draws, seed, sampling counts and the support mixture are saved to `joint_calibration_draws.npz`.
The horizon is fixed to T-1h in this mode. Outputs remain private and descriptive until
temporal evaluation, contamination sensitivity and hyperprior sensitivity are completed.

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
