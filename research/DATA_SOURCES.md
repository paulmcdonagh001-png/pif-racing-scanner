# Historical source audit — PIF Racing speed replay

**Checked:** 13 October 2026. **Constraint:** £0; no paid subscription or data purchase.

## Result of the source search

No legally clear, zero-cost, multi-season (2022–2026) UK/Irish National Hunt runner dataset was obtained for this replay. Therefore **no genuine historical speed-rating backtest or speed-model ROI is reported**.

| Source | What the source confirms | Decision |
|---|---|---|
| [RacingFormBook free SFF sample](https://www.racingformbook.com/single-csv-racing-results/) | A public sample is offered; documented fields include race elapsed time (WinTime/Seconds), course, date, distance, going, each runner's finishing position, distance behind winner (TotalBtn), horse name, weight, OR and decimal SP. The sample used in the existing pilot covers 28 Apr–4 May 2025 only. | Useful for checking the documented format, but just one week and no explicit licence for model training or commercial reuse was verified. It cannot provide 2022–2026 prior form or enough hurdle handicaps for validation. Keep any sample data local; do not redistribute it. |
| RacingFormBook back catalogue | Their site says the UK/Irish archive extends from 2016 onward, with back copies available for a fee; weekly SFF files are a subscribing-member service. | Not usable under the £0 limit. |
| [Kaggle deltaromeo UK/IRE racing archive](https://www.kaggle.com/datasets/deltaromeo/horse-racing-results-ukireland-2015-2025) and earlier user-uploaded ZIPs | A large archive is publicly listed, but the dataset licence, original source permissions, provenance, corrections and extraction rights could not be independently confirmed. Kaggle availability alone is not evidence of reuse rights. | Excluded from this task. Earlier analyses using these uploads are archived separately and are not presented as legally verified findings here. |
| [Racing Post terms](https://help.racingpost.com/hc/en-us/articles/208996085-Terms-and-conditions) | Public site terms limit the site and its information to personal, non-commercial use and prohibit other reuse without permission. | No automated collection or redistribution. |
| [BHA Racing Administration](https://support.racingadmin.co.uk/opencms/opencms/racing-admin-support/help-and-support/faqs/searching-for-fixtures-races/can-i-export-a-list-of-races/) | It documents CSV export of searched race records inside Racing Admin. That is an authenticated operational service, not a public open-data licence. | Not treated as a public bulk dataset. |
| [UK Racing Data](https://ukracingdata.co.uk/terms-of-use/) | Offers UK/Irish results, tools and archived daily race pages, but its terms allow viewing and downloading for personal, non-commercial use only and prohibit copying/exploitation without written permission. | Excluded for bulk/commercial project reuse without permission. |
| FlatStats CSV downloads | A download page exists, but no reuse licence for this task's intended use was confirmed. | Excluded absent explicit permission. |
| [The Racing API Free](https://www.theracingapi.com/terms-of-service) | Available free racecards and current-day summary results do not provide the multi-year runner result history needed here. | Not sufficient for the requested historical replay. No account tier was changed. |
| Sectionals | Public viewing of RaceiQ or other sectional pages does not itself grant rights to bulk extract/reuse. No zero-cost open licensed NH sectional archive was verified. | No sectionals used. |

## What the free sample can and cannot support

The RacingFormBook field documentation describes a recorded elapsed time for the race and a total beaten margin for each runner. It does **not** document separate elapsed times for every horse or sectional splits. Deriving a horse time from winner time plus margin requires a seconds-per-length conversion; research/speed_replay.py marks that conversion as an assumption and does not describe the output as an official speed figure. The existing workbook contains the aggregated audit, not the source's runner-level rows.

The sample's one-week window also cannot supply earlier horse performances or a reliable course/distance/going standard for that same week. A backtest that trains the standard from those same race outcomes would leak future information or have no eligible predictions. Its pre-race history and a larger licensed archive are the missing ingredients.

## Existing data and previous results

- PIF_Racing_Real_Data_Pilot.xlsx records the actual seven-day market-baseline calculation: 269 races and 2,492 runners; 27 hurdles, 8 favourite winners, −29.5% hypothetical industry-SP ROI. The race-level audit does not preserve the runner histories needed by the speed model.
- The original free sample's one-week window produced only 13 hurdle races whose titles included “Handicap”; 2 favourite winners and −56.5% hypothetical SP ROI. This title-substring classification is approximate and the sample is far too small to validate a method.
- Separate historical model reports in the project cover broad form models, not Andy Holding-style speed ratings. They relied on Kaggle source archives whose reuse rights are not established, so their results are not evidence for this requested licensed-data backtest.
- research/speed_replay.py is an executable, chronological research implementation. Synthetic tests validate code behaviour only; they are not real-data results.

## Raw files, conversion and integrity rules

Keep third-party source files in an untracked local local_data/ directory. Do not commit raw result files, odds archives, account credentials or API keys.

For a permitted RacingFormBook SFF conversion, preserve source columns and document every mapping. Useful mappings are ID→race_id, RaceDate→race_date, Course→course, Type=h→race_type=hurdle, Yards→distance, Seconds→official_time_seconds, Going→going, FPos→finish_position, TotalBtn→beaten_lengths, HorseName→horse_name, and decimal SP→sp_decimal. DistBtn is the margin behind the runner immediately in front and must not be substituted for TotalBtn. Verify handicap status from race conditions; do not classify solely from title text. RFB does not document a stable horse ID in these fields, so horse-name matching remains an identity limitation.

Do not fill missing race times, margins, going or prices. Exclude dead heats from the single-winner replay, and make predictions for a date before adding **any** race from that date to standards or horse history.
