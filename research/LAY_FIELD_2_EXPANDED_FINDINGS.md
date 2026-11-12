# PIF Lay the Field at 2.00 — Expanded 2023–24 historical study

**21 October 2026 · Research only · Not a matched-order backtest**

## Source and sample
Third-party archive of Betfair-formatted UK WIN CSVs: https://github.com/EonHorizons/betfair_sp (mirror not independently checked byte-for-byte against Betfair originals). We sampled every third file day, starting on the 1st, in April, July, September and November 2023 and January and March 2024: 63 complete daily files and 14,255 total source runner rows, covering jump as well as Flat races before filtering.

**996 valid Flat races** after excluding labelled hurdles, chases, NH Flat/bumpers, unknown distances or distances above 20f, and races without one clear winner. Event IDs, event dates and runner IDs prevent duplicate counting. File suffix dates can be a day different from EVENT_DT. Betfair's documented IPMIN field records the minimum matched in-play price but **only for trades with payouts greater than £100**. This is **NOT** proof that a £1 lay order would have been filled, nor a chronological price sequence.

## Main numerical findings at 2.00

- 425/996 races (42.7%) had two or more horses with an observed IPMIN at or below 2.00.
- 46/996 races (4.6%) had three or more.
- 3/996 races (0.3%) had four or more.
- Artificial gross return across all 996 races: **−£515** at £1 lay per price touch at 2.00, assuming perfect fills at the target price, **before commission**. Not an executable ROI, betting ledger or tradable edge.

### Runner count

| Runners | Races | 2+ touches | 3+ touches | 3+ rate |
|---|---:|---:|---:|---:|
| 2–6 | 152 | 86 | 12 | 7.9% |
| 7–9 | 427 | 192 | 20 | 4.7% |
| 10–12 | 330 | 114 | 11 | 3.3% |
| 13–14 | 70 | 28 | 2 | 2.9% |
| 15+ | 17 | 5 | 1 | 5.9% |

No evidence that starting with 10 runners is optimal. The 15+ sample is especially small, and all categories remain observational.

### Distance

| Furlongs | Races | 2+ touches | 3+ touches |
|---|---:|---:|---:|
| 5 | 131 | 44 | 7 |
| 6 | 192 | 76 | 10 |
| 7 | 198 | 76 | 8 |
| 8 | 191 | 91 | 8 |
| 10 | 99 | 43 | 5 |
| 12 | 64 | 33 | 3 |

No standout distance for three-or-more low-price runners. A more frequent two-runner outcome is not sufficient to produce a net profit at 2.00 after costs.

### Months

| Month | Flat races | 3+ price touches |
|---|---:|---:|
| Apr 2023 | 155 | 6 |
| Jul 2023 | 273 | 17 |
| Sep 2023 | 224 | 9 |
| Nov 2023 | 118 | 2 |
| Jan 2024 | 121 | 9 |
| Mar 2024 | 105 | 3 |

The different monthly rates reinforce the need for later held-out dates.

## Straight versus turning tracks: NOT established

Newcastle's all-weather flat course has a straight 5f-to-1m section and a turning course for longer races (official Newcastle site and Racing League course guide); Kempton's all-weather track runs around bends (At The Races course guide). However, this Betfair CSV archive has no independently verified event-level surface or track-layout field.

Across these six samples, only **1 of 93 Newcastle races** recorded three or more short-priced runners, but this figure **mixes straight and turning trips**. Do not use it as a straight-versus-bends comparison. The exceptional Newcastle 14-runner, 6f three-horse outcome in the owner's separate July 2026 sample is not automatically representative.

Useful sources:
- https://www.newcastle-racecourse.co.uk/raceday-experience/racecard-and-race-replays
- https://www.racingleague.uk/stories/newcastle-course-guide
- https://www.attheraces.com/course-guides/Kempton
- https://promo.betfair.com/betfairsp/prices

## Audit and boundaries

The repository research branch contains a standalone flat-only script, tests, all six month aggregate JSON files and the combined lay_field_2_expanded_2023_2024.json. No licensed raw runner CSVs, API secrets, or proprietary ranking formula were committed. No change was made to the live PIF Racing scanner or its qualifiers.

Limitations: third-party historical mirror; every-third-file-day sampling; race-type classification from terse Betfair labels, not externally joined official racecards; IPMIN price lows are not sufficient for £1 Keep lay fill simulation; no verification of liquidity, order queues, timestamps, partial matches or live availability. The −£515 result is an **illustrative perfect-fill calculation** that should not be interpreted as an actual trading result.

Next research requirement: obtain genuinely more recent 2025–26 files, independently verify event-level course/surface/layout, freeze pre-race covariates, test on a later chronological holdout, and paper-track actual execution separately before any trading recommendation.
