# Historical data acquisition register (13 October 2026)

Goal: £0 *additional* spending, personal experimental research, British handicap hurdles first. No results archive has yet been acquired.

| Source | Accessible data | Decision |
|---|---|---|
| The Racing API Free (currently connected via feed service) | Current racecards, basic results. No four-season archive. | Keep current feed. Later persist permitted completed results to build forward history. |
| Betfair Historical BASIC (https://historicdata.betfair.com/) | Free minute-by-minute Exchange market snapshots and settlements. Market archive does not provide going-adjusted race performance data. | Promising odds source. User account download/acceptance may be necessary. Personal internal use only; never commit raw Betfair data to public repo. |
| RacingFormBook (https://www.racingformbook.com/single-csv-racing-results/) | UK and Irish results CSVs going back to 2016, apparently subscription/purchase. | Not within £0 assumption; do not purchase. |
| Kaggle deltaromeo UK/Ireland racing results dataset | Historical results dataset reported through 2026. Exact content, provenance and licence not independently confirmed. | Candidate for manual licence and contents review before any ingestion; do not use based solely on availability. |
| Robin Howlett rpscrape (https://github.com/robinhowlett/rpscrape) | Scraper software rather than a licensed dataset. | Do not automate scraping racing sites before verifying original site's permissions and database rights. |
| Racing TV RaceiQ and At The Races sectionals | Some publicly viewable sectional data. | Viewing permission does not imply redistribution, bulk automated access or model-training rights. |

## Current engine components
- `research/import_results.py`: canonical CSV validator with no network calls.
- `research/backtest.py`: evaluates genuinely frozen pre-race predictions and historically available prices; **does not fit a model**.
- Existing `feed_server.py`, `index.html`, `live.js` remain untouched.

## Strict source CSV contract
One row per race runner with columns:
`race_id,race_date,course,race_type,handicap,distance_furlongs,going,official_time_seconds,runner_id,horse_name,finish_position`.
Optional: `beaten_lengths,carried_weight_lbs,official_rating,source`.

Race types: `hurdle`, `chase`, `flat`, `nh flat`.
Handicap: `true`/`false` or `1`/`0`.
Dates `YYYY-MM-DD`; time is race winner's **official total time in seconds** for all runners of one race. This alone is NOT a sectional timing figure. `beaten_lengths` must be per-runner margins measured from winner if supplied; do not infer where absent. Missing/ambiguous times must be excluded, not filled with invented values.

Command:
```bash
python research/import_results.py --input my_licensed_results.csv --output local_data/clean_results.csv
```

Keep downloaded third-party data under `local_data/` (untracked). Do not commit data files or credentials.

## Needed next
1. Secure **one genuine legally reusable historical CSV sample** with timing and runners, confirm it has usable hurdle handicap coverage.
2. Calibrate going/course/distance time standards using *earlier races only* (walk-forward training).
3. Generate out-of-sample race-winning probabilities and frozen timestamped selections.
4. Join legitimate historical pre-off Betfair prices and run existing `research/backtest.py`.
5. Only then evaluate whether this beats a price-only baseline.

Data provenance and licensing are blockers: this document does **not** claim a profitable model, live feed access or historical backtest result.
