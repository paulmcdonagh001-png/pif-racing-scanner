# PIF Racing historical backtest — V0.1

This module **does not change the existing mobile scanner**. It checks frozen historical forecasts once lawful, reliably timestamped historical data is obtained.

## Run
```bash
python research/backtest.py --csv my_predictions.csv
```

Required CSV columns:
`race_id,runner_id,off_datetime,prediction_datetime,win_probability,decimal_odds,won`

Each row is one runner. All runners from every race must be present; probabilities must sum to approximately 1 and there must be one winner. Timestamp fields require ISO 8601 timezone offsets, e.g. `2025-01-04T13:30:00+00:00`.

**No real example data are included.** Missing odds, returns, timing fields, or genuine pre-race forecasts must not be guessed or reconstructed with hindsight. Predictions need versioned evidence that they were generated before the race. The evaluator checks timestamp ordering but cannot independently verify that a supplied probability was not retrospectively manufactured.

For a selected runner, expected gross value is `p * odds - 1`. The default threshold is 0.05, and at most one runner per race is selected. The default 2% deduction on a winning return approximates exchange commission for a single standalone wager; actual market settlement and commission can differ.

Outputs: runner count, race count, selections, win rate, unit-stake ROI, peak-to-trough drawdown, per-runner Brier score and individual selections. No selections is a valid result.

## Model and evaluation strategy

1. Focus British handicap hurdles, then separate handicap chases and all-weather Flat.
2. Construct course/distance/going baseline speed tables **only from races preceding the test race**; never label a plain form score a speed figure.
3. Separate model development, validation and final holdout **chronologically**. Proposed: train 2022–24; validate 2024–25; test 2025–26; forward paper-track 2026–27, dependent on lawful accessible data.
4. Benchmark against pre-race market-implied probabilities and simple baseline form assessments.
5. Assess calibration, out-of-sample ROI after realistic costs, track/year-specific performance, drawdown and uncertainty before claiming edge.

## Sources and limitations

- The Racing API Free: **today/tomorrow racecards, current-day basic results**, not a multi-year archive.
- The Racing API Basic: historical individual runners on current racecards, not multi-year results browsing.
- Betfair historical Basic: historical Exchange market price snapshots, free for **personal internal** usage, commercial use requires licensing.
- Free-to-view RaceiQ data are not automatically licensed for automated bulk reuse.

Do not embed Racing API credentials or scanner PIN in repository files. Do not change subscriptions before confirming the data needed.

Current status: **evaluator code committed; no genuine historical predictions loaded, no completed backtest or profitability result.**

## Andy Holding-inspired speed replay research

`research/speed_replay.py` is a chronological, experimental rating replay. It uses earlier same-course/distance/going race-time standards and prior horse performances, and reports strike rate, theoretical SP ROI where priced, losing streaks and a market-favourite comparison. It is not an Andy Holding rating or validated betting model. Source audit: `research/DATA_SOURCES.md`. **No suitable legally verified £0 multi-season dataset was obtained, so no genuine speed-rating backtest result is claimed.** Existing seven-day real SP baseline is in `research/REAL_DATA_BASELINE_2025.md`. Test code is synthetic only.
