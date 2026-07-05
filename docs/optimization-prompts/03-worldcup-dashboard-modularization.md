# Prompt: Modularize World Cup Dashboard Boundaries

You are working in the Starsail Astro static site project.

## Background

`src/scripts/worldcup-dashboard.js` has grown into a large browser script. It currently owns data fetching, tab state, schedule wheel interactions, schedule date filtering, moments rendering, bracket drawing, goal overlay, champion overlay, formatting, and exported helpers used by the standalone moments page.

## Goal

Reduce coupling by extracting one or more low-risk modules with clear boundaries, while preserving the current user-facing behavior.

## Required Context

Read these first:

- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `src/scripts/worldcup-dashboard.js`
- `src/scripts/worldcup-moments.js`

## Preferred First Extraction

Start with a low-risk boundary:

- data endpoint selection
- `fetchDataPayload()`
- stale payload fallback
- `normalizeClientPayload()`

A good target is a helper such as:

```text
src/scripts/worldcup/data-client.js
```

This helper should not import DOM code.

## Constraints

- Avoid a broad rewrite.
- Preserve existing exports used by `worldcup-moments.js`, or migrate imports carefully.
- Keep behavior for Netlify root path and GitHub Pages base path.
- Do not touch visual styles unless the modularization exposes an actual bug.

## Verification

Run:

```bash
pnpm typecheck
pnpm build
```

## Deliverable

Make the extraction directly, then summarize:

- new module boundary
- imports changed
- verification result
- what remains worth extracting later
