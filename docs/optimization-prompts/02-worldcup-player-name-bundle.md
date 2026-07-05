# Prompt: Reduce World Cup Player Name Bundle Cost

You are working in the Starsail Astro static site project.

## Background

The World Cup dashboard has a large player-name map in `src/worldcup/data/player-name-map.json`.
It should not block the first World Cup screen. The current implementation already lazy-loads player names, but a large JavaScript chunk can still be produced if JSON is imported as a module.

## Goal

Keep first render fast by loading the full player-name map only when moments/player-name enrichment is needed, and prefer a plain JSON asset over a large executable JS chunk.

## Required Context

Read these first:

- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/WORLDCUP_DATA_PIPELINE.md`
- `src/scripts/worldcup-dashboard.js`
- `src/scripts/worldcup-moments.js`
- `src/worldcup/data/player-name-map.json`
- `src/worldcup/data/player-name-overrides.json`

## Work Scope

Likely files:

- `src/scripts/worldcup-dashboard.js`
- `src/scripts/worldcup-moments.js`
- possibly a small helper under `src/scripts/worldcup/`

## Implementation Guidance

- Do not put the full player-name map into the initial dashboard JS.
- Prefer `?url` or an equivalent static asset URL, then `fetch()` and `response.json()`.
- Preserve the lightweight text fallback from `siteText.worldcup.moments.playerNames`.
- Keep `loadPlayerNameData()` idempotent and promise-cached.
- If loading fails, keep the current fallback index instead of breaking the page.

## Constraints

- Do not change data-generation scripts unless the asset-loading approach requires it.
- Do not change match data source priority.
- Do not add a new framework or runtime.

## Verification

Run:

```bash
pnpm build
```

Then inspect `dist/_astro/` and confirm the player-name map is not emitted as a giant JS module blocking the dashboard entry.

## Deliverable

Make the optimization directly, then summarize:

- how player names are loaded
- before/after bundle behavior if measured
- verification result
