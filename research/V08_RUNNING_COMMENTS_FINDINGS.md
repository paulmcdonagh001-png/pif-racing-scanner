# V0.8 — historical running-comment clues (14 October 2026)

**Result: no reliable improvement; personal retrospective research only. Do not enable automatic betting or value recommendations.**

The owner-provided RacingFormBook SFF 2025 and 2026 archives contain **48,860** completed hurdle runner records with written race comments. Those comments are a potential source of **qualitative prior form**, although they do not contain measurable furlong-by-furlong sectional times.

## Two tests performed

1. **Previous-run comment categories.** A transparent fixed rule dictionary identifies four clues in the horse's *most recent previous hurdle result*: (a) strong late finish, (b) interference/trouble, (c) jumping error, (d) fading. When evaluating a later British handicap hurdle, only **strictly earlier dates** may contribute to those flags. The observational cohort requires its previous hurdle finishing position to be 2nd–6th, with at most 180 days between runs. False positives from phrases such as 'same pace' and 'no extra' are excluded from 'strong finish.' Falling/pulled-up horses remain legitimate losing runners, not grounds for excluding entire races.

   | 2026 prior-running comment | Later runners | Winners | Final-SP market expected winners | Hypothetical SP ROI |
   |---|---:|---:|---:|---:|
   | Strong late finish | 101 | 20 | 18.49 | **−25.13%** |
   | Interference/trouble | 129 | 21 | 16.42 | −4.13% |
   | Jumping error | 1,038 | 139 | 136.31 | −22.80% |
   | Faded | 1,569 | 194 | 175.49 | −13.70% |
   | All comparable previous 2nd–6th finishers | 3,796 | 482 | 476.34 | −20.27% |

   Categories overlap. These are *observational cohorts*, not a validated selection policy. **2026 has already been viewed in earlier experiments and is not a pristine holdout.**

2. **Existing V0.4 form model compared with itself plus those four prior-running-comment flags.** Both variants train on 2025; 2026 has 876 eligible races and 7,559 runners. Model parameters and the population are identical; the only feature difference is the comment flags.

   | 2026 evaluation | Original form | Form + past comment flags | Final-SP market |
   |---|---:|---:|---:|
   | Runner Brier (lower is better) | 0.097954 | 0.097949 | **0.093132** |
   | Runner log loss | 0.337553 | 0.337489 | **0.315494** |
   | Top-rated horse won | **182** | 181 | — |
   | Hypothetical final-SP top-pick ROI | −22.69% | −24.36% | — |

   **The probability change is negligible, one fewer horse won, and theoretical ROI deteriorated.** The quoted market was a final-price benchmark only, not an obtainable early offer or a feature supplied to the model. A descriptive past race comment may be helpful to human analysis but these simple tags have **not demonstrated incremental predictive value**.

## Research integrity and next decision

- Races containing fallen, pulled-up or unplaced runners were *retained* where declared runner counts, SP and winner status were otherwise valid. An initial incorrect exclusion of all races containing non-finishers was corrected **before final reporting**.
- **Date-truncation check passed:** removing July–October 2026 source races did not alter any earlier comment tags/observations.
- Three synthetic tests passed: positive/negative phrase distinctions, separation of trouble/jumping/fading, and the strictly-prior-day lookup.
- Handicap classification uses race-title wording; horse identity depends on names and approximate age; revised post-race archives may not represent original pre-off card snapshots.
- Final SP is not verified pre-off, executable Exchange odds. No commission, liquidity or order fill is represented.
- **Decision:** keep the live PIF Racing Scanner and Research notebook unchanged. Do not claim value or publish unproven confidence percentages. No AI subscription, new odds feed or paid sectional data was required for this test.

A full **private** reproducible package, `PIF_Racing_V08_Comments_Backtest.zip`, was delivered to the owner's chat. It includes Python scripts, aggregate results and a runner-level audit file containing excerpts from the licensed historical archive. **Do not publish that runner-level file or the purchased SFF ZIPs to GitHub.** This public note intentionally contains aggregates only.

Next meaningful research: prospectively test more nuanced (and predetermined) running-style/context interpretations on genuinely future races and timestamped bookmaker/Exchange odds, instead of repeatedly tuning already inspected 2026 outcomes.
