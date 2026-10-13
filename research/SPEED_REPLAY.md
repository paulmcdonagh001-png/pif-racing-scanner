# PIF Racing experimental speed replay

The replay in research/speed_replay.py implements a transparent speed-ranking hypothesis. It is inspired by comparing a runner's past performances with race conditions, but it is **not an Andy Holding rating, does not reproduce his method, and does not output win probabilities**.

## Data needed

One row per starter with:

race_id,race_date,course,race_type,handicap,distance_furlongs,going,official_time_seconds,finish_position,beaten_lengths,horse_name

horse_id is preferred. When absent, the program uses a normalised horse name (or runner ID) and identifies this as a proxy. sp_decimal (or decimal_odds) is optional. Prices are used only for a retrospective industry-SP comparison.

For the RacingFormBook SFF data, Seconds is the race's elapsed time, TotalBtn is the runner's total distance behind the winner, and SP is documented as decimal. DistBtn is the gap to the immediately preceding horse and is not the correct total margin field. Do not treat the scheduled RaceTime as a duration.

## Rating and replay rules

1. Restrict to hurdle handicaps. Handicap status must come from verified race conditions.
2. A race's standard is the median recorded winner time from earlier dates at the same course, half-furlong-rounded distance and normalised going. Default minimum: five prior races.
3. Convert the current race's total margin to an approximate time using 0.20 seconds per length (configurable). This is a disclosed provisional assumption, not a measured runner time.
4. The runner's performance index is 100 × prior standard time / estimated runner time.
5. Before each race, rank horses using the median of their last three comparable historical indices. Default minimum: two prior comparable starts. Same-day races are added only after all predictions for that date.
6. Skip races without a valid prior standard, at least two rated runners, a unique top rating, or a unique winner.
7. If decimal SP exists for every selection, report fixed one-unit hypothetical return at SP, with no commission or execution claim. Also report a one-unit-per-race favourite baseline with joint-favourite stakes shared equally.

## Limitations

- The seconds-per-length conversion varies with pace, distance, going and race shape; 0.20 is not calibrated.
- Course/distance/going standards may be sparse. There is no hidden fallback to unlike going or tracks.
- Horse names can collide, and the source does not document a stable ID in the SFF fields.
- Races with incomplete times, margins, ambiguous winners or missing prices cannot be silently repaired.
- Closing SP is an outcome-time benchmark, not timestamped pre-off market odds.
- No sectionals, jumping-efficiency observations, pace map or live going correction are included.

Run on a permitted, local CSV:

    python research/speed_replay.py --csv local_data/clean_results.csv --out local_data/replay.json
    python -m unittest discover -s research -p 'test_*.py' -v

The current tests use generated fixtures to verify chronology, tie handling, going separation, and output arithmetic. They are **synthetic tests**, not performance evidence. See DATA_SOURCES.md for the actual source-availability finding and REAL_DATA_BASELINE_2025.md for the separate real seven-day market baseline.
