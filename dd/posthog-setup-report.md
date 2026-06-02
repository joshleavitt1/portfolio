# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into Dungeon Descent — a static HTML landing page for a walking/gaming app. Because this project has no build system or package manager, PostHog was added via the official HTML snippet (CDN delivery) directly in `index.html`. An inline tracking script captures the single key conversion event and identifies users by email when they join the waitlist.

## Events

| Event | Description | File |
|---|---|---|
| `early_access_signup_completed` | User successfully submits the early access signup form with a valid email address. | `index.html` |

Autocapture is enabled by default and will automatically track pageviews, clicks, and form interactions.

## User identification

`posthog.identify()` is called on successful signup, using the submitted email as the distinct ID and setting `email` as a person property. This links all future events from that browser to the known user.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](https://us.posthog.com/project/451130/dashboard/1658987)
- [Total Signups](https://us.posthog.com/project/451130/insights/BLehxeib) — bold number showing total signups in the last 30 days
- [Signups Over Time](https://us.posthog.com/project/451130/insights/D1gp9Ggz) — daily signup trend line
- [Unique Daily Visitors](https://us.posthog.com/project/451130/insights/AJXFLoAD) — daily active users via autocaptured pageviews
- [Signups by Country](https://us.posthog.com/project/451130/insights/N6xxI7Ku) — waitlist conversions segmented by country
- [Signups by Referring Domain](https://us.posthog.com/project/451130/insights/1neXcVA3) — which traffic sources drive the most signups

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
