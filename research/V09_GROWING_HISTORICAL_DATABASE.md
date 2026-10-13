# V0.9 — Growing PIF Racing historical database (14 October 2026)

**Status:** Private offline database *built* from the two owner-supplied, purchased RacingFormBook SFF archives. Daily live automation **NOT yet enabled**. No model has demonstrated a profitable edge.

## Starting dataset

- 2025 SFF: 13,013 races / 119,538 runner rows.
- 2026 SFF (through 11 October): 10,203 races / 93,571 runner rows.
- **Combined: 23,216 races / 213,109 runner-performance records.**
- 85 course-name variants, ~31,670 distinct horse-name proxies, 1,373 trainer names and 1,739 jockey names.
- All original race and runner columns, including comments, winning time, going, total beaten margins, class, handicap ratings, weight and fractional SP, were mapped and preserved.
- Six ambiguous repeated race/horse/card combinations in 2025 were **retained and flagged for future modelling QA** (not silently discarded).
- The resulting SQLite DB passed integrity checks; a repeat import produces zero new rows.
- Python standard-library-only **private** importer, CLI snapshots, three synthetic tests, a database and full owner documentation were delivered separately as `PIF_Racing_V09_Master_Private.zip` to the owner. **Do not publish these raw database bytes, comments or original archives in this repository.**

## Correct daily cycle

1. **Pre-race** — Read permitted current/tomorrow's cards with stable external race and horse IDs. Create timestamped snapshots *before the race*. For each horse, derive features exclusively from older history. Record model version, selection and offered odds (if obtainable).
2. **Post-race** — Ingest actual result metadata; only append a full runner result when the source provides all finishing positions and required information.
3. **Analyse** — Update historical horse, course, trainer/jockey and condition tables. Evaluate the frozen predictions versus actual results, an appropriate market benchmark and costs.
4. **Review model separately** — Do not auto-adjust model thresholds based on that day's outcomes; periodic held-out evaluation is required to prevent overfitting.

The free Racing API *does provide* racecards today/tomorrow and `/v1/results/today/free` basic **race-level summaries**. **It does not provide a complete runner-by-runner result in that free endpoint.** Full results require another permissioned source; the API historical and individual race result endpoints are Standard-level. Official docs: https://api.theracingapi.com/documentation

## Deployment and licence boundary

- Owner's current scanner static-site service is auto-deployed from public GitHub; **never commit purchased data/DB to it**.
- Owner's current free feed service has **no durable attached disk**, so it must not be used as the sole 24/7 database location.
- This initial archive is currently a **downloadable private local database, not a hosted automatically updating backend**. The CLI can explicitly fetch today's/tomorrow's permitted card data using API credentials passed only through a private environment. It does not run on a schedule yet and has not fetched any new day.
- Source holder cautions against non-personal commercial reuse without written permission. Confirm relevant storage/distribution rights before deploying subscriptions or publishing analysis built from their dataset.
- Horse names are only provisional identity keys; do not merge ambiguous names or claim 31,670 independently verified horses.
- **Next blocker:** find a durable, permissioned post-race *all-runner* data flow and safe private storage before switching on scheduled ingestion.

**Outcome:** The database foundation exists, with a tested path for additive daily snapshots. The system is *not* yet continuously running or auto-learning, and it is not producing validated win probabilities/value decisions.