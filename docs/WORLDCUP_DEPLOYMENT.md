# World Cup Deployment

This project uses a split-responsibility deployment model:

- GitHub Actions is the only updater for World Cup live data.
- Netlify is a publication target for the site bundle, not the live data generator.
- Codex local automation is used for health checks and manual intervention only.

## Source of truth

The World Cup data source of truth is the `worldcup-data` branch:

- `public/data/worldcup-live.json`

That branch is updated by `.github/workflows/worldcup-live-data.yml`, which runs on GitHub Actions and can also be triggered manually with `force=true`.

After a fresh payload is written to `worldcup-data`, the same workflow syncs the exact JSON file back to `main` at:

- `public/data/worldcup-live.json`

This keeps the static snapshot bundled into Netlify and GitHub Pages builds aligned with the latest known data.

## Runtime read order

The browser reads data in this order:

1. GitHub raw static JSON
2. Local/static JSON on the current deployment
3. Netlify Function fallback
4. The newest stale static payload, with an on-page warning

Production browsers reject `source: "mock"` payloads. Mock data is only allowed on localhost or when the URL explicitly includes `?worldcupDemo=1`.

## Netlify cost control

To keep Netlify usage low:

- Do not use Netlify Scheduled Functions for World Cup refresh.
- Do not move World Cup data generation into Netlify builds.
- Keep Netlify as a plain build-and-publish target.
- Use GitHub Actions for all World Cup data refreshes.
- Expect a normal site rebuild when the workflow syncs a changed static snapshot back to `main`.

## Operational rule

If local automation is offline, the site should still refresh as long as GitHub Actions can run.
If GitHub Actions is unavailable or blocked, manually trigger `World Cup live data` with `force=true`.
