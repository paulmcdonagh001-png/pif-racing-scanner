# PIF Racing V0.7 — class-aware audit and prospective research pilot

**14 October 2026 | Private research | No evidence of profitable betting value**

## The layman's answer

We asked whether beaten horses from unusually fast hurdle races became more likely to win next time when we compare those previous races against the **same standard of opposition**, rather than simply rewarding the strongest classes. The new method identifies races that were relatively fast compared with earlier **same-course, near-distance, going and class** races.

**2026:** We followed 350 horses at their next hurdle start, after finishing 2nd–4th and within 10 lengths of the winner in a previous flagged race. **72 won (20.6%).** The bookmaker closing market, normalized within each field, implied around **73.1 winners**. A hypothetical £1 at the final bookmaker SP on each selection returned roughly **−30.75% on stakes**. This is not a validated or executable betting return, and it does not show that our signal beats the market.

**2025 (warm-up-heavy exploratory group):** 215 such next-run observations, 51 winners, 42.93 market-expected; retrospective SP return **−2.99%**. The stronger 2025 win count failed to carry over to 2026. Both years have already been repeatedly examined across model versions.

## What was changed

- 2025–11 October 2026 archive: **213,109** runner records; **3,386** British completed hurdle races passed the existing cleaning routine.
- The new comparison uses the median winning time of **at least three previous racing dates** at the same course, rounded two-furlong distance, broad going category **and class**. Same-day results are held back.
- Each meeting can tag **at most one** class-relative fast race if the index is at least 100. This is a *relative finishing-time* screen, not race-pace/sectional analysis.
- We follow a horse's next hurdle race, within 150 days, provided it previously finished second, third or fourth within 10 lengths. We measure next wins against the final SP market, not against subjective confidence.
- This tighter method could score only **1,654 of 3,386 races**, because exact comparable races are thin in higher classes. It tagged 427 meeting leaders; this is not evidence of exceptional sectionals.

## Detailed results

| Year / preceding race tag | Subsequent starts | Next winners | Normalized final-SP expected wins | Hypothetical final-SP ROI |
|---|---:|---:|---:|---:|
| 2025 class-relative fast | 215 | 51 | 42.93 | −2.99% |
| 2025 other comparable | 513 | 90 | 92.30 | −22.45% |
| **2026 class-relative fast** | **350** | **72** | **73.11** | **−30.75%** |
| 2026 other comparable | 1,174 | 209 | 213.05 | −21.56% |

Deleting all 2026 races dated 1 July or later left all **1,848** earlier observations and previous-race tags unchanged. This checks chronological leakage *in the code*, but does not establish historical point-in-time correctness of all source racecard/going fields.

## What's now available in the scanner

A separate **Race Research** page is accessible from the scanner navigation (`/race-research.html`). It does **not** rank horses, retrieve licensed sectional data or place bets. It provides a practical prospective evidence workflow:

1. Following a race, make an **original qualitative note** on an interesting horse, referring to the date, course, class and reason (late progress, high-quality race, jumping, changes of conditions).
2. When that horse next runs, record a **before-the-off** assessment, UK scheduled off time, manually seen decimal odds (optional), and a reason. The snapshot is frozen in the user interface with an automatic device-clock timestamp.
3. After the race, record won/lost/non-runner. An optional CSV/JSON export captures passes as well as watch decisions, avoiding selective recollection of wins.

**Limits:** local browser storage only; no cross-device sync; no server-side immutable timestamp; the device clock and browser data can be manipulated; old positions and quoted prices not independently verified. Not an automated qualifier, not a predictive probability, not evidence of value. Export backup often.

## Sectionals and lawful data access

Racing TV's RaceiQ sectionals are free to **view**, but their terms restrict copying, storage and commercial/automated use. We have **not** copied numerical RaceiQ sectional data into PIF Racing or scraped their site. The new notebook requests original observational notes, not copied tables. A prospective commercial sectional API requires permission/licensing.

Official references:

- [RaceiQ sectionals guide](https://www.racingtv.com/raceiq/sectionals-tab)
- [Racing TV reuse restrictions](https://www.racingtv.com/terms-conditions)
- [RaceiQ API enquiry](https://raceiq.com/betting-services/)

A **Gmail draft**, not sent, was prepared to request access to a small evaluation dataset and licensing guidance. No payment or subscription has been agreed.

## Decision

**Don't deploy an automatic class-relative speed qualifier.** Maintain the historical model as a failed/neutral benchmark. Start observing new races prospectively with the research log; measure whether it improves actual predictions *and* whether any timestamped, attainable price edge exists. Seek a permitted small sectional dataset before attempting genuine pace/sectional replication. No new spending justified.

## Files

- `pif_racing_v07_class_model.py`: reproducible private audit using the separately supplied paid archives.
- `v07_results.json`: full aggregate diagnostic.
- `v07_class_coverage.csv`: coverage versus class.
- `race-research.html`: standalone client-side research log (also committed separately to GitHub).
- The paid SFF CSV/ZIP source data and detailed race-by-race derivatives are **not** included in the public GitHub repository or this ZIP.