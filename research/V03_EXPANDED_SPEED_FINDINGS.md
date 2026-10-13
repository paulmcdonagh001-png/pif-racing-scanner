# V0.3: broadened speed-method retrospective diagnostic (13 October 2026)

**Personal exploratory research. No verified betting edge; do not show these outputs as recommendations.**

The user supplied paid RacingFormBook SFF_2025.zip and SFF_2026.zip privately. The source archives must **not** be published, committed or redistributed. This aggregate report and standalone offline audit code were separately provided in `PIF_Racing_Expanded_Backtest_V03.zip` in the ChatGPT conversation. The live scanner remains unchanged.

## Chronological rule

Original V0.2 tested exact venue / 0.5-furlong / exact going match and returned only **7** 2026 selections, with at most 2–3 rated runners per field. The alternative V0.3 was explicitly defined before examining its outcomes:

- British hurdles only; **all hurdle results**, not merely prior handicap hurdles, can inform horse speed.
- Winner-time standards from previous dates for the same course, nearest 2-furlong distance and broad good vs soft going group, with at least 3 prior race standards.
- Estimated runner time = winner's official time + 0.20 seconds per beaten length; relative speed index = 100 × prior local time standard / estimated runner time.
- Horse score is median of up to 3 previous rated runs within 540 days, transferable across courses with their own time standards.
- Shortlist only British **handicap** hurdles, using race title as an unverified handicap proxy; require 60% field coverage, at least 4 rated runners, top horse with 2 past ratings, and ≥1 index point advantage over next rated runner. Maximum 4 selections per day.
- Same-day and future results never enter past speed calculation.

## Results: 2026 through 11 October

| Measurement | Result |
|---|---:|
| 2025 + 2026 SFF source runner records | 213,109 |
| Usable GB hurdle races for historical standards | 3,386 |
| Complete eligible 2026 GB handicap hurdle races | 876 |
| Races with enough field-rating coverage | 852 / 876 |
| Candidates before daily cap | 352 |
| Shortlist after cap | 345 |
| Winners | 50 / 345 (14.49%) |
| Hypothetical £1 per selection, *final bookmaker SP* | **−92.46 units (−26.80% ROI)** |
| Same-race final-SP favourite retrospective benchmark | **−24.54% ROI** |
| Market-SP-normalised expected winners among speed candidates | **57.31** |
| Observed minus market-expected winners | −7.31 (approx z −1.12; no reliable uplift) |
| Longest losing streak | 35 |

The earlier 7-selection +73.8% theoretical result was **underpowered and misleading as evidence**. Broader field coverage alone did not establish useful predictions.

The current SFF `Sp` field is a **fractional final SP**, not a timestamped/executable pre-off quote. The ratings are **not win probabilities** and no value bet can be inferred. Source going/titles may reflect amended final race data, and horses are keyed by name, not stable provider IDs.

**Anti-leakage test:** deleting all 2026 races from 1 July onward did not alter any of the **276** predictions dated before July.

## Decision

**Freeze V0.3 as an unsuccessful speed-only baseline; do not deploy to the current PIF Racing Scanner or use for money.** Next research iteration needs a genuinely distinct multi-factor model combining speed with official rating and weight, class, recent performance and relevant conditions, and eventually timestamped obtainable odds. Evaluate probability calibration against market expectations before producing any value or confidence labels. Avoid optimising repeatedly to already inspected 2026 outcomes.

No further data purchase or commercial API upgrade is justified on these findings.
