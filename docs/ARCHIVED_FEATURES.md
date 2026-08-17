# Archived Features

The following dormant public surfaces were removed from the active build on 2026-08-17:

- `/intro-demo/`
- `/lab/entry-redesign/`
- `/lab/entry-launch-candidate/`
- Netlify Functions for maimai remote refresh and World Cup fallback
- Unreferenced legacy home components, scripts, and styles

The production site now contains the home entry, the static maimai snapshot, the completed World Cup board, and the World Cup moments page. Historical implementations remain recoverable from Git history before the governance change; they are not copied into the deployable source tree.

The Netlify environment variables were intentionally preserved. Removing stored secrets is irreversible and is not required to stop runtime or credit usage once the Functions and automatic builds are absent.
