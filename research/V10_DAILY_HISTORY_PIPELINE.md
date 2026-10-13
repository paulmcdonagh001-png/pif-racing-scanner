# Stage 10 — daily historical-research cycle (14 October 2026)

**Implementation:** a private offline add-on and tested CLI delivered as `PIF_Racing_Stage10_Daily_Engine.zip`. **NOT deployed to Render, NOT automatically collecting live data, and NOT a validated winner-prediction/value model.**

## Completed

- Preserved owner-supplied V0.9 RacingFormBook history: **23,216 races / 213,109 runner records** from 2025–11 October 2026; the original licensed source database is **not** committed to GitHub.
- Built `pif_racing_daily_cycle_v10.py` integrating with V0.9 `pif_racing_history_engine.py`.
- One pre-race evidence profile *per declared runner*, with wins/top-three form, last five races, past course, comparable distance, matching going, days since previous recorded appearance, and trainer's preceding 30 days. Uses **strictly previous calendar dates**.
- Preserved individual observation snapshots, with the latest valid **before-off** capture selected. Later/post-off cards cannot change earlier feature snapshots.
- Added optional owner-imported licensed result CSVs. Full runner results are only accepted if race ID, date and horse match a saved card; duplicates are no-ops and conflicting rows are rejected. Results live in a **separate outcomes table**, never changing past features.
- **Nine offline synthetic integrity tests passed** (six Stage 10 plus three V0.9).
- One **historical** SFF replay on 15 September 2026 confirmed the query can build profiles from the historical database. This is **not** a prospective test or profitable selection claim.
- Packaged private **Windows morning.cmd and evening.cmd** starters that use environment-managed free Racing API credentials; the tool itself doesn't handle or embed credentials, and it doesn't create scheduled tasks on the user's PC.

## Data source facts

The Racing API Free endpoint `/v1/racecards/free` supplies today and tomorrow runner lists, while `/v1/results/today/free` provides only race-level results summaries. Full runner outcomes are not present in the free endpoint; the corresponding individual result endpoint requires **Standard**. See https://api.theracingapi.com/documentation .

Thus the snapshot workflow can collect daily **card information** from the existing Free account on the owner's own computer once credentials are set; a full daily historical-results update cannot be claimed until complete licensed result records become available.

## Hosting boundary and further work

The existing Render `pif-racing-feed` is a Free Python web service **without durable attached storage**, and the published scanner is a static site. Neither can privately and durably host the ~201MB purchased SQLite archive in their present configuration. Other Render Postgres databases are currently in use by separate products. **Do not change or populate their tables or add a paid service without explicit owner approval.** Do not commit/archive any raw paid historical data or runner comments in the public repository.

The V1.0 private archive itself already holds the 2025/2026 history; no live 14–15 October 2026 cards/results were ingested into that copy during this build. True unattended multi-day ingestion requires a dedicated private data store and permissioned complete-results feed; no recurring job has been enabled.

## Research conclusion

This is **a data-collection and validation milestone**, *not* a new successful backtested model. Do not show any of the historical evidence counts as calibrated winning probabilities or recommend money staking based on them.

Package (supplied in the user's chat): `PIF_Racing_Stage10_Daily_Engine.zip`. It contains the two stdlib Python scripts, two test modules, Windows starters, an example results CSV header, and usage/licensing notes; it intentionally **excludes** the licensed database, source ZIPs, and API credentials.
