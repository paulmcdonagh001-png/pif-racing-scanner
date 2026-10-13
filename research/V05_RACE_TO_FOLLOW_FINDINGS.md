# PIF Racing V0.5: race-to-follow research (14 October 2026)

**Status: exploratory, negative market-edge finding. Personal research only. Not deployed to the live scanner.**

## What changed

Andy Holding's own explanations emphasise assessing *how strong the previous race was*, not merely the past speed rating of an individual horse. His National Hunt research considers a race's overall speed **and final-circuit sectionals**, with a 'True' designation for certain standout races. See:
- https://andyholdingspeedfigures.co.uk/national-hunt-figures-explanation/
- https://www.oddschecker.com/tips/horse-racing/20200509-andy-holding-betting-tips

Our private, paid 2025–2026 RacingFormBook SFF archives contain overall winning times, beaten lengths, course, distance and going, but **not final-circuit splits**. This pilot is therefore **not his system**. It tests whether horses placed behind the winner in a *fast-looking* prior hurdle race perform unusually well on their next start.

### Historical test rules (not tuned for profitable selections)

1. Earlier-date course, rounded 2f-distance and broad going benchmarks, at least three prior official winner times.
2. Estimate an approximate daily going effect from **other races at the same meeting** with benchmarks (leave-one-out median winner-time difference per furlong, capped ±1.5 s/f), acknowledging major race-class/pace confounding.
3. Label at most one race per meeting as strong: highest adjusted total-time index at that meeting and index ≥100. **This is not a true sectionals/pace measure.**
4. Follow horses from such a race if they placed 2nd–4th, beaten ≤10 lengths; count their next hurdle run if within 150 days.
5. Evaluate wins against the normalized *final bookmaker SP* benchmark; compare a control of similar beaten horses from other assessable previous races.

## Retrospective findings

| Next-run cohort | Entries | Winners | Market-expected winners at final SP | Hypothetical SP ROI |
|---|---:|---:|---:|---:|
| 2025 strong prior race | 327 | 63 | 62.18 | −23.59% |
| 2025 other prior race | 963 | 174 | 178.35 | −23.50% |
| **2026 strong prior race** | **460** | **90** | **95.01** | **−13.38%** |
| 2026 other prior race | 1,504 | 264 | 264.61 | −21.15% |

The strong-prior-race cohort's 2026 strike rate was 19.57%, versus 17.55% for controls. **That is not evidence of value:** it won less often than the final market prices predicted, and the hypothetical returns were still negative.

- Input: 213,109 source runner rows, 3,386 clean GB hurdle races.
- The peer-adjusted benchmark was available in 2,331 hurdle races; 608 were tagged strongest-at-meeting with index ≥100.
- Removing all 2026 races from July onward left all **2,823** earlier next-run observations, group labels and previous-race scores unchanged (chronology audit).
- 2026 was examined in prior pilot iterations; this is *not* a fresh independent holdout. Final SP is not an executable early price. Simple comparisons ignore correlation between runners in the same race.

## New freely viewable reference — but restricted reuse

Racing TV / RaceiQ say their result pages provide sectional times and pace information for British and Irish races, freely viewable without login:
- https://www.racingtv.com/raceiq/sectionals-tab
- https://raceiq.com/raceiq-metrics-now-available-for-free-on-racing-tv-platforms-in-time-for-cheltenham-festival/

**Free to view does not mean free to ingest into a commercial scanner.** Racing TV's terms restrict storage and repurposing. Do not scrape, copy its numeric data into project datasets at scale, or display third-party sectionals in the scanner without a relevant licence/permission:
https://www.racingtv.com/terms-conditions

## Decision / next step

**No deployment or betting recommendations.** The reasonable next hypothesis is whether **genuinely strong final-circuit sectionals** and well-performing beaten horses give predictive information beyond final-SP market expectations. Conduct a *small permitted/manual source-review pilot*, obtain formal data reuse rights before automated ingestion, and reserve genuinely future observations for validation. No paid data/API purchase is justified yet.

Reproducible offline V0.5 script, audited user-owned observation data and a plain-English report were provided to the user in `PIF_Racing_V05_Race_Quality_Backtest.zip` and **not uploaded to GitHub**. Original paid SFF files remain private.
