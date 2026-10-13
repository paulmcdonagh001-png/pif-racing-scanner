# PIF Racing Scanner V0.2 — personal, experimental

**Website:** https://pif-racing-scanner.onrender.com

A mobile-first racing Power Check and paper-selection tracker. Live UK and Ireland racecards from The Racing API Free require one-time private backend configuration.

## What works
- Choose **Load today** or **Tomorrow** then select a meeting and race.
- Import runner names, form strings, OR and weights from the free Racing API **after setup**.
- Record supporting evidence for each horse using eight weighted categories (100 points total), minimum 75% coverage to show a rating.
- Keep manually entered assessments and paper results in this device's browser only; no automatic PC/phone syncing.
- Paper tracker, manually entered odds and break-even percentages; **no bets placed**.
- Initial sample (13 October 2026 Hereford) is an archived example.

**The Power Rating is not a winning probability and has not been validated for betting profitability.** The free API provides no odds or detailed horse course, distance and going histories. Selecting a well-rated horse is not evidence of positive expected return.

## Configure the free live feed (one-time)

No subscriptions are needed, but free Render usage is shared across your workspace (750 free instance-hours per month) and an unused feed sleeps after 15 minutes, causing up to a one-minute wake-up delay. Be aware of your account's bandwidth/build allowance.

1. Open the separate feed service in Render: https://dashboard.render.com/web/srv-db73gkl9fdbs73etfntg
2. Choose **Environment**, then add these **secret environment variables**:
   - `RACING_API_USERNAME` — your API Username from The Racing API's My Account page.
   - `RACING_API_PASSWORD` — your API Password from the same place.
   - `SCANNER_ACCESS_PIN` — a new private access code you create (at least 12 characters is recommended). This PIN is NOT the Racing API password.
3. Save the environment variables and allow Render to deploy/restart the service.
4. Verify https://pif-racing-feed.onrender.com/health shows `{"ok":true,"ready":true}`.
5. Visit the scanner, click **Load today**, enter only your own **SCANNER_ACCESS_PIN** when prompted. Do not enter your actual API username or password into the scanner.

**Never share your API password/PIN in ChatGPT or commit it to GitHub.** The feed backend sends credentials to The Racing API via HTTPS and returns only a subset of free racecard fields to visitors who possess the access PIN. The app stores the PIN only in browser sessionStorage, cleared when the tab session ends.

The scanner website itself has a public URL, and the frontend code is public. Its racecard endpoint requires a PIN and has a fixed permitted website origin. The tool is intended for personal, non-commercial use consistent with the provider's terms.

## Security and data limitations
- Free cards are refreshed on demand, cached for 5 minutes server-side to reduce API calls, and filtered to GB and Ireland. They are **not continuously monitored**.
- Odds are not included. Change-of-going or distance clears previously recorded factor ratings for that race.
- No automatic data sync between phone and PC. Export/import a backup to move your notes.
- Your old ratings and journal remain in the device browser even if live data is unavailable.
- Free Render web services count toward shared workspace hours. If exhausted, existing free web services may be suspended until the next month.

## Experimental daily speed shortlist

The research folder now contains a chronological handicap-hurdle shortlist prototype and synthetic tests. It can read permitted, locally held history and a normalized racecard, filter to clear prior-speed leaders, and append timestamped pre-race snapshots. It does not fetch odds, estimate win probabilities, identify value prices, or establish a betting edge. See [`research/DAILY_SHORTLIST.md`](research/DAILY_SHORTLIST.md). The mobile scanner interface is unchanged. No licensed historical archive has yet been supplied, so there are no genuine speed-model backtest results.
