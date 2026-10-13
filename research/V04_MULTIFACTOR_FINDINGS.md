# V0.4 — multi-factor exploratory model (13 October 2026)

**Scope:** private RacingFormBook SFF 2025 / 2026 British handicap hurdles. **Result: not validated for selection, value or betting; keep out of the live scanner.**

The predecessor V0.3 raised rated-field coverage to 852/876 2026 races but 345 top-speed selections returned −26.8% on a hypothetical final bookmaker-SP basis. See [V0.3](V03_EXPANDED_SPEED_FINDINGS.md).

## What was tested

An independent multi-factor LightGBM research pilot, trained **only on 2025** GB handicap hurdle runners (1,242 races, 10,765 runners) and replayed on 2026 through 11 October (876 races, 7,559 runners). **2026 had been inspected during earlier experiments, so this is exploratory, not a pristine untouched test.**

Current-race card inputs: official rating relative to opposition, carried weight, field size, age, distance, going and class where available. Earlier-race form inputs: past winner/place rates, finishing percentile, days since last run, earlier SP market context, prior speed index, comparable going and distance, and trainer previous 60-day win record. No same-day outcomes, current race result, current bookmaker starting price, race comments or winning time enter the predictor.

LightGBM hyperparameters frozen for this exploratory pass: 120 trees, learning rate .05, max depth 3, 7 leaves, min child samples 80, L2 10, seed 42. Per-runner raw estimates were normalised within each race.

| Metric (2026) | Multi-factor model | Final bookmaker-SP market |
|---|---:|---:|
| Runner Brier (lower better) | **0.097954** | **0.093132** |
| Runner log loss (lower better) | **0.337553** | **0.315494** |
| Top-ranked winners from 876 races | **182 (20.8%)** | **257 SP-favourite winners** |
| Hypothetical ROI at final bookmaker SP | **−22.69%** | **−21.09%** for split-stake SP favourites on same races |

The model's selected runners had **202.11 expected winners** under normalised final-SP probabilities, against **182 observed winners**.

No model win-probability or market-value advantage has been established. These market prices are post-off benchmarks, not verified pre-off executable quotes. Model feature importances do not establish an edge.

## Decision

**Do not deploy these predictions, market-value labels or betting selections to the PIF Racing Scanner.** Keep the product's existing informational/manual paper-tracker features unchanged. Freeze all three speed/form diagnostics as research baselines. Collect genuinely timestamped prospective data and pre-off attainable prices before suggesting confidence in a new value algorithm; do not repeatedly tune to the examined 2026 outcomes.

The source SFF ZIPs and detailed user-owned CSV analyses were not uploaded to GitHub. Reproducible standalone code and full private reports are provided to the user in the separate `PIF_Racing_Backtest_V03_V04.zip` download.
