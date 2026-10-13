# PIF Racing Scanner V0.1

A mobile-first, experimental horse-racing analysis and paper-selection tracker.

## Current version
- Three Hereford racecards from 13 October 2026 are **archived examples**, not live data.
- Review horses with PIF's eight-factor, 100-point evidence checklist.
- Unverified/missing factors do not score. A Power Rating only appears once at least 75% of weighted evidence has been assessed.
- The Power Rating is **not a win probability** and has no validated betting advantage.
- Import copied markdown racecards or enter your own.
- Enter odds manually to calculate market break-even percentage, not a proven value edge.
- Log hypothetical win singles, outcomes and paper P/L. No actual bets are placed.

## Privacy
The hosted site is publicly accessible at its URL. Your assessments and paper tracking records are stored **only in this browser's local storage**. They do not sync between PC and phone automatically. Export/import a JSON backup to transfer them. Do not put credentials or sensitive information into the app.

## Deployment
The app uses just one self-contained `index.html`, plus a service worker, SVG icon and manifest. Render Static Site: main branch `main`, build command `echo Static ready`, publish directory `.`.

## Home-screen shortcut
In Android Chrome, open the published URL and select **Add to Home screen**. Whether Chrome offers full PWA installation or a shortcut depends on device and icon support.

## Future plans
Live racecards can be added using a secure API backend, but **never** embed Racing API credentials in the public GitHub repository or browser JavaScript.

Additional software subscription cost: £0. Free Render hosting is subject to platform quotas and billing terms.
