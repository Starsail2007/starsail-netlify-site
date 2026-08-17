# maimai DX Dashboard

The public maimai page is a fully static Astro page. It reads committed snapshots from `src/data/maimai/` and does not call Netlify Functions or Supabase from the browser.

## Setup

Copy `.env.example` to `.env`, then set either `MAIMAI_USERNAME` or `MAIMAI_QQ` for local maintenance commands. Do not store official game-account credentials in this project.

## Local update commands

```bash
pnpm maimai:update
pnpm maimai:status
pnpm maimai:history
pnpm maimai:history -- --limit 50
pnpm maimai:music-cache
pnpm maimai:music-cache -- --force
pnpm maimai:export
pnpm maimai:records-probe
pnpm maimai:records-save
pnpm maimai:lxns-probe
pnpm maimai:trend-import -- --dry-run
```

The main deployed inputs are:

```text
src/data/maimai/latest.snapshot.json
src/data/maimai/history.snapshots.json
src/data/maimai/music-data.json
src/data/maimai/music-data.meta.json
```

`pnpm maimai:update` updates the local snapshots. Supabase remains an optional local persistence target for the maintenance CLI only; its service-role key must never enter frontend code.

## Publishing

After a deliberate snapshot update, run `pnpm deploy:check`, commit the changed data with the related release, and use the normal GitHub Pages plus verified Netlify draft workflow. Do not create an automated data-only production-deploy loop.

For full-record and historical-data research, see `docs/maimai/RECORDS_RESEARCH.md`. The removed public Netlify endpoints are documented in `docs/ARCHIVED_FEATURES.md` and remain recoverable from Git history.
