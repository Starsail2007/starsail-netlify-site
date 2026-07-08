const BASE_PATH = import.meta.env.BASE_URL || "/";
const DATA_STALE_GRACE_MS = 2 * 60 * 1_000;
const REPOSITORY_DATA_ENDPOINT = "https://raw.githubusercontent.com/Starsail2007/starsail-netlify-site/worldcup-data/public/data/worldcup-live.json";
const STATIC_DATA_ENDPOINT = withBasePath("/data/worldcup-live.json");
const NETLIFY_FUNCTION_ENDPOINT = withBasePath("/.netlify/functions/worldcup-live");
const NETLIFY_FUNCTION_ORIGIN_ENDPOINT = "https://starsail.netlify.app/.netlify/functions/worldcup-live";
const ENABLE_NETLIFY_FUNCTION_FALLBACK = String(import.meta.env.PUBLIC_WORLDCUP_NETLIFY_FUNCTION_FALLBACK || "false") === "true";

export const DATA_ENDPOINT = REPOSITORY_DATA_ENDPOINT;
export const DATA_ENDPOINTS = buildDataEndpoints();

export async function fetchDataPayload() {
  let lastError = null;
  const stalePayloads = [];

  for (const endpoint of DATA_ENDPOINTS) {
    try {
      const response = await fetch(withCacheBust(endpoint), { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`${endpoint} returned HTTP ${response.status}`);
      }

      const payload = await response.json();

      if (!isPayloadRefreshOverdue(payload)) {
        return payload;
      }

      stalePayloads.push(payload);
    } catch (error) {
      lastError = error;
    }
  }

  const newestStalePayload = pickNewestPayload(stalePayloads);

  if (newestStalePayload) {
    return newestStalePayload;
  }

  throw lastError || new Error("No World Cup data endpoint is available.");
}

export function normalizeClientPayload(payload) {
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const allMatches = Array.isArray(payload?.allMatches) && payload.allMatches.length
    ? payload.allMatches
    : matches;

  return {
    source: payload?.source || "unknown",
    message: payload?.message || "",
    lastUpdated: payload?.lastUpdated || new Date().toISOString(),
    matches,
    allMatches,
    upcomingMatches: Array.isArray(payload?.upcomingMatches) ? payload.upcomingMatches : [],
    timelineMatches: Array.isArray(payload?.timelineMatches) ? payload.timelineMatches : [],
    groupStage: Array.isArray(payload?.groupStage) ? payload.groupStage : [],
    knockout: Array.isArray(payload?.knockout) ? payload.knockout : [],
    polling: payload?.polling || null
  };
}

function buildDataEndpoints() {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (localHosts.has(window.location.hostname)) {
    return uniqueEndpoints([STATIC_DATA_ENDPOINT, REPOSITORY_DATA_ENDPOINT, NETLIFY_FUNCTION_ORIGIN_ENDPOINT]);
  }

  if (window.location.hostname.endsWith("github.io")) {
    return uniqueEndpoints([REPOSITORY_DATA_ENDPOINT, STATIC_DATA_ENDPOINT, NETLIFY_FUNCTION_ORIGIN_ENDPOINT]);
  }

  if (ENABLE_NETLIFY_FUNCTION_FALLBACK) {
    return uniqueEndpoints([REPOSITORY_DATA_ENDPOINT, STATIC_DATA_ENDPOINT, NETLIFY_FUNCTION_ENDPOINT, NETLIFY_FUNCTION_ORIGIN_ENDPOINT]);
  }

  return uniqueEndpoints([REPOSITORY_DATA_ENDPOINT, STATIC_DATA_ENDPOINT]);
}

function withBasePath(path) {
  if (!path || path === "#" || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) {
    return path;
  }

  const normalizedBase = BASE_PATH.endsWith("/") ? BASE_PATH : `${BASE_PATH}/`;
  const cleanedPath = path.startsWith("/") ? path.slice(1) : path;

  return `${normalizedBase}${cleanedPath}`;
}

function withCacheBust(endpoint) {
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}t=${Date.now()}`;
}

function uniqueEndpoints(endpoints) {
  return [...new Set(endpoints.filter(Boolean))];
}

function isPayloadRefreshOverdue(payload) {
  const nextFetchAt = new Date(payload?.polling?.nextFetchAt || "").getTime();

  return Number.isFinite(nextFetchAt) && nextFetchAt + DATA_STALE_GRACE_MS < Date.now();
}

function pickNewestPayload(payloads) {
  return [...payloads]
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left?.lastUpdated || 0).getTime();
      const rightTime = new Date(right?.lastUpdated || 0).getTime();

      return rightTime - leftTime;
    })[0] || null;
}
