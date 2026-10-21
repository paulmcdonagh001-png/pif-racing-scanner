# Lay the Field at 2.00 — independent research only (21 October 2026)

This study **does not change** the live PIF Racing horse-ranking formula, current qualifiers, backend model, odds, or website. Nothing places bets.

## The question

Which **pre-race characteristics** of a UK flat or all-weather race are associated with **at least three different runners reaching in-play odds of 2.00 or shorter**? Two matched lays would only break even before costs if the eventual winner is among them.

Test (do not assume): runner count; 5f/6f/7f vs longer distances; straight vs turning segments; all-weather vs turf; handicaps vs non-handicaps; and **pre-off** market competitiveness.

## Recovered pilot: observed price lows, not confirmed fills

A previously submitted UK WIN Betfair file contained 43 races/416 runners on 25 July 2026 (although the filename contained 26 July). The raw file is not in this public repository.

- 28 races: **one** runner IPMIN <=2.00.
- 14 races: **two** runners IPMIN <=2.00.
- 1 race: **three** runners IPMIN <=2.00.
- Hypothetical across all 43 races at £1 lay per price touch at 2.00: **-£27.00 gross**, assuming every observed touch became a full matching order at 2.00. This is NOT observed betting P/L.

| Distance | Races | 2+ touches at 2.00 |
|---|---:|---:|
| 5f | 7 | 1 |
| 6f | 11 | 4 |
| 7f | 4 | 0 |
| 1m | 9 | 5 |
| 1m4f | 6 | 3 |

| Actual runners | Races | 2+ touches at 2.00 |
|---|---:|---:|
| 4–6 | 11 | 6 |
| 7–9 | 10 | 3 |
| 10–12 | 11 | 4 |
| 13–14 | 6 | 2 |
| 15+ | 5 | 0 |

The single three-runner case was a 14-runner Newcastle 6f novice stakes at 14:39. Winner Asander recorded 1.01; beaten Mollisha 1.01; beaten Mirzimaan 1.23. This does **not** prove that a lay on all three could have been filled at the displayed price.

**Neither a minimum of 10 starters nor straight sprints have been established as the optimum.** Data are a single day, and not all courses' exact surface/layout have been independently verified by race.

## Repeatable audit

This branch adds the standard-library-only Python script at research/lay_field_2_audit.py. Example:

    python research/lay_field_2_audit.py dwbfpricesukwin*.csv --price 2.00 --stake 1 --commission 0.02 --output-json lay_field_2_report.json

Only UK WIN files; do not mix PLACE, Ireland or greyhounds. Groups valid races, deduplicates repeat rows, requires one winner, treats missing IPMIN as unknown, and reports distance, field band, handicap, surface, and track layout. It *never* places a bet.

Optional race metadata CSV:

    event_id,distance_furlongs,surface,track_layout
    example123,6,all-weather,straight
    example124,12,turf,turning

Example IDs are illustrative only. Populate **verified** event IDs/metadata; otherwise surface and layout remain 'unknown'. Do not guess straight or turning merely from racecourse names. The script parses distance from the race name where possible.

Check with:

    python -m unittest discover -s research -p test_lay_field_2_audit.py

## Data and execution limitations

Betfair's definition of **IPMIN** excludes trades with a payout of £100 or less (https://promo.betfair.com/betfairsp/prices/). It records filtered traded minimum odds, **not** the timing, stake, order queue position, order type, market depth or whether a **£1** lay would have matched. Hypothetical price-touch returns must not be called executable returns or ROI.

More history is required: collect many 2025–26 daily Betfair files under the applicable data terms, join separately verified racecards and track layouts, create chronological training/holdout periods, and then capture actual prospective £1 paper orders with real fill information. Do not use final BSP, outcome, post-off prices, or IPMIN as features in a **pre-race** race qualifier. The primary outcome is 3+ different runners reaching 2.00; cash P/L with liquidity/commission is the ultimate requirement.

Do **not** promote this experiment into the live PIF Racing scanner until there is meaningful out-of-sample evidence. This document and code contain no private formula or licensed raw race dataset.
