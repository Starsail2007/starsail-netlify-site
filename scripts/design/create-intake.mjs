#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printHelp();
    return;
  }

  const title = pickFirst(args.name, args.title, args.slug);

  if (!title) {
    throw new Error("Missing required option: --name <title>");
  }

  const slug = slugify(pickFirst(args.slug, title));
  const targetDir = path.join(rootDir, "design", "references", slug);
  const dryRun = Boolean(args["dry-run"]);
  const force = Boolean(args.force);
  const createdAt = new Date().toISOString().slice(0, 10);
  const canvaWorkspace = await readCanvaWorkspace();

  if (!dryRun && !force && (await exists(targetDir))) {
    throw new Error(`Refusing to overwrite existing intake: ${relative(targetDir)}. Use --force to replace it.`);
  }

  const intake = {
    title,
    slug,
    createdAt,
    status: "intake",
    sourceLinks: {
      figma: normalizeList(args.figma).map(parseFigmaUrl),
      canva: normalizeList(args.canva).map(parseCanvaUrl),
      references: normalizeList(args.source).map((url) => ({ url })),
    },
    implementationTarget: {
      pages: splitList(args.pages),
      components: splitList(args.components),
      styles: splitList(args.styles),
      publicAssets: splitList(args.assets),
    },
    canvaWorkspace,
    notes: pickFirst(args.notes, args.note) || "",
    nextCodexActions: [
      "For Figma links with nodeId, call the Figma design-context tool and save screenshot/assets into this folder.",
      "For Canva links or exports, place source exports under design/exports/<slug>/ before moving final public assets.",
      "Translate approved visual decisions into src/components/, src/styles/, and src/pages/ without using Canva/Figma as the production host.",
    ],
  };

  const readme = renderReadme(intake);
  const json = `${JSON.stringify(intake, null, 2)}\n`;

  if (dryRun) {
    console.log(readme);
    console.log("--- intake.json ---");
    console.log(json);
    return;
  }

  await mkdir(path.join(targetDir, "images"), { recursive: true });
  await writeFile(path.join(targetDir, "README.md"), readme, "utf8");
  await writeFile(path.join(targetDir, "intake.json"), json, "utf8");
  await writeFile(path.join(targetDir, "images", ".gitkeep"), "", "utf8");

  console.log(`Created ${relative(targetDir)}`);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith("--")) {
      addArg(args, "_", item);
      continue;
    }

    const withoutPrefix = item.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");

    if (equalsIndex !== -1) {
      addArg(args, withoutPrefix.slice(0, equalsIndex), withoutPrefix.slice(equalsIndex + 1));
      continue;
    }

    const key = withoutPrefix;
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      addArg(args, key, true);
      continue;
    }

    addArg(args, key, next);
    index += 1;
  }

  return args;
}

function addArg(args, key, value) {
  if (args[key] === undefined) {
    args[key] = value;
    return;
  }

  if (Array.isArray(args[key])) {
    args[key].push(value);
    return;
  }

  args[key] = [args[key], value];
}

function pickFirst(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const first = value.find((item) => item !== undefined && item !== true && String(item).trim());
      if (first) return String(first).trim();
      continue;
    }

    if (value !== undefined && value !== true && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeList(value) {
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [String(value)].filter(Boolean);
}

function splitList(value) {
  return normalizeList(value)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFigmaUrl(url) {
  const fallback = { url, kind: "unknown", fileKey: "", branchKey: "", nodeId: "", needsNodeSpecificUrl: true };

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const kind = parts[0] || "unknown";
    const branchIndex = parts.indexOf("branch");
    const branchKey = branchIndex >= 0 ? parts[branchIndex + 1] || "" : "";
    const fileKey = branchKey || parts[1] || "";
    const nodeId = (parsed.searchParams.get("node-id") || "").replace("-", ":");

    return {
      url,
      kind,
      fileKey,
      branchKey,
      nodeId,
      needsNodeSpecificUrl: !nodeId && kind !== "make",
      codexToolHint: nodeId || kind === "make" ? "figma.get_design_context" : "request node-specific URL",
    };
  } catch {
    return fallback;
  }
}

function parseCanvaUrl(url) {
  const fallback = { url, kind: "unknown", designId: "" };

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const designIndex = parts.indexOf("design");

    return {
      url,
      kind: designIndex >= 0 ? "design" : parts[0] || "unknown",
      designId: designIndex >= 0 ? parts[designIndex + 1] || "" : "",
    };
  } catch {
    return fallback;
  }
}

function renderReadme(intake) {
  const figmaRows = intake.sourceLinks.figma.length
    ? intake.sourceLinks.figma
        .map((item) => `| ${item.url} | ${item.fileKey || "-"} | ${item.nodeId || "-"} | ${item.codexToolHint} |`)
        .join("\n")
    : "| - | - | - | - |";
  const canvaRows = intake.sourceLinks.canva.length
    ? intake.sourceLinks.canva.map((item) => `| ${item.url} | ${item.designId || "-"} |`).join("\n")
    : "| - | - |";
  const referenceLinks = intake.sourceLinks.references.length
    ? intake.sourceLinks.references.map((item) => `- ${item.url}`).join("\n")
    : "- TODO";
  const workspaceLine = intake.canvaWorkspace
    ? `[${intake.canvaWorkspace.name}](${intake.canvaWorkspace.folderUrl}), folder ID: \`${intake.canvaWorkspace.folderId}\``
    : "TODO";

  return `# ${intake.title}

Created: ${intake.createdAt}
Status: ${intake.status}

## Figma Nodes

Use node-specific Figma URLs whenever possible. A good URL includes \`node-id\`.

| URL | File key | Node ID | Codex action |
| --- | --- | --- | --- |
${figmaRows}

## Canva Links

| URL | Design ID |
| --- | --- |
${canvaRows}

Canva workspace: ${workspaceLine}

## Other References

${referenceLinks}

## Implementation Target

- Pages: ${formatList(intake.implementationTarget.pages)}
- Components: ${formatList(intake.implementationTarget.components)}
- Styles: ${formatList(intake.implementationTarget.styles)}
- Public assets: ${formatList(intake.implementationTarget.publicAssets)}

## Asset Staging

- Source exports: \`design/exports/${intake.slug}/\`
- Local screenshots: \`design/references/${intake.slug}/images/\`
- Production assets: \`public/assets/design/${intake.slug}/\`

## Notes

${intake.notes || "TODO"}

## Next Codex Actions

${intake.nextCodexActions.map((item) => `- ${item}`).join("\n")}
`;
}

function formatList(items) {
  return items.length ? items.map((item) => `\`${item}\``).join(", ") : "TODO";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "design-intake";
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readCanvaWorkspace() {
  const workspacePath = path.join(rootDir, "design", "canva-workspace.json");

  try {
    return JSON.parse(await readFile(workspacePath, "utf8"));
  } catch {
    return null;
  }
}

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

function printHelp() {
  console.log(`Create a design intake folder under design/references/.

Usage:
  pnpm design:intake -- --name "Homepage refresh" --figma "https://figma.com/design/FILE/Name?node-id=1-2"

Options:
  --name <title>        Human-readable intake title
  --slug <slug>         Folder name override
  --figma <url>         Figma design URL, preferably with node-id
  --canva <url>         Canva design URL
  --source <url>        Other reference URL
  --pages <paths>       Comma-separated page targets
  --components <paths>  Comma-separated component targets
  --styles <paths>      Comma-separated style targets
  --assets <paths>      Comma-separated public asset targets
  --notes <text>        Short design intent note
  --force               Replace existing intake files
  --dry-run             Print output without writing files
`);
}
