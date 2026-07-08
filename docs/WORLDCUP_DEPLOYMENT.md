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

## Post-publish verification

Treat `git push` and a successful build as necessary but not sufficient. GitHub Pages and Netlify are separate publication outlets, and Netlify can occasionally lag behind the latest GitHub commit or keep serving the previous deploy.

After every public release that can affect World Cup data or loading behavior, check both public origins:

- `https://starsail2007.github.io/starsail-netlify-site/worldcup/`
- `https://starsail.netlify.app/worldcup/`
- `https://starsail2007.github.io/starsail-netlify-site/data/worldcup-live.json`
- `https://starsail.netlify.app/data/worldcup-live.json`

For `worldcup-live.json`, compare `source`, `lastUpdated`, `polling.nextFetchAt`, and the match count. Both public origins should match the committed static snapshot unless a fresh `worldcup-data` update has happened in between.

Run the health check after deployment:

```bash
pnpm worldcup:health
```

The expected healthy state is that GitHub `worldcup-data`, Netlify static JSON, GitHub Pages static JSON, Netlify Function, and local static data are all `OK`.

## Netlify manual production recovery

Use this only when GitHub Pages has updated but Netlify production is still serving an older static snapshot or older page bundle after waiting for the normal automatic deploy path.

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

This recovery path does not replace the source-of-truth flow. The source must still be committed and pushed to GitHub first; the manual Netlify step only makes production serve the same verified build when automatic deploy propagation is delayed.
