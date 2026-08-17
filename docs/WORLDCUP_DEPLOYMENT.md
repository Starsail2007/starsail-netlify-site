# World Cup Deployment

This project uses a split-responsibility deployment model:

- GitHub Actions is the manual updater for the archived World Cup data.
- Netlify is a publication target for the site bundle, not the live data generator.
- Codex local automation is used for health checks and manual intervention only.

## Source of truth

The World Cup data source of truth is the `worldcup-data` branch:

- `public/data/worldcup-live.json`

That branch is updated only by manually running `.github/workflows/worldcup-live-data.yml`. Use `force=true` when a refresh is required immediately.

The workflow does not write data back to `main`. `public/data/worldcup-live.json` on `main` is an offline snapshot updated only as part of a deliberate code release.

## Runtime read order

The browser reads data in this order:

1. GitHub raw static JSON
2. Local/static JSON on the current deployment
3. The newest stale static payload, with an on-page warning

Production browsers reject `source: "mock"` payloads. Mock data is only allowed on localhost or when the URL explicitly includes `?worldcupDemo=1`.

## Netlify cost control

To keep Netlify usage low:

- Do not use Netlify Scheduled Functions for World Cup refresh.
- Do not move World Cup data generation into Netlify builds.
- Keep Netlify Git builds ignored and publish only a verified local `dist/`.
- Use the manual GitHub Actions workflow only when archived match data genuinely needs correction.
- Never write routine data refreshes back to `main`.

## Operational rule

If archived data needs correction, manually trigger `World Cup data refresh` with `force=true`. Routine refresh is disabled after the tournament.

## Post-publish verification

Treat `git push` and a successful build as necessary but not sufficient. GitHub Pages and Netlify are separate publication outlets, and Netlify can occasionally lag behind the latest GitHub commit or keep serving the previous deploy.

After every public release that can affect World Cup data or loading behavior, check both public origins:

- `https://starsail2007.github.io/starsail-netlify-site/worldcup/`
- `https://starsail.netlify.app/worldcup/`
- `https://starsail2007.github.io/starsail-netlify-site/data/worldcup-live.json`
- `https://starsail.netlify.app/data/worldcup-live.json`

For `worldcup-live.json`, distinguish the runtime `worldcup-data` payload from the offline snapshots bundled into each deploy. The two site snapshots should match the released commit; the runtime branch may be newer.

Run the health check after deployment:

```bash
pnpm worldcup:health
```

The expected healthy state is that GitHub `worldcup-data` is readable and both deployed pages can fall back to their bundled static JSON.

## Preferred Netlify production publish

Use this as the preferred Netlify publish path after source has been committed and pushed to GitHub. GitHub remains the source of truth; the manual Netlify draft step makes production serve the same verified build without waiting on Netlify automatic deploys that may be skipped, delayed, or blocked by platform state.

1. Verify the local build is good:

```bash
pnpm deploy:check
```

2. Upload the already built `dist/` as a Netlify draft deploy:

```bash
pnpm --package=netlify-cli dlx netlify deploy --dir=dist --message "Release message" --json
```

3. Open or fetch the draft deploy URL and verify the same critical resources there, especially `/data/worldcup-live.json`.

4. Promote that deploy to production with the Netlify API:

```bash
pnpm --package=netlify-cli dlx netlify api restoreSiteDeploy --data '{"site_id":"7ba03d8d-c2a1-4912-af4e-35227435697e","deploy_id":"DEPLOY_ID"}'
```

5. Re-check `https://starsail.netlify.app/data/worldcup-live.json` and run:

```bash
pnpm worldcup:health
```

This path does not replace the source-of-truth flow. The source must still be committed and pushed to GitHub first; the manual Netlify step only makes production serve the same verified build immediately and predictably.
