import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeWorldCupRefreshPolicy } from "../../src/worldcup/lib/refreshPolicy.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const REPOSITORY_DATA_ENDPOINT = "https://raw.githubusercontent.com/Starsail2007/starsail-netlify-site/worldcup-data/public/data/worldcup-live.json";
const NETLIFY_FUNCTION_ENDPOINT = "https://starsail.netlify.app/.netlify/functions/worldcup-live";
const NETLIFY_STATIC_ENDPOINT = "https://starsail.netlify.app/data/worldcup-live.json";
const GITHUB_PAGES_STATIC_ENDPOINT = "https://starsail2007.github.io/starsail-netlify-site/data/worldcup-live.json";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const now = new Date();
const timeoutMs = Number(process.env.WORLD_CUP_HEALTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

const endpoints = [
  {
    id: "repository",
    label: "GitHub worldcup-data",
    type: "remote",
    url: process.env.WORLD_CUP_REPOSITORY_DATA_URL || REPOSITORY_DATA_ENDPOINT,
    primary: true
  },
  {
    id: "netlify-function",
    label: "Netlify Function",
    type: "remote",
    url: process.env.WORLD_CUP_NETLIFY_FUNCTION_URL || NETLIFY_FUNCTION_ENDPOINT,
    fallback: true
  },
  {
    id: "netlify-static",
    label: "Netlify static JSON",
    type: "remote",
    url: process.env.WORLD_CUP_NETLIFY_STATIC_URL || NETLIFY_STATIC_ENDPOINT
  },
  {
    id: "github-pages-static",
    label: "GitHub Pages static JSON",
    type: "remote",
    url: process.env.WORLD_CUP_GITHUB_PAGES_STATIC_URL || GITHUB_PAGES_STATIC_ENDPOINT
  },
  {
    id: "local-static",
    label: "Local public/data",
    type: "file",
    path: resolve(projectRoot, process.env.WORLD_CUP_LOCAL_DATA_PATH || "public/data/worldcup-live.json")
  }
];

const checks = await Promise.all(endpoints.map(checkEndpoint));
const report = buildReport(checks);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

if (args.strict && report.status !== "OK") {
  process.exit(report.status === "FAILED" ? 2 : 1);
}

async function checkEndpoint(endpoint) {
  try {
    const payload = endpoint.type === "file"
      ? await readJsonFile(endpoint.path)
      : await fetchJson(endpoint.url);
    const matches = readMatches(payload);

    if (!matches.length) {
      throw new Error("payload has no matches");
    }

    const lastUpdated = parseDate(payload.lastUpdated);
    const policy = computeWorldCupRefreshPolicy(matches, {
      now,
      lastUpdated
    });
    const fresh = !policy.due;

    return {
      ...endpoint,
      status: fresh ? "OK" : "STALE",
      fresh,
      reachable: true,
      source: payload.source || "unknown",
      message: payload.message || "",
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : "",
      ageSeconds: lastUpdated ? Math.max(0, Math.round((now.getTime() - lastUpdated.getTime()) / 1_000)) : null,
      matchCount: matches.length,
      upcomingCount: Array.isArray(payload.upcomingMatches) ? payload.upcomingMatches.length : null,
      timelineCount: Array.isArray(payload.timelineMatches) ? payload.timelineMatches.length : null,
      storedNextFetchAt: payload.polling?.nextFetchAt || "",
      policy,
      nextMatch: policy.nextMatch,
      error: ""
    };
  } catch (error) {
    return {
      ...endpoint,
      status: "FAILED",
      fresh: false,
      reachable: false,
      source: "",
      message: "",
      lastUpdated: "",
      ageSeconds: null,
      matchCount: 0,
      upcomingCount: null,
      timelineCount: null,
      storedNextFetchAt: "",
      policy: null,
      nextMatch: null,
      error: formatError(error)
    };
  }
}

function buildReport(checks) {
  const primary = checks.find((check) => check.primary);
  const functionFallback = checks.find((check) => check.id === "netlify-function");
  const freshChecks = checks.filter((check) => check.fresh);
  const reachableChecks = checks.filter((check) => check.reachable);
  const reference = pickReferenceCheck(freshChecks.length ? freshChecks : reachableChecks);
  const status = determineOverallStatus({ primary, functionFallback, freshChecks, reachableChecks });

  return {
    status,
    checkedAt: now.toISOString(),
    summary: buildSummary({ status, primary, functionFallback, reference, freshChecks, reachableChecks }),
    expectedMode: reference?.policy?.mode || "",
    expectedNextFetchAt: reference?.policy?.nextFetchAt || "",
    nextMatch: reference?.nextMatch || null,
    endpoints: checks.map((check) => serializeCheck(check))
  };
}

function determineOverallStatus({ primary, functionFallback, freshChecks, reachableChecks }) {
  if (primary?.fresh) {
    return "OK";
  }

  if (functionFallback?.fresh || freshChecks.length) {
    return "DEGRADED";
  }

  if (reachableChecks.length) {
    return "STALE";
  }

  return "FAILED";
}

function buildSummary({ status, primary, functionFallback, reference, freshChecks, reachableChecks }) {
  if (status === "OK") {
    return "Primary static data is fresh.";
  }

  if (status === "DEGRADED" && functionFallback?.fresh) {
    return "Primary static data is stale, but Netlify Function can serve a fresh fallback.";
  }

  if (status === "DEGRADED" && freshChecks.length) {
    return "Primary static data is stale, but at least one fallback endpoint is fresh.";
  }

  if (status === "STALE" && reachableChecks.length) {
    return `All reachable data is overdue. Newest reachable source was updated ${formatDuration(reference?.ageSeconds)} ago.`;
  }

  return "No World Cup data endpoint returned a usable payload.";
}

function serializeCheck(check) {
  return {
    id: check.id,
    label: check.label,
    status: check.status,
    fresh: check.fresh,
    source: check.source,
    lastUpdated: check.lastUpdated,
    ageSeconds: check.ageSeconds,
    matchCount: check.matchCount,
    upcomingCount: check.upcomingCount,
    timelineCount: check.timelineCount,
    expectedMode: check.policy?.mode || "",
    expectedNextFetchAt: check.policy?.nextFetchAt || "",
    storedNextFetchAt: check.storedNextFetchAt,
    nextMatch: check.nextMatch,
    message: check.message,
    error: check.error,
    url: check.url || "",
    path: check.path || ""
  };
}

function pickReferenceCheck(checks) {
  return [...checks]
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left.lastUpdated || 0).getTime();
      const rightTime = new Date(right.lastUpdated || 0).getTime();

      return rightTime - leftTime;
    })[0] || null;
}

