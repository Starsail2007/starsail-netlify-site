# maimai DX Dashboard

Phase 1 focuses on the local data pipeline:

- Fetch B50 from Diving-Fish.
- Fetch and cache `music_data` with ETag.
- Normalize third-party fields into local `MaimaiSnapshot` data.
- Save the latest snapshot and local history under `src/data/maimai`.
- Provide CLI commands for update, status, history, music cache refresh, and export.

## Setup

Copy `.env.example` to `.env`, then set either `MAIMAI_USERNAME` or `MAIMAI_QQ`.

```bash
cp .env.example .env
```

Do not put official game account credentials here. This project only queries public Diving-Fish prober data.

## Commands

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
pnpm maimai:records-probe -- --source test-data
pnpm maimai:lxns-probe
```

## Local Files

```text
src/data/maimai/latest.snapshot.json
src/data/maimai/history.snapshots.json
src/data/maimai/music-data.json
src/data/maimai/music-data.meta.json
exports/maimai/maimai-snapshot-{timestamp}.json
```

`latest.snapshot.json` is the static fallback that the Astro page can use before Supabase and Netlify Functions are added.

## Next Phase

Phase 2 adds Supabase schema and server-side snapshot persistence without changing the normalized frontend data shape.

Run `supabase/schema.sql` in the Supabase SQL editor, then set these values in `.env` and Netlify:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side. The CLI and future Netlify Functions can use it, but frontend code must not import the Supabase server client.

When Supabase is configured, these commands will use it automatically:

```bash
pnpm maimai:update   # saves local snapshot and Supabase snapshot/update log
pnpm maimai:status   # shows local status and Supabase latest snapshot
pnpm maimai:history  # reads Supabase history first, with local fallback
```

## Phase 3 Netlify Functions

Phase 3 adds these endpoints:

```text
GET  /.netlify/functions/maimai-latest
GET  /.netlify/functions/maimai-history?limit=100
POST /.netlify/functions/maimai-update
```

`maimai-update` requires this request header:

```text
x-update-secret: {MAIMAI_UPDATE_SECRET}
```

Deploy these environment variables to Netlify:

```env
MAIMAI_SOURCE=diving_fish
MAIMAI_QQ=...
MAIMAI_UPDATE_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
MAIMAI_LOCAL_CACHE_DIR=src/data/maimai
```

Scheduled updates are handled by:

```text
netlify/functions/maimai-scheduled-update.ts
```

It runs every 6 hours with this UTC cron expression:

```text
0 */6 * * *
```

The scheduled function is the automatic recording path. Once deployed with the required Netlify environment variables, every successful run saves a Supabase snapshot and update log. Rating curves produced by this project begin at the first saved snapshot.

## Full Records Research

The current B50 source cannot reconstruct old play history. For complete records and historical growth, see:

```text
docs/maimai/RECORDS_RESEARCH.md
```

Short version:

- Diving-Fish `Import-Token` can fetch current complete score records.
- Lxns is the better candidate for historical rating trend and play records, if token/permissions/data are available.

Use this read-only probe before saving complete records:

```bash
pnpm maimai:records-probe
```

If `DIVING_FISH_IMPORT_TOKEN` is not configured, the command falls back to Diving-Fish public `test_data` so the parser can still be verified.

After the token is configured, save complete records with:

```bash
pnpm maimai:records-save
```

Use this read-only probe for Lxns history/trend:

```bash
pnpm maimai:lxns-probe -- --mode developer
pnpm maimai:lxns-probe -- --mode user
```

Developer mode requires `LXNS_DEVELOPER_TOKEN` and either `LXNS_FRIEND_CODE` or `MAIMAI_QQ`. User mode requires `LXNS_USER_TOKEN`.

After the Lxns developer token and permissions are ready, import historical rating trend points into Supabase:

```bash
pnpm maimai:trend-import
```

Use `pnpm maimai:trend-import -- --dry-run` to check how many points will be parsed without writing the database. The public `maimai-history` function prefers imported Lxns trend points and falls back to B50 snapshot history when no imported trend exists.
