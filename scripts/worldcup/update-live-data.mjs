import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mockWorldCupData } from "../../src/worldcup/lib/mockWorldCupData.js";
import {
  normalizeApiFootballData,
  normalizeOpenFootballData
} from "../../src/worldcup/lib/normalizeWorldCupData.js";
import { computeWorldCupRefreshPolicy } from "../../src/worldcup/lib/refreshPolicy.js";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const OPENFOOTBALL_2026_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const DEFAULT_LEAGUE_ID = "1";
const DEFAULT_SEASON = "2026";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const args = parseArgs(process.argv.slice(2));
const outputPath = resolve(projectRoot, args.output || process.env.WORLD_CUP_DATA_OUTPUT || "public/data/worldcup-live.json");
const currentUrl = args.currentUrl || process.env.WORLD_CUP_CURRENT_DATA_URL || "";
const force = args.force || process.env.WORLD_CUP_FORCE_UPDATE === "1";
const now = new Date();

const currentData = await readCurrentData(outputPath, currentUrl);
const currentPolicy = currentData
  ? computeWorldCupRefreshPolicy(currentData.allMatches?.length ? currentData.allMatches : currentData.matches, {
    now,
    lastUpdated: currentData.lastUpdated
  })
  : null;

if (!force && currentData && currentPolicy && !currentPolicy.due) {
  console.log(`[worldcup] Skip update. Next fetch at ${currentPolicy.nextFetchAt} (${currentPolicy.mode}).`);
  process.exit(0);
}

const result = await fetchTournamentData();
const lastUpdated = new Date();
const policy = computeWorldCupRefreshPolicy(result.data.allMatches?.length ? result.data.allMatches : result.data.matches, {
  now: lastUpdated,
  lastUpdated
});
const payload = {
  ...result.data,
  source: result.source,
  message: result.message,
  leagueId: process.env.FOOTBALL_LEAGUE_ID || DEFAULT_LEAGUE_ID,
  season: process.env.FOOTBALL_SEASON || DEFAULT_SEASON,
  polling: {
    ...policy,
    generatedBy: "github-actions-static-json"
  },
  lastUpdated: lastUpdated.toISOString()
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[worldcup] Wrote ${outputPath}`);
console.log(`[worldcup] Source: ${payload.source}. Matches: ${payload.allMatches?.length || payload.matches?.length || 0}. Next fetch: ${payload.polling.nextFetchAt}`);

async function fetchTournamentData() {
  const apiFootball = await fetchApiFootballData();

  if (apiFootball?.data?.matches?.length) {
    return apiFootball;
  }

  const openFootball = await fetchOpenFootballData(apiFootball?.error);

  if (openFootball?.data?.matches?.length) {
    return openFootball;
  }

  return {
    source: "mock",
    message: `未能获取世界杯公开数据，暂用模拟数据。${openFootball?.error || apiFootball?.error || ""}`.trim(),
    data: mockWorldCupData
  };
}

async function fetchApiFootballData() {
  const apiKey = process.env.FOOTBALL_API_KEY || process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return {
      data: null,
      error: "FOOTBALL_API_KEY is not configured."
    };
  }

  const leagueId = process.env.FOOTBALL_LEAGUE_ID || DEFAULT_LEAGUE_ID;
  const season = process.env.FOOTBALL_SEASON || DEFAULT_SEASON;
  const params = new URLSearchParams({ league: leagueId, season });

  try {
    const response = await fetch(`${API_FOOTBALL_BASE_URL}/fixtures?${params.toString()}`, {
      headers: {
        "x-apisports-key": apiKey
      }
    });

    if (!response.ok) {
      return {
        data: null,
        error: `API-Football request failed: HTTP ${response.status}`
      };
    }

    const raw = await response.json();

    if (raw?.errors?.plan) {
      return {
        data: null,
        error: `API-Football plan cannot access this season: ${raw.errors.plan}`
      };
    }

    const normalized = normalizeApiFootballData(raw);

    return {
      source: "api-football",
      message: "世界杯数据由 API-Football 定时更新。",
      data: normalized.matches.length ? normalized : null,
      error: normalized.matches.length ? "" : "API-Football returned no fixtures."
    };
  } catch (error) {
    return {
      data: null,
      error: `API-Football request failed: ${formatError(error)}`
    };
  }
}

async function fetchOpenFootballData(previousError = "") {
  try {
    const response = await fetch(OPENFOOTBALL_2026_URL, {
      headers: {
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok) {
      return {
        data: null,
        error: `openfootball request failed: HTTP ${response.status}`
      };
    }

    const raw = await response.json();
    const normalized = normalizeOpenFootballData(raw);

    return {
      source: "openfootball",
      message: `${previousError ? `${previousError} ` : ""}已改用 openfootball 免费公开赛程。`.trim(),
      data: normalized.matches.length ? normalized : null,
      error: normalized.matches.length ? "" : "openfootball returned no matches."
    };
  } catch (error) {
    return {
      data: null,
      error: `openfootball request failed: ${formatError(error)}`
    };
  }
}

async function readCurrentData(path, url) {
  const localData = await readJsonFile(path);

  if (localData) {
    return localData;
  }

  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

async function readJsonFile(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--force") {
      parsed.force = true;
    } else if (value === "--output") {
      parsed.output = values[index + 1];
      index += 1;
    } else if (value === "--current-url") {
      parsed.currentUrl = values[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function formatError(error) {
  return error instanceof Error ? error.message : "Unknown error";
}
