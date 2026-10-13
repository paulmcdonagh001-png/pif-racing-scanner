# PIF Racing — real-data market baseline (28 April–4 May 2025)

**Purpose:** preserve the genuine seven-day market-baseline calculation separately from any speed-model test.

**Source:** user-provided RacingFormBook SFF sample and the project workbook PIF_Racing_Real_Data_Pilot.xlsx. The source site documents a race elapsed-time field (Seconds) and runner result fields including positions, winner margins, and decimal SP. The workbook analysed here is a race-level audit and does not include the horse-history rows needed to replay a speed rating.

**Sample:** 269 completed races and 2,492 runners across seven days. This is a very small retrospective market baseline, not an Andy Holding-inspired speed-rating backtest.

Method: one hypothetical £1 total stake per race on the lowest industry-SP horse(s), split equally for joint favourites; settle at recorded starting price. SP is observed at the off, so this is not proof of a price available when an earlier prediction would be made. No Exchange commission or execution is modelled.

| Race type | Races | Favourite wins | Strike rate | Net units | ROI |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hurdle | 27 | 8 | 29.6% | -7.96 | -29.5% |
| Chase | 28 | 14 | 50.0% | +4.03 | +14.4% |
| Flat turf | 158 | 62 | 39.2% | -12.99 | -8.2% |
| All-weather flat | 49 | 17 | 34.7% | -11.08 | -22.6% |
| NH flat | 7 | 2 | 28.6% | -1.88 | -26.8% |
| ALL | 269 | 103 | 38.3% | -29.88 | -11.1% |

Within the hurdle subset, 13 races had “Handicap” in the title: 2 favourite wins, −7.34 units and −56.5% hypothetical ROI. This is a case-insensitive title-substring classification, not a verified race-condition field. It is not a speed-model result and is too small to infer an edge.

## What this establishes

These are real race outcomes and recorded industry SP from the seven-day sample. They show the arithmetic market baseline for that week. They do not show that any speed rating was available before a race, and they do not validate a strategy.

## What remains unavailable at £0

The seven-day sample does not contain the 2022–2026 prior history needed to calculate and test horse speed ratings chronologically. The workbook only retains aggregate race records. The provider's back catalogue starts in 2016 but is paid. No legally clear, zero-cost multi-season UK/Irish National Hunt dataset was verified, so the speed replay has **no genuine historical selections, strike rate, ROI or losing-streak result** at this point.

The earlier Kaggle-based form-model reports are separate: their source rights and provenance are unverified, and they did not test the speed model. They are not included in the reported figures above.

**Existing mobile scanner unchanged.**
