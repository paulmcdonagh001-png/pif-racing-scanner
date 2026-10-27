# PIF Racing — ACTIVE V2 architecture (27 October 2026)

- **Main website:** https://pif-racing-scanner.onrender.com/ redirects to `v2.html`. Installed app starts at `v2.html`; old offline cache retired.
- **V2 backend:** Private service `pif-racing-paper` at https://pif-racing-paper.onrender.com, authenticated `POST /v2-races`, using existing session token and PIN. V2 model lives in the private repo `pif_racing/v2_reset.py`.
- **Data:** The Racing API Standard racecards, private PostgreSQL horse history, trainer/jockey observations, historical results. Existing ingestion, Render instances, protected database and licensed archives retained.
- **V2 result:** independent per-race top-three ranking research with indicative odds. Existing model's `research_share_pct` is NOT a calibrated win chance, place chance, profitable selection, or certified market value.
- **Legacy:** 61-factor V9 scanner interface (`v1.js`, Git history) and `/racecards` older research output are ARCHIVED for rollback/audit only. Never use them in V2's rankings, UI or value assessments. Historical ledgers remain preserved.
- **Status:** V2 experimental beta deployed, full validation and true win/place probability model outstanding. Never claim a proven betting edge or expose private thresholds/raw licensed data.
- **Service deployment:** Existing Render static-site service auto-deploys from `pif-racing-scanner/main`. Private backend auto-deploys from `pif-football/pif-racing-paper-v08`. No new paid service or added API subscription was created.

---

## Archived 14 October description

# PIF Racing — current architecture (14 October 2026)

## What is actually in use
- **PIF Racing Scanner:** `https://pif-racing-scanner.onrender.com`. Publicly reachable static mobile interface; saved personal assessments remain in each device's browser.
- **PIF Racing Data backend:** current internal Render service name `pif-racing-paper`, at `https://pif-racing-paper.onrender.com`. Holds the verified Racing API Standard credentials, uses the existing PostgreSQL **pif_racing schema only**, and serves the scanner's protected `POST /racecards` endpoint. The name can be changed in the Render UI later; it is not a different product.
- **Legacy service:** `pif-racing-feed` (the former free-card proxy) is no longer referenced by the mobile site's source. **Do not delete until the replacement scanner is tested with a private PIN.** Its credentials are not configured.

## Racing data and the research boundary
- Background collector added 14 Oct: Standard today's/tomorrow's racecards plus recent verified results; separate immutable card snapshots and completed result records in the `pif_racing` schema.
- A snapshot is flagged as pre-off only when its capture timestamp precedes the scheduled off. Final results cannot rewrite pre-race snapshots.
- An opt-in six-hour polling loop runs **only while the free Render instance is awake**. A twice-daily GitHub Actions health request attempts to wake it; timing and free hosting are **not guaranteed**.
- This data has **not** been combined with the private Stage 12 historical SQLite archive. That historical archive remains owner-only and has not been published to GitHub.
- No predictive win percentage, profitable model, trade entry instruction, or automated bet is activated. Betfair API authentication is a separate unresolved issue.

## Scanner protection
The `/racecards` endpoint restricts browser origin and requires a distinct `SCANNER_ACCESS_PIN` environment secret on the backend. The PIN is **not** the Racing API password or paper collector's admin token. Do not put provider credentials or private databases in this public repo. The PIN must be set privately in the backend Render service before the mobile scanner can load data.

## Next verification
1. Owner configures `SCANNER_ACCESS_PIN` privately in **pif-racing-paper** Render Environment; use a long random code.
2. From `pif-racing-scanner.onrender.com`, load today's racecards and verify matching names, dates, times, conditions and no browser CORS errors.
3. Check captured pre-off snapshots, later completed results, idempotent imports, and security.
4. Only then retire the now-unused `pif-racing-feed`; do not remove any data stores or other projects.
