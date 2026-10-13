# V0.6 — class-bias and real-race sectional review

**Research: 14 October 2026. Private/experimental. No new race recommendations or model deployment.**

The previous [V0.5 race-to-follow experiment](V05_RACE_TO_FOLLOW_FINDINGS.md) used retrospective winner times from the user's private RacingFormBook SFF 2025–2026 history to find the quickest adjusted hurdle race at each meeting. V0.6 has identified a critical bias: **faster classes receive more 'strong race' tags**. That is unsurprising, but it prevents us treating these tags as proof of exceptional performance or as Andy Holding's sectional 'true race' designation.

## Class bias: actual historical audit

Among **2,331** races with an assessable V0.5 historical-time index:

| Race class | Assessable races | Flagged strongest | Flag rate |
|---|---:|---:|---:|
| Class 1 | 72 | 27 | **37.50%** |
| Class 2 | 114 | 47 | **41.23%** |
| Class 3 | 230 | 88 | **38.26%** |
| Class 4 | 1,167 | 309 | **26.48%** |
| Class 5 | 748 | 137 | **18.32%** |

Class 1 is about **2.05 times** as likely to receive our "strong race" tag as Class 5. **This is descriptive** and does not establish a causal effect or a profitable signal. It demonstrates a necessary adjustment: compare race performance within appropriate class/ground/distance/course standards before identifying an exceptional race.

## Real-race source spot check: Chepstow 10 October 2026

Our own private V0.5 time score named the 16:02 *Wasdell Group Silver Trophy* (Class 1, internal index **103.70**) as the meeting leader; the 16:35 *Dragonbet John Ayres Memorial* (Class 4, index **94.94**) rated lower. A separate Class 2 race that afternoon was also relatively high. This supports investigating **class confounding**, not presuming the first race must produce next-time winners.

- [Racing TV 16:02 results + RaceiQ](https://www.racingtv.com/results/2026-10-10/chepstow/1602)
- [Racing TV 16:35 results + RaceiQ](https://www.racingtv.com/results/2026-10-10/chepstow/1635)

The official result/metrics pages permit a **manual conceptual review** of finishing speed, performance at obstacles and intra-race position changes. A high **Finishing Speed Percentage (FSP)** means the average speed in a jumps race's *final four furlongs* exceeded its own race-average speed. It **does not prove** strong *absolute* race speed: pace might have been slow early.

RaceiQ describes **Time Index, Par Time and Par Sectionals specifically for Flat**; do not silently treat those as a validated hurdle-race class correction. Source:
- https://www.racingtv.com/raceiq/glossary
- https://www.racingtv.com/raceiq/sectionals-tab
- https://raceiq.com/raceiq-metrics/

## Data rights / what has not been done

Racing TV data is free to **view** in results pages, but its [terms](https://www.racingtv.com/terms-conditions) restrict copying, storage, repurposing and commercial use. No automated extraction/copying of its numeric sectionals has been performed or stored; no scraping script or unofficial RaceiQ ingestion is implemented.

Commercial/automated integrations require rightsholder clarification:
- https://raceiq.com/contact/
- https://raceiq.com/betting-services/
- https://www.totalperformancedata.com/live-pr-api-2/ (historical/sectional API; pricing on request)

## The next study: genuinely new future observations, not tuned hindsight

1. Freeze a source-permitted prior race strength comparison **within class, going, track and distance**, using only past-race benchmarks.
2. Distinguish *finishing quickly because early pace was slow* from a full performance with demonstrably demanding pace.
3. Inspect **horse-level jumping efficiency and progress through the field**; not just official finishing place.
4. Establish a **time-stamped, before-the-off paper watchlist** for later starts and log what price was actually available, where legally/permitted.
5. Check whether these horses outperform similar horses from ordinary prior races *and* an appropriate observed odds benchmark. Report all failures, sample coverage, losses and uncertainty.

**V0.6 is a diagnostic audit, not a new backtested selection model.** The preexisting V0.3, V0.4, and V0.5 methods failed to establish an odds-adjusted positive expected value. Do not deploy these unproven signals to the live PIF Racing Scanner and do not recommend real staking.

The reproducible private script and aggregate class report are provided in the separate user download `PIF_Racing_V06_Sectional_Research.zip`. The paid SFF data and private race-by-race results remain **off GitHub**.
