# PIF Lay the Field 2.00 — 2025–26 uploaded-file audit

**21 October 2026. Research only. No real-money qualifiers, bets, or changes to PIF Racing's existing horse-win algorithm.**

## Data coverage
The owner supplied a ZIP of 84 valid Betfair-format free WIN daily CSVs (44 UK, 40 Ireland) with 13,591 runner rows. The request covered 734 country/date files; 650 attempts returned HTTP 429 Too Many Requests. The observed data cover 64 different CSV file dates (which may differ from the event date), and are **not** a complete consecutive one-year sample.

Deduplicate by region + event_id + event_dt + selection_id. Require a single winner per race, at least two unique runners, a parsed Flat distance of 20 furlongs or less, and actual EVENT_DT in 2025-10-21 through 2026-10-20. Exclude jumps and bumpers (516 events), events outside the date window (66), invalid winner records (2), and unclassified/too-long distances (2). **928 valid Flat races: 762 UK, 166 Ireland.** This is a deliberately constrained and incomplete observational sample.

## Verified results
| Group | Valid Flat races | 2+ distinct runners IPMIN <=2.00 | 3+ runners IPMIN <=2.00 | £1 per match illustrative net after 2% commission |
|---|---:|---:|---:|---:|
| UK | 762 | 294 (38.6%) | 23 (3.0%) | -£439.54 |
| Ireland | 166 | 51 (30.7%) | 5 (3.0%) | -£106.14 |
| **Combined** | **928** | **345 (37.2%)** | **28 (3.0%)** | **-£545.68** |

The touch histogram across complete Flat events was **583 races with exactly 1 touch, 317 with exactly 2, 28 with exactly 3, none with 0 or 4+**. In 99.46% of races, the eventual winner was among runners touching 2.00 or below.

### Frozen candidate profiles from the older 2023–24 sample
| Profile | New races | 2+ touches | 3+ touches | 3+ hit rate | Hypothetical 2%-commission net |
|---|---:|---:|---:|---:|---:|
| 6f; exactly 5 runners | 10 | 5 | 0 | 0.0% | -£5.00 |
| 6f; 2–6 runners | 32 | 10 | 1 | 3.1% | -£21.02 |
| Any distance; exactly 5 runners | 73 | 29 | 1 | 1.4% | -£41.06 |
| Newcastle; 1m; 2–6 runners | 2 | 1 | 0 | 0% | -£1.00 |
| 7f; non-handicap; 7–9 runners | 22 | 11 | 2 | 9.1% | -£9.04 |
| Lingfield; all distances | 70 | 32 | 5 | 7.1% | -£33.10 |
| 5f; 2–6 runners | 33 | 9 | 0 | 0.0% | -£24.00 |
| 1m; 7–9 runners | 60 | 21 | 2 | 3.3% | -£37.04 |

**Important classification:** A Nursery is a handicap. The correctly classified newer 7f *non-handicap* profile has **22 races**, not 24 as in an initial quick tally that only matched the literal “Hcap” word.

These are **observed historical price lows**, not confirmed order matches. For the money calculation, a hypothetical £1 lay at 2.00 is perfectly matched on each horse with volume-filtered `IPMIN <= 2.00`. Each losing horse gives +£1; a matched winner incurs -£1; market net profit receives 2% commission, net loss does not. This idealised assumption likely misstates execution and is **not actual ROI**.

Among the scanned profile groups with at least ten observations, **none showed a positive idealised net**. Small samples, 650 missing file days, uneven seasons, class metadata limitations and many subgroup comparisons prevent calling any profile profitable.

## Cross-era comparison
- Prior 2023–early 2024 UK-only mirror: 7,544 races with 416 (5.5%) recording 3+ touches.
- Newly supplied **partial 2025–26 UK+Ireland**: 928 races with 28 (3.0%) recording 3+ touches.
- 6f, exactly 5 runners: older 10/58 (17.2%); newer 0/10. Not sustained in the sampled newer dates.
- Do not interpret this as a like-for-like market trend: coverage, country composition and season differ.

## Decision
No 2.00 lay-the-entire-field real-money qualifier is justified. Keep research separate from existing PIF Racing models.

For an executable profitability test, obtain *lawfully licensed*, more complete 2025–26 WIN in-running price/volume data, with timestamps and an order book capable of testing realistic £1 fill probabilities, delays and suspension. Retry free CSV access *only when allowed*, using a rate-limit-aware resumable collector that stops at HTTP 429 rather than sending hundreds of further requests. Then retest frozen candidate profiles on a genuinely untouched chronological holdout.

**Source:** user-supplied `PIF_Betfair_UK_IRE_WIN_2025_2026.zip` including `download-manifest.csv`. **Raw files are not checked into GitHub**. Research scripts and aggregate tables only.
