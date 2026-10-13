# Experimental daily shortlist

`daily_shortlist.py` reuses the project's historical speed-rating idea for a
pre-race card. It analyzes handicap hurdles, then returns only a uniquely clear
top prior-speed candidate per qualifying race, capped at four for the day. A
race with too little comparable history or a near tie is silently filtered out.

This is a research prototype; it is not Andy Holding's proprietary method,
does not estimate win probabilities, and does not declare a price to be value.
The decimal odds field is only carried through if the caller supplies it. A
separate, licensed odds feed and probability calibration are still needed
before the output can be described as a betting-value shortlist.

## Inputs

Supply two CSVs, kept locally and used under the source licence. Historical
file: one row per runner with these columns:

`race_id,race_date,course,race_type,handicap,distance_furlongs,going,official_time_seconds,finish_position,beaten_lengths,horse_name`

`horse_id` is preferred if the permitted source provides a stable identifier.
Today's card uses:

`race_id,race_date,course,race_type,handicap,distance_furlongs,going,horse_name`

Optional card fields are `horse_id,race_title,off_time,decimal_odds`. Use
decimal odds only, and include them only when the provider permits this use.
Keep raw files, credentials, and API keys out of Git.

RacingFormBook's SFF export maps `RaceDate` to `race_date`, `Course` to
`course`, `Type=h` to `race_type=hurdle`, `Yards` to furlongs (yards / 220),
`Seconds` to `official_time_seconds`, `Going` to `going`, `FPos` to
`finish_position`, `TotalBtn` to `beaten_lengths`, `HorseName` to
`horse_name`, and decimal `SP` to `decimal_odds` only when representing a
historical close. `DistBtn` is the gap to the previous finisher, not the
runner's total margin behind the winner. Confirm handicap status from race
conditions; do not infer it from a title substring. The source archive does
not provide per-runner elapsed time or sectionals in these fields.

## Run

```sh
python research/daily_shortlist.py \
  --history local_data/permitted_history.csv \
  --card local_data/today_card.csv \
  --out local_data/today_shortlist.json \
  --ledger local_data/predictions.jsonl
```

The JSONL ledger appends a timestamped pre-race snapshot. It does not overwrite
predictions with outcomes. Results and settlement should be stored separately
and joined by race/horse identity after the race; this keeps the prediction
record auditable. `local_data/` is deliberately not supplied or committed.

## Method and limits

- Standards use only earlier handicap-hurdle winner times at the same course,
  half-furlong-rounded distance and exact normalised going. Five prior races
  are required by default.
- Runner elapsed time is estimated as winner time + 0.20 seconds per beaten
  length. This is a disclosed, configurable approximation; it varies with
  pace, trip, ground and race shape.
- Past speed index is 100 × prior standard / estimated runner time. A horse's
  score is the median of up to its last three exact-condition performances;
  two prior starts are required by default.
- Predictions use only performances dated before the card date. Same-day
  results are never made available to the card.
- Candidate must lead the second-rated horse by at least one index point by
  default. This is a transparent initial filter, not an optimized threshold.
- No market data are fetched. Odds supplied by the caller do not alter the
  ranking. No break-even price is shown because the score is not a calibrated
  probability.

All tests use synthetic rows to verify ranking, tie filtering, scope and future
data exclusion. They are not genuine backtest results. Do not interpret this
code as evidence of betting profitability.
