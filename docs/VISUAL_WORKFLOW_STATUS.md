# Visual Workflow Status

Checked: 2026-07-09

## Connector Status

| Area | Status | Notes |
| --- | --- | --- |
| Figma | Ready | Figma plugin is available. Use node-specific links with `node-id` for design context and screenshots. |
| Canva | Ready | Canva plugin is available. Project folder created: `Starsail Visual Workflow` (`FAHO4G_onjg`). |
| Canva Brand Kit | Not configured | No brand kits were visible during setup. Use local site tokens until a Brand Kit exists. |
| GitHub / Netlify | Existing route | Production remains source-controlled Astro code, then GitHub / Netlify deploy. |

## Local Workflow Assets

| Asset | Status | Path |
| --- | --- | --- |
| Design workflow doc | Ready | `docs/DESIGN_WORKFLOW.md` |
| Connector doc | Ready | `docs/DESIGN_CONNECTORS.md` |
| Canva workspace record | Ready | `design/canva-workspace.json` |
| Reference index | Ready | `design/references/README.md` |
| Export index | Ready | `design/exports/README.md` |
| Intake template | Ready | `design/references/_template/` |
| Intake command | Ready | `scripts/design/create-intake.mjs` |
| npm script | Ready | `pnpm design:intake` |

## Current Intake Flow

1. Create an intake folder:

   ```bash
   pnpm design:intake -- --name "Homepage visual refresh" \
     --figma "https://www.figma.com/design/<fileKey>/<fileName>?node-id=123-456" \
     --canva "https://www.canva.com/design/<designId>/..."
   ```

2. Put screenshots, exported images, PDFs, SVGs, or notes under the generated `design/references/<topic>/` folder.
3. Put source exports under `design/exports/<topic>/`.
4. Move only production-approved assets into `public/assets/design/<topic>/`.
5. Implement the approved design as Astro components, CSS tokens, page styles, and small scripts.
6. Run `pnpm build`; use `pnpm dev` for visual QA when page behavior changes.

## Canva-Specific Route

Canva can now support these tasks directly:

- Create and organize designs in the `Starsail Visual Workflow` folder.
- Generate design candidates for visual exploration.
- Read existing Canva designs by design ID or full design URL.
- Read rich text content and page thumbnails from Canva designs.
- Import public HTTPS files into Canva.
- Convert flat image designs into editable Canva designs with Magic Layers.
- Edit Canva designs through draft transactions, then commit only after user approval.

## Open Gaps

- No Canva Brand Kit is configured yet.
- Canva exports still need manual or tool-mediated placement into `design/exports/<topic>/`; final site assets must still be copied into `public/assets/design/<topic>/`.
- Design-to-code remains a judgment step: Canva/Figma can supply visual context, but Codex still needs to translate it into maintainable Astro, CSS, and JavaScript.
- Before public release, visual changes still need local build/preview and the existing GitHub + Netlify deployment path.
