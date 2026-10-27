# ACTIVE SCANNER: PIF Racing V2 (Owner reset 24 October, live 27 October 2026)

The OLD 61-factor V1 interface is RETIRED, with its code preserved in Git history only. Public `index.html` redirects to `v2.html`, the sole active scanner interface. It must use only the authenticated private `POST /v2-races` endpoint, which serves independently trained V2 alpha rankings from `pif_racing/v2_reset.py`. Do not reconnect `v1.js`, `/racecards` legacy ranks, 61-factor CatBoost, old watchlists or speed-pilot formulas to the live V2 page. Historical data, race results, user sessions, existing back-end and provider secrets stay intact.

The deployed V2 alpha's softmax ranking shares are NOT independently calibrated win or place probabilities and it has NO proven betting/value advantage. New performance/time models require separate training and testing before deployment. Never display old qualifiers or present V2 shares as reliable win probabilities. The authoritative active specification is private `pif_racing/PIF_RACING_MASTER_SPEC.md` (V2 notice at top) and `pif_racing/V2_LIVE_RESET.md`. Legacy notes below are archived reference, not active instructions.

---

# PIF Racing scanner — development rules

PIF Racing's core selection formula is **private**. The authoritative rules live in the owner's **private** PIF Racing backend repository at `pif_racing/PIF_RACING_MASTER_SPEC.md`. Do not copy its detailed criteria, numeric thresholds, source code or proprietary research into this public static repo.

- The agreed system is **race-time-led**, inspired by Andy Holding's approach: legitimate course/distance standard times and going allowance, race strength, individual speed figures including beaten horses, separately verified sectionals if available, and future-race suitability **before** any evidence-based market comparison.
- The current form/trainer/rating watchlist is only a **legacy experimental demonstration**. Never rename it a validated PIF formula, predict win percentages from it, or present its output as betting recommendations.
- Do not add, tune, replace or promote selection rules without explicit owner approval and a separately documented chronological, market-relative test.
- Do not upload any historical licensed database, API credentials, private model/thresholds, or runner-level proprietary research artifacts to this public repository.
- Keep the existing mobile scanner available while the owner's private race-time engine is built and verified; no unsolicited cosmetic overhauls.
- If a task involves core model logic, change it in the private research/backend repository only and follow the private master specification.
