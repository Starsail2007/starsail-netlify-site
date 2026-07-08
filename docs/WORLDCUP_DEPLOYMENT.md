# World Cup Deployment

This project uses a split-responsibility deployment model:

- GitHub Actions is the only updater for World Cup live data.
- Netlify is a publication target for the site bundle, not the data writer.
- Codex local automation is used for health checks and manual intervention only.

## Source of truth

The World Cup data source of truth is the `worldcup-data` branch:

- `public/data/worldcup-live.json`

That branch is updated by `.github/workflows/worldcup-live-data.yml`, which runs on GitHub Actions and can also be triggered manually with `force=true`.

## Runtime read order

The browser reads data in this order:

1. GitHub raw static JSON
2. Local/static JSON on the current deployment
3. Netlify Function fallback when running on Netlify

GitHub Pages only uses static/remote JSON and does not depend on Netlify Functions.

## Netlify cost control

To keep Netlify usage low:

- Do not use Netlify Scheduled Functions for World Cup refresh.
- Do not move World Cup data generation into Netlify builds.
- Keep Netlify as a plain build-and-publish target.
- Use GitHub Actions for all World Cup data refreshes.

## Operational rule

If local automation is offline, the site should still refresh as long as GitHub Actions can run.
If GitHub Actions is unavailable or blocked, manually trigger `World Cup live data` with `force=true`.
