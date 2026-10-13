# RacingFormBook SFF 2025–2026 — frozen shortlist diagnostic

**Research date: 13 October 2026. Personal/non-commercial experiment.**

The user supplied one-off RacingFormBook SFF 2025 and 2026 archives (the 2026 file ends 11 October). **Do not commit, publish, or redistribute source CSV/ZIP content.**

## One-pass chronological evaluation

The existing `research/daily_shortlist.py` approach was reimplemented in a standalone offline audit without tuning parameters to 2026 outcomes: British handicap hurdles; five previous-day or older comparable winning times; same course, rounded half-furlong and normalized going; estimated horse time = official winner's time + 0.20 seconds per beaten length; horse median of up to three previous exact-condition speed indices with two required; >=1 speed-index point clear lead over the second rated runner; maximum four selections per day. Same-day and future outcomes are excluded from past-form inputs. The handicap flag in SFF was proxied from the title because an explicit boolean was not present; this needs independent validation.

- 2025: 13,013 races / 119,538 runner rows.
- 2026 through 11 October: 10,203 races / 93,571 runner rows.
- British handicap hurdles with valid metadata: 1,244 in 2025 and 878 in 2026.
- 2026: 223 races met the five-prior-standard test. 210 had fewer than two historically rated entrants; six failed the one-index-point gap; **seven qualified**.
- Seven selections: three won; hypothetical equal-unit return at **final bookmaker SP** was +5.1667 units / +73.81%; strike rate 42.86%; longest losing run two, maximum drawdown two units.
- All seven came from Uttoxeter or Worcester, and all had only two or three historically rated horses in the full eight-to-sixteen-runner field. The same winner (Cawthorne Banker) appears twice. This sample **does not** demonstrate a predictive edge or a reliable market-beating method.

The SFF `Sp` field encodes **fractional** SP (profit per one unit on a winning bet). Those are retrospective outcome prices, not timestamped tradeable odds. No probability calibration, live odds or liquidity/commission assumptions were involved. The score is not a win percentage, value assessment, Andy Holding proprietary model, or the planned multi-factor PIF formula.

## Decision

**No stakes, no claims of expected ROI, no threshold-tuning to these seven outcomes, no new data purchases.** Keep the mobile scanner operational and unchanged. Maintain a chronological, append-only paper-selection ledger in future. A broader candidate model requires an independently specified evaluation and should not be presented as already validated.

The full audit report, list of seven historical selections, independent result verification and offline backtest script were delivered separately to the user's conversation as `PIF_Racing_SFF_2025_2026_Backtest.zip`—no paid raw data included.
