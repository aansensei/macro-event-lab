# November 2026 nonfarm payrolls (thousands of jobs, month over month change)

Release date: 2026-12-04. Written before the release. Never edited after the release: a correction is a new dated section at the bottom.

## 1. What is known

Model forecasts recorded in the public ledger (as of 2026-11-25, recorded 2026-11-25T01:31:12Z):

- Autoregression: 99.7
- Ridge on principal components: 168.2
- LASSO: 90.9
- Naive (repeats the previous first print): 165.0
- Ridge: 150.7

The simple average of the five is 134.9 and the middle one is 150.7. They span 77 thousand jobs, which is most of one typical month of noise.

From the revisions history (first prints since 2025):

- The previous first print, October, was 165 thousand. The month before it, September, was 29 thousand.
- Over the twelve months to September the first prints averaged 61 thousand, with a standard deviation of 93 thousand. October's 165 is about 1.1 standard deviations above that average.
- Between the first print and the next report, a month was revised down 9 times out of 12, by 11 thousand on average (smallest change minus 2, largest minus 68, largest revision up plus 64).

Indicators published since the previous release: this note does not use them. It rests on the recorded model forecasts and on the history of first prints and revisions above, and nothing else.

## 2. The mechanism

The chain of reasoning from theory to this number.

Macro. Hiring follows expected demand with a lag, and in a labor market that is cooling it follows it slowly: firms stop adding jobs before they start cutting them. That makes the trend in payrolls smooth in the data generating process and noisy in what is measured. Over the last twelve months the measured first prints swung between minus 105 and plus 178 thousand, which is much more than any plausible change in the underlying trend over so short a time. So the first reading of one month says little about the trend, and the best guess for the next month leans on the longer average, not on the last number. The five models disagree because they weight the last print differently: the naive forecast and the principal components model sit near 165, the LASSO and the autoregression near 90 to 100, much nearer the longer average.

Micro. A first print is built from a survey that is revised twice, a seasonal adjustment that is largest in the months around the holidays, and an estimate of businesses opening and closing that the survey cannot see. In the last year, nine of twelve first prints were later revised down. That pattern does not prove bias, but a high first print is more likely to be a sampling high than a low one is a sampling low, and November is the month where holiday hiring in retail and transport makes the seasonal adjustment do the most work.

## 3. My prediction

A first print for November of about 100 thousand jobs, in a range from 30 to 170 thousand.

Direction against the models: below the average of the five (134.9) and well below the naive forecast (165.0), closest to the autoregression (99.7) and the LASSO (90.9).

Conditional statements:

- If the October figure is revised down by more than 30 thousand in the same report (the average revision over the last year is minus 11 thousand, so this would be unusual), read the underlying trend as weaker and expect the November print at or below 60, the twelve month average.
- If the October figure is revised up or unchanged and the unemployment rate does not rise, the print is at or above 130, nearer the ridge models.
- If the unemployment rate rises by two tenths of a point or more, the print is at or below 60 whatever the other models say.

## 4. What would change my mind

- A large one off effect in the survey week (a strike, a storm, a change in the survey method) that moves the number without moving the trend.
- A revision of the October and September figures that shows the recent months were stronger than the first prints suggested. That would make the longer average a worse anchor and move my centre toward the ridge models.
- Evidence that the models that follow the last print (naive, ridge on principal components) have been closer in the months since the labor market changed course. In the last twelve months the ridge on principal components had the smallest error of the five on this target, which is a reason to keep it in view, not to follow it.

## 5. After the release (written after publication)

Which links of the chain held and which did not, in three sentences, and whether the miss came from the model, the reasoning or noise: To be added in a dated section after the release.
