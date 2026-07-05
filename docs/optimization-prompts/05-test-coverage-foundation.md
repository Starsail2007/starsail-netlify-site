# Prompt: Add Focused Test Coverage Foundation

You are working in the Starsail Astro static site project.

## Background

The project currently relies mostly on `pnpm text:check`, `pnpm typecheck`, and `pnpm build`. The highest-value tests are for pure data and policy logic, not browser-perfect UI snapshots.

## Goal

Add a lightweight test foundation using the existing toolchain. Prefer Node's built-in test runner for pure JavaScript modules.

## Required Context

Read these first:

- `AGENTS.md`
- `README.md`
- `package.json`
- `src/worldcup/lib/detectGoal.js`
- `src/worldcup/lib/refreshPolicy.js`
- `src/worldcup/lib/normalizeWorldCupData.js`
- `src/lib/maimai/suggestions.ts`

## Work Scope

Likely files:

- `package.json`
- `tests/worldcup/*.test.mjs`
- optionally `README.md` or docs if test commands are documented

## Recommended First Tests

Start small:

- `detectGoal()` returns no goal without previous data.
- `detectGoal()` identifies home/away score increases and latest goal event metadata.
- `computeWorldCupRefreshPolicy()` distinguishes live, match-window, near-match, quiet, and complete states.

## Constraints

- Do not add a heavy test framework unless clearly necessary.
- Do not require browser automation for this first pass.
- Keep fixtures minimal and inline.
- Avoid tests that depend on the current real date.

## Verification

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Deliverable

Make the test additions directly, then summarize:

- test command added
- cases covered
- verification result
- next useful test targets
