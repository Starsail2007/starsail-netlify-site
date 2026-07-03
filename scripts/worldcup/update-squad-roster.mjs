import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const FIFA_SQUAD_LIST_URL = "https://fdp.fifa.org/assetspublic/ce281/pdf/SquadLists-English.pdf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const args = parseArgs(process.argv.slice(2));
const outputPath = resolve(projectRoot, args.output || "src/worldcup/data/squad-roster.json");
const sourceUrl = args.source || FIFA_SQUAD_LIST_URL;

const pdfBytes = await downloadPdf(sourceUrl);
const pdf = await getDocument({ data: pdfBytes, disableWorker: true }).promise;
const teams = [];
let pdfVersion = "";

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const lines = await readPageLines(page);
  const team = parseTeamPage(lines, pageNumber);

  if (team) {
    teams.push(team);
  }

  if (!pdfVersion) {
    pdfVersion = findPdfVersion(lines);
  }
}

const payload = {
  source: {
    title: "FIFA World Cup 2026 SquadLists-English.pdf",
    url: sourceUrl,
    version: pdfVersion
  },
  generatedAt: new Date().toISOString(),
  teamCount: teams.length,
  playerCount: teams.reduce((total, team) => total + team.players.length, 0),
  teams
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[worldcup:squads] Wrote ${outputPath}`);
console.log(`[worldcup:squads] Teams: ${payload.teamCount}. Players: ${payload.playerCount}. Source: ${sourceUrl}`);

async function downloadPdf(url) {
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download FIFA squad list: HTTP ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function readPageLines(page) {
  const content = await page.getTextContent();
  const byY = new Map();

  for (const item of content.items) {
    const text = cleanText(item.str);

    if (!text) {
      continue;
    }

    const y = Math.round(item.transform[5]);
    const x = Math.round(item.transform[4]);

    if (!byY.has(y)) {
      byY.set(y, []);
    }

    byY.get(y).push({ x, text });
  }

  return [...byY.entries()]
    .map(([y, parts]) => ({
      y,
      parts: parts.sort((a, b) => a.x - b.x),
      text: parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(/\s+/g, " ").trim()
    }))
    .sort((a, b) => b.y - a.y);
}

function parseTeamPage(lines, pageNumber) {
  const teamLine = lines.find((line) => /^.+\s\([A-Z]{3}\)$/.test(line.text));

  if (!teamLine) {
    return null;
  }

  const [, teamName, teamCode] = teamLine.text.match(/^(.+)\s\(([A-Z]{3})\)$/);
  const players = lines
    .filter((line) => isPlayerLine(line))
    .map((line) => parsePlayerLine(line, { teamName, teamCode, pageNumber }))
    .filter(Boolean)
    .sort((a, b) => a.squadNumber - b.squadNumber);

  const coachLine = lines.find((line) => line.text.startsWith("Head coach "));

  return {
    teamName,
    teamCode,
    pageNumber,
    headCoach: coachLine ? parseCoachLine(coachLine.text) : null,
    players
  };
}

function isPlayerLine(line) {
  const fields = getLineFields(line.parts);
  const number = fields[0];
  const position = fields[1];

  return /^\d{1,2}$/.test(number) && /^(?:GK|DF|MF|FW)$/.test(position);
}

function parsePlayerLine(line, team) {
  const fields = getLineFields(line.parts);
  const squadNumber = Number(fields[0]);
  const position = fields[1] || "";
  const playerName = fields[2] || "";
  const firstNames = fields[3] || "";
  const lastNames = fields[4] || "";
  const nameOnShirt = fields[5] || "";
  const dateOfBirth = fields[6] || "";
  const club = fields[7] || "";
  const heightCm = Number(fields[8]);
  const caps = Number(fields[9]);
  const goals = Number(fields[10]);

  if (!squadNumber || !position || !playerName) {
    return null;
  }

  const commonName = buildCommonName(firstNames, lastNames, playerName);

  return {
    id: `${team.teamCode}-${String(squadNumber).padStart(2, "0")}`,
    key: `${team.teamCode}::${playerName}`,
    teamName: team.teamName,
    teamCode: team.teamCode,
    squadNumber,
    position,
    playerName,
    firstNames,
    lastNames,
    nameOnShirt,
    commonName,
    originalName: buildOriginalName(firstNames, lastNames, playerName),
    dateOfBirth,
    dateOfBirthIso: toIsoDate(dateOfBirth),
    club,
    heightCm: Number.isFinite(heightCm) ? heightCm : null,
    caps: Number.isFinite(caps) ? caps : null,
    goals: Number.isFinite(goals) ? goals : null
  };
}

function parseCoachLine(text) {
  return text.replace(/^Head coach\s+/, "").trim();
}

function getLineFields(parts) {
  return parts.map((part) => part.text).filter(Boolean);
}

function buildCommonName(firstNames, lastNames, fallback) {
  const first = cleanText(firstNames).split(/\s+/)[0] || "";
  const last = titleCaseName(lastNames);
  const name = `${first} ${last}`.trim();
  return name || fallback;
}

function buildOriginalName(firstNames, lastNames, fallback) {
  return `${firstNames || ""} ${lastNames || ""}`.replace(/\s+/g, " ").trim() || fallback;
}

function titleCaseName(value) {
  return cleanText(value)
    .split(/\s+/)
    .map((token) => token
      .split("-")
      .map((part) => part ? `${part[0].toLocaleUpperCase("en-US")}${part.slice(1).toLocaleLowerCase("en-US")}` : part)
      .join("-"))
    .join(" ");
}

function toIsoDate(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return "";
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function findPdfVersion(lines) {
  return lines.find((line) => /Version\s+\d+/.test(line.text))?.text || "";
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--output") {
      parsed.output = values[index + 1];
      index += 1;
    } else if (value === "--source") {
      parsed.source = values[index + 1];
      index += 1;
    }
  }

  return parsed;
}