async function fetchJson(url) {
  const response = await fetch(withCacheBust(url), {
    cache: "no-store",
    headers: {
      "Accept": "application/json",
      "Cache-Control": "no-cache",
      "User-Agent": "starsail-worldcup-health-check"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function readMatches(payload) {
  if (Array.isArray(payload?.allMatches) && payload.allMatches.length) {
    return payload.allMatches;
  }

  return Array.isArray(payload?.matches) ? payload.matches : [];
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function withCacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

function printHumanReport(report) {
  console.log(`World Cup data health: ${report.status}`);
  console.log(`Checked at: ${report.checkedAt}`);
  console.log(`Summary: ${report.summary}`);

  if (report.expectedMode) {
    console.log(`Expected refresh mode: ${report.expectedMode}`);
    console.log(`Expected next fetch: ${report.expectedNextFetchAt}`);
  }

  if (report.nextMatch) {
    console.log(`Next match: ${formatMatch(report.nextMatch)}`);
  }

  console.log("");
  console.log("Endpoints:");

  for (const endpoint of report.endpoints) {
    const age = endpoint.ageSeconds === null ? "unknown age" : `${formatDuration(endpoint.ageSeconds)} old`;
    const nextFetch = endpoint.expectedNextFetchAt ? `; next ${endpoint.expectedNextFetchAt}` : "";
    const details = endpoint.status === "FAILED"
      ? endpoint.error
      : `${endpoint.source}; ${endpoint.matchCount} matches; ${age}; mode ${endpoint.expectedMode || "unknown"}${nextFetch}`;

    console.log(`- ${endpoint.status} ${endpoint.label}: ${details}`);
  }
}

function formatMatch(match) {
  return [
    match.stage,
    `${match.home || "TBD"} vs ${match.away || "TBD"}`,
    match.kickoffTime,
    match.status
  ].filter(Boolean).join(" | ");
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "unknown";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 48) {
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function parseArgs(rawArgs) {
  return {
    json: rawArgs.includes("--json"),
    strict: rawArgs.includes("--strict")
  };
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
