import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const args = parseArgs(process.argv.slice(2));
const mapPath = resolve(projectRoot, args.map || "src/worldcup/data/player-name-map.json");
const overridesPath = resolve(projectRoot, args.overrides || "src/worldcup/data/player-name-overrides.json");
const outputDir = resolve(projectRoot, args.output || "public/data/worldcup/player-names");

const TEAM_ALIASES = {
  BIH: ["Bosnia & Herzegovina", "Bosnia and Herzegovina"],
  CPV: ["Cape Verde"],
  COD: ["DR Congo", "Congo DR", "Congo Democratic Republic"],
  CIV: ["Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire"],
  CZE: ["Czech Republic"],
  IRN: ["Iran"],
  KOR: ["South Korea", "Korea Republic"],
  KSA: ["Saudi Arabia"],
  RSA: ["South Africa"],
  TUR: ["Turkey", "Turkiye", "Türkiye"],
  USA: ["United States", "US", "USA"]
};

const mapData = await readJson(mapPath);
const overridesData = await readJson(overridesPath);
const groupedPlayers = groupPlayers(mapData, overridesData);
const manifest = buildManifest(groupedPlayers, mapData);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const [teamCode, team] of Object.entries(groupedPlayers)) {
  await writeJson(resolve(outputDir, `${teamCode}.json`), {
    teamCode,
    teamName: team.teamName,
    players: team.players
  });
}

await writeJson(resolve(outputDir, "manifest.json"), manifest);

console.log(`[worldcup:player-shards] Wrote ${Object.keys(groupedPlayers).length} team shards to ${outputDir}`);

function groupPlayers(sourceMap, sourceOverrides) {
  const groups = {};
  const mergedEntries = new Map(Object.entries(sourceMap?.players || {}));

  for (const [key, override] of Object.entries(sourceOverrides?.players || {})) {
    mergedEntries.set(key, {
      ...(mergedEntries.get(key) || {}),
      ...override
    });
  }

  for (const [key, entry] of mergedEntries) {
    const teamCode = normalizeTeamCode(entry.teamCode || key.split("::")[0] || "misc");
    const teamName = entry.teamName || sourceMap?.teamStats?.[teamCode]?.teamName || teamCode;

    groups[teamCode] ||= {
      teamName,
      players: {}
    };
    groups[teamCode].players[key] = compactPlayerEntry(entry);
  }

  return Object.fromEntries(Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)));
}

function compactPlayerEntry(entry) {
  return compactObject({
    teamCode: entry.teamCode,
    teamName: entry.teamName,
    playerName: entry.playerName,
    commonName: entry.commonName,
    originalName: entry.originalName,
    nameOnShirt: entry.nameOnShirt,
    aliases: entry.aliases,
    zhName: entry.zhName,
    displayName: entry.displayName
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value)
    .filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === null || entryValue === "") {
        return false;
      }

      if (Array.isArray(entryValue) && entryValue.length === 0) {
        return false;
      }

      return true;
    }));
}

function buildManifest(groups, sourceMap) {
  const aliases = {};
  const teams = {};

  for (const [teamCode, team] of Object.entries(groups)) {
    const rawAliases = uniqueStrings([
      teamCode,
      team.teamName,
      sourceMap?.teamStats?.[teamCode]?.teamName,
      ...(TEAM_ALIASES[teamCode] || [])
    ]);

    teams[teamCode] = {
      teamCode,
      teamName: team.teamName,
      file: `${teamCode}.json`,
      aliases: rawAliases
    };

    for (const alias of rawAliases) {
      aliases[normalizeName(alias)] = teamCode;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      mapGeneratedAt: sourceMap?.source?.generatedAt || "",
      rosterVersion: sourceMap?.source?.rosterVersion || ""
    },
    teams,
    aliases
  };
}

function normalizeTeamCode(value) {
  return String(value || "misc").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, payload) {
  await writeFile(path, `${JSON.stringify(payload)}\n`, "utf8");
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}
