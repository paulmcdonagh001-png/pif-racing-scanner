# Zero-cost forward data collection

New module: `research/collect_free_data.py`. Uses The Racing API's **Free** endpoints for today's and tomorrow's racecards and **today's race-level results summaries**.

**Important:** The Free results endpoint returns only race-level summaries, *not* runner-by-runner finish positions or winner data, official times or sectionals. Therefore these snapshots are **not sufficient to backtest a speed-figure method or measure wins/ROI**. Do not mislabel them as completed results.

The snapshots are stored in a local SQLite file, separate from the existing PIF Racing mobile scanner.

Usage (when the environment is configured with credentials; never commit secrets):

```bash
python research/collect_free_data.py --database local_data/racing_snapshots.sqlite
python -m unittest discover -s research -p 'test_*.py'
```

This is an **on-demand command**, not yet a scheduled collection service. It does not connect to the deployed Render app. Free Render local disk storage is ephemeral, so running this on Render without persistent storage would **lose historical snapshots on redeploy/restart**. Daily durable collection still needs an approved persistent-storage design. Store the database locally and back it up securely; don't push the raw data into the public GitHub repository.

Why keep collecting? Long-term racecards and metadata can help document pre-race fields and course/going conditions, and prevent retrospective feature leakage. To measure model accuracy we still need authentic runner results and race times from a permitted source.

Read `research/DATA_SOURCES.md` for restrictions, and `research/REAL_DATA_BASELINE_2025.md` for the 269-race market baseline. No subscription, betting action or automatic live deployment is involved.
