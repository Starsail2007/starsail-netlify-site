# Prompt: Sync Project Docs With Current Architecture

You are working in the Starsail Astro static site project.

## Background

The project started as a quiet personal portal, but it now includes:

- the home/entry experience
- a maimai static dashboard and optional data-sync tooling
- a World Cup dashboard with static JSON, GitHub Pages support, Netlify support, and data refresh scripts
- design/lab prototype pages

The existing project docs still over-emphasize the original portal-only state.

## Goal

Update the project documentation so future Codex threads understand the real current project shape without inventing future content direction for the user.

## Required Context

Read these first:

- `AGENTS.md`
- `README.md`
- `docs/PROJECT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/WORLDCUP_DATA_PIPELINE.md`
- `docs/maimai/README.md`
- `package.json`

## Work Scope

Prefer editing:

- `README.md`
- `docs/PROJECT_BRIEF.md`
- `docs/ARCHITECTURE.md`

Only edit other docs if needed to keep cross-references accurate.

## Constraints

- Keep the site's future direction open.
- Do not prescribe future personal content.
- Keep the current tone restrained and practical.
- Mention Netlify and GitHub Pages as deployment outlets, with GitHub Pages as the static fallback.
- Make clear that static text lives in `src/content/site-text.md`.
- Make clear that dynamic match/rating data is not ordinary static copy.

## Verification

Run:

```bash
pnpm text:check
pnpm typecheck
pnpm build
```

## Deliverable

Make the doc updates directly, then summarize:

- which docs changed
- what architectural drift was corrected
- verification result
