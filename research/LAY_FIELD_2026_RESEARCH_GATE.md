# PIF Racing – Lay the Field Historical Qualification Audit
Date: 21 October 2026. Status: **RESEARCH ONLY – no live lay-the-field betting qualifiers authorised.**

## Aim
Find *course + distance + field size + race type* combinations where at least three distinct horses record an in-play Betfair WIN price of **2.00 or lower**. Judge a possible strategy using all race outcomes, not only the percentage of 3+ touches.

## Verified historical source and coverage
- Successful read-only GitHub Actions run: https://github.com/paulmcdonagh001-png/pif-racing-scanner/actions/runs/39586005791
- Archived 469 daily UK WIN price CSVs from Jan 2023 to April 2024 from EonHorizons/betfair_sp (independent third-party mirror, not verified byte-for-byte against original Betfair files).
- 7,544 qualifying Flat races; 3,421/7,544 had >=2 distinct runners with reported IPMIN <=2; 416/7,544 had >=3; 22/7,544 had >=4.
- Every published IPMIN is **volume-filtered**; no queue/timestamp/filled £1 order evidence.

## Historical shortlist (not money-making signals)
| Profile | N | >=2 | >=3 | >=4 | 3+ % |
|---|---:|---:|---:|---:|---:|
| 6f, exactly 5 runners | 58 | 38 | 10 | 1 | 17.2% |
| Newcastle, 1m, 2–6 runners | 30 | 15 | 5 | 1 | 16.7% |
| 7f, non-handicap, 7–9 runners | 224 | 113 | 25 | 3 | 11.2% |
| All Flat races in study | 7544 | 3421 | 416 | 22 | 5.5% |

### Caution: attractive 3+ rates do NOT imply profitable laying
At 2.00 and £1 laid on *each matched runner*, gross return per market is +£1 for each matched losing horse, minus £1 if the eventual winner is also matched. Two matches including the winner break even before fees, three make +£1, and a single match on the winner loses £1. If fewer than three horses typically touch 2.00, there can be a negative expectation despite an elevated 3+ rate.

For the 6f / exactly-five field profile, assuming one winner touch per race and no five-runner simultaneous touches, the inclusive touch buckets imply at least 20 races with fewer than two touches, 28 with exactly two, 9 with exactly three and 1 with four or more. This yields an illustrative **around -£9 gross** over 58 races under ideal fills (and may differ if there were atypical absent winner touches or five-runner events). **No observed matched bets; do NOT quote this as realised ROI.**

### Chronological split already checked on recorded samples
- 6f with exactly 5 runners: 2023 **9/49 = 18.4%** three+; Jan–Apr 2024 **1/9 = 11.1%**.
- Exactly 5 runners (any distance): 2023 **37/382 = 9.7%**; Jan–Apr 2024 **12/63 = 19.0%**.
- 7f non-handicap, 7–9 runners: 2023 **24/198 = 12.1%**; Jan–Apr 2024 **1/26 = 3.8%**.
- Newcastle 1m, 2–6 runners: 2023 **4/22 = 18.2%**; Jan–Apr 2024 **1/8 = 12.5%**.

Seasonal and sample-size limitations apply; 2024 is Jan–Apr only. Selection of top patterns after examining the sample creates multiple-testing bias.

## Latest-year (21 October 2025–20 October 2026) access attempt
- Official free BSP directory: `https://promo.betfair.com/betfairsp/prices/`.
- GitHub Actions job: https://github.com/paulmcdonagh001-png/pif-racing-scanner/actions/runs/39589348816
- Automatic directory access returned **HTTP 403**, so **zero 2025–26 files** were retrieved by this run.
- Independent UK browser check of the public directory returned empty page/timeout. Do not claim 2025–26 analysis completed.
- Search of readily available repositories did not identify a suitably verified and rights-cleared complete 2025–26 BSP UK WIN source.

### Licensed primary-source alternative
- Betfair Historical Data: https://historicdata.betfair.com/
- Betfair Basic data is free but includes 1-minute last-traded price snapshots without volume, insufficient to record all fleeting 2.00 touches.
- Betfair Advanced records second-level price/volume/top-three ladder; Pro records finer ticks and full ladder, better for assessing actual order execution (but still cannot determine private queue priority exactly).
- Historical data is subject to Betfair's personal/internal-use licensing. **Commercial use in PIF requires appropriate permission.**
- Authentication and/or purchased access is required for the Historical Data API. No purchase, login, wager or paid infrastructure was initiated.

## Next hard gate to trading labels
1. Obtain legally usable, complete, authenticated **2025–26** UK/Irish WIN race records (ideally full-resolution traded-price series with volume) and independently verify coverage, winner, course, race type, surface and layout.
2. Freeze candidate combinations BEFORE analysing the fresh dates; calculate exactly-one, exactly-two, 3+ touch rates and gross/proxy after commission by race, with actual or order-book-confirmable fills.
3. Identify candidates profitable on truly later held-out races, adjusted for the many profiles screened, data loss and market liquidity.
4. Only then allow a separate **Lay the Field** research module to surface qualifiers. Do not modify the PIF win-ranking algorithm. No live bet placements.

## Code in this research branch
- `research/lay_field_profile_scan.py`: 469-file archived summary; completed successfully.
- `research/lay_field_cross_validate.py`: chronological check script (committed, not yet confirmed executed).
- `research/lay_field_year_scan.py`: new-year attempted extractor; currently blocked by provider HTTP 403.
