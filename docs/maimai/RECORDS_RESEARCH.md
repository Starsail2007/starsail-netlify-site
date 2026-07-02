# maimai Full Records Research

This note captures the pre-Phase 5 research for complete score records and historical rating growth.

## Current Project State

The current pipeline is based on Diving-Fish `/query/player`.

- It fetches public B50 data by QQ or Diving-Fish username.
- It saves each fetched B50 snapshot locally and, when configured, to Supabase.
- Netlify has a scheduled function at `netlify/functions/maimai-scheduled-update.ts`.
- The scheduled function runs every 6 hours after the site is deployed on Netlify with the required environment variables.

This means the project can automatically build a rating curve from the first successful scheduled snapshot onward. It cannot reconstruct old per-play history from B50 snapshots alone.

Required Netlify environment variables for automatic recording:

```env
MAIMAI_SOURCE=diving_fish
MAIMAI_QQ=1012169369
MAIMAI_UPDATE_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
MAIMAI_LOCAL_CACHE_DIR=src/data/maimai
```

`SUPABASE_SERVICE_ROLE_KEY`, `MAIMAI_UPDATE_SECRET`, and any record tokens must stay server-side only.

## Why The Current Curve Has No Past History

Diving-Fish documents `/query/player` as a brief score endpoint. With `b50` it returns the highest-rating 15 current-version charts and 35 older-version charts. It does not return every score, every play, or play timestamps.

Because of that, the current dashboard can answer:

- current rating;
- current B35/B15;
- changes between snapshots saved by this project.

It cannot answer:

- every historical play before our first snapshot;
- every historical rating increase;
- exact play-time-based rating growth.

## Source Option 1: Diving-Fish Complete Current Records

Diving-Fish has complete score endpoints:

- `GET /player/records` with `Import-Token`;
- `GET /dev/player/records` with `Developer-Token` and `username` or `qq`;
- `GET /player/test_data` for public test data.

The complete record response includes player fields such as `rating`, `nickname`, `plate`, and a `records` array. Each record includes fields such as:

- `song_id`;
- `title`;
- `type`;
- `level`;
- `level_index`;
- `ds`;
- `achievements`;
- `dxScore`;
- `ra`;
- `rate`;
- `fc`;
- `fs`.

This is the best source for a "current full score table": all current best score records, not just B50.

Limitations:

- It is not a per-play history source.
- It does not by itself give every historical rating increase.
- `Import-Token` identifies the current user and should be treated like a secret.
- `Developer-Token` is request-limited and intended for developer/server use.

Recommended first implementation:

1. Add a server-only Diving-Fish full-record client using `DIVING_FISH_IMPORT_TOKEN`.
2. Add a CLI probe command to verify record count and response shape without writing to the frontend yet.
3. Save full-record snapshots to Supabase.
4. Use the full record table for better suggestions and completion views.

## Source Option 2: Lxns Historical Data

Lxns documents several endpoints that are more suitable for history:

- player lookup by QQ;
- Best 50;
- all best scores;
- Recent 50;
- score upload heatmap;
- DX Rating trend;
- score history records.

The Lxns score model includes historical fields such as `play_time`, `upload_time`, `last_played_time`, and `dx_rating`. Its `RatingTrend` model includes total, standard, dx, and date fields.

This is the more promising source for "past rating growth curve" and "play history".

Limitations:

- Access depends on Lxns token, friend code, and the player's third-party permission settings.
- Score history only includes records that Lxns has with `play_time`.
- If historical data was never uploaded to Lxns, the API cannot invent it retroactively.

Recommended second implementation:

1. Add an Lxns client with `LXNS_DEVELOPER_TOKEN` / `LXNS_USER_TOKEN` and `LXNS_FRIEND_CODE`.
2. Probe `/trend`, `/score/history`, and `/scores`.
3. Decide whether Lxns can provide enough historical depth for this player.
4. Normalize Lxns trend points into `maimai_rating_trend_points`.
5. Let `maimai-history` prefer imported trend points and fall back to B50 snapshot history.

Local probe command:

```bash
pnpm maimai:lxns-probe -- --mode developer
pnpm maimai:lxns-probe -- --mode user
```

Developer mode uses `LXNS_DEVELOPER_TOKEN` and can probe trend/history by friend code. User mode uses `LXNS_USER_TOKEN` and can probe the current user's player/scores endpoints.

Historical rating import command:

```bash
pnpm maimai:trend-import
pnpm maimai:trend-import -- --dry-run
```

This requires the `maimai_rating_trend_points` table from `supabase/schema.sql`.

## Recommended Phase 5 Gate

Before building the UI for complete records, run probes in this order:

1. Diving-Fish Import-Token probe: confirms current complete records are available.
2. Lxns trend/history probe: confirms whether old rating growth and play records are available.
3. Supabase schema extension: store full-record snapshots and optional historical events.
4. Frontend: add full record browser, history curve, and derived suggestions.

## References

- Diving-Fish API docs: https://maimai.diving-fish.com/manual/docs/developer/zh-api-document/
- Diving-Fish test data: https://www.diving-fish.com/api/maimaidxprober/player/test_data
- Lxns maimai API docs: https://maimai.lxns.net/docs/api/maimai
