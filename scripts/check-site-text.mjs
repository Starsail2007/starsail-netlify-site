import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scannedRoots = [
  "src/layouts",
  "src/pages",
  "src/components",
  "src/scripts",
  "src/worldcup/components"
];
const scannedExtensions = new Set([".astro", ".js", ".ts"]);
const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const visibleWordPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[A-Za-z][A-Za-z0-9'’.,!?& +:/()-]{1,}/u;
const visibleAttributes = [
  "aria-label",
  "alt",
  "title",
  "placeholder"
];

const findings = [];

for (const scanRoot of scannedRoots) {
  await scanPath(path.join(root, scanRoot));
}

if (findings.length > 0) {
  console.error("\nPossible hardcoded webpage text found outside src/content/site-text.md.\n");
  console.error("Move editable text into src/content/site-text.md and reference it through src/content/siteText.ts.\n");

  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}:${finding.column} ${finding.reason}`);
    console.error(`  ${finding.preview}`);
  }

  console.error("\nDynamic data, API errors, and service-layer messages are intentionally not scanned here.\n");
  process.exit(1);
}

console.log("Site text check passed. Editable webpage text is centralized.");

async function scanPath(targetPath) {
  let entries;

  try {
    entries = await readdir(targetPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await scanPath(entryPath);
      continue;
    }

    if (!entry.isFile() || !scannedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    await scanFile(entryPath);
  }
}

async function scanFile(filePath) {
  const source = await readFile(filePath, "utf8");
  const relativeFile = path.relative(root, filePath);

  scanCjkLines(source, relativeFile);

  if (filePath.endsWith(".astro")) {
    const markup = stripAstroNonMarkup(source);
    scanTextNodes(markup, source, relativeFile);
    scanVisibleAttributes(markup, source, relativeFile);
  }
}

function scanCjkLines(source, file) {
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (!cjkPattern.test(line)) {
      return;
    }

    findings.push({
      file,
      line: index + 1,
      column: line.search(cjkPattern) + 1,
      reason: "CJK text literal",
      preview: line.trim()
    });
  });
}

function scanTextNodes(markup, fullSource, file) {
  const textNodePattern = />((?:[^<]|<(?!!--))*?)</gs;
  let match;

  while ((match = textNodePattern.exec(markup))) {
    const rawText = match[1];
    const staticText = normalizeStaticText(rawText);

    if (!isVisibleText(staticText)) {
      continue;
    }

    addFindingFromIndex(fullSource, file, match.index + 1, "Static text node", staticText);
  }
}

function scanVisibleAttributes(markup, fullSource, file) {
  const attrPattern = new RegExp(`\\b(${visibleAttributes.join("|")})\\s*=\\s*"([^"]+)"`, "g");
  let match;

  while ((match = attrPattern.exec(markup))) {
    const value = match[2];

    if (!isVisibleText(value)) {
      continue;
    }

    addFindingFromIndex(fullSource, file, match.index, `Static ${match[1]} attribute`, value);
  }
}

function stripAstroNonMarkup(source) {
  return maskAstroExpressions(source
    .replace(/^---[\s\S]*?---/, blank)
    .replace(/<script[\s\S]*?<\/script>/gi, blank)
    .replace(/<style[\s\S]*?<\/style>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank));
}

function normalizeStaticText(value) {
  return value
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisibleText(value) {
  if (!value || value.length < 2) {
    return false;
  }

  return visibleWordPattern.test(value);
}

function addFindingFromIndex(source, file, index, reason, preview) {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");

  findings.push({
    file,
    line,
    column,
    reason,
    preview
  });
}

function maskAstroExpressions(source) {
  let masked = "";
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
      masked += " ";
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      masked += " ";
      continue;
    }

    masked += depth > 0 && char !== "\n" ? " " : char;
  }

  return masked;
}

function blank(value) {
  return value.replace(/[^\n]/g, " ");
}
