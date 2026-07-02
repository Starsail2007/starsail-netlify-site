const MINUTE = 60 * 1_000;
const HOUR = 60 * MINUTE;

export const WORLD_CUP_REFRESH_INTERVALS = {
  live: 5 * MINUTE,
  matchWindow: 5 * MINUTE,
  nearMatch: HOUR,
  quiet: 6 * HOUR
};

export const WORLD_CUP_REFRESH_WINDOWS = {
  nearMatch: 24 * HOUR,
  preMatch: 30 * MINUTE,
  postKickoff: 150 * MINUTE
};

export function computeWorldCupRefreshPolicy(matches, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const nowMs = now.getTime();
  const lastUpdated = parseDate(options.lastUpdated);
  const sortedMatches = sortMatches(matches);
  const activeMatches = sortedMatches.filter((match) => isInMatchWindow(match, nowMs));
  const nextMatch = sortedMatches.find((match) => {
    const kickoff = parseDate(match.kickoffTime);
    return kickoff && kickoff.getTime() > nowMs;
  });
  const liveMatch = activeMatches.find((match) => isLiveStatus(match.status));

  if (liveMatch) {
    return buildPolicy({
      mode: "live",
      label: "live",
      now,
      lastUpdated,
      intervalMs: WORLD_CUP_REFRESH_INTERVALS.live,
      match: liveMatch
    });
  }

  if (activeMatches.length) {
    return buildPolicy({
      mode: "match-window",
      label: "match-window",
      now,
      lastUpdated,
      intervalMs: WORLD_CUP_REFRESH_INTERVALS.matchWindow,
      match: activeMatches[0]
    });
  }

  if (!nextMatch) {
    return buildPolicy({
      mode: "complete",
      label: "tournament-complete",
      now,
      lastUpdated,
      intervalMs: WORLD_CUP_REFRESH_INTERVALS.quiet,
      match: null
    });
  }

  const kickoff = parseDate(nextMatch.kickoffTime);
  const kickoffMs = kickoff.getTime();
  const msUntilKickoff = kickoffMs - nowMs;
  const preMatchAt = new Date(kickoffMs - WORLD_CUP_REFRESH_WINDOWS.preMatch);

  if (msUntilKickoff <= WORLD_CUP_REFRESH_WINDOWS.nearMatch) {
    return buildPolicy({
      mode: "near-match",
      label: "near-match",
      now,
      lastUpdated,
      intervalMs: WORLD_CUP_REFRESH_INTERVALS.nearMatch,
      match: nextMatch,
      boundaryAt: preMatchAt
    });
  }

  const nearMatchAt = new Date(kickoffMs - WORLD_CUP_REFRESH_WINDOWS.nearMatch);

  return buildPolicy({
    mode: "quiet",
    label: "quiet",
    now,
    lastUpdated,
    intervalMs: WORLD_CUP_REFRESH_INTERVALS.quiet,
    match: nextMatch,
    boundaryAt: nearMatchAt
  });
}

function buildPolicy({ mode, label, now, lastUpdated, intervalMs, match, boundaryAt = null }) {
  const nowMs = now.getTime();
  const intervalNextAt = lastUpdated
    ? new Date(lastUpdated.getTime() + intervalMs)
    : now;
  const nextFetchAt = boundaryAt && boundaryAt.getTime() > nowMs
    ? minDate(intervalNextAt, boundaryAt)
    : intervalNextAt;
  const due = !lastUpdated || nextFetchAt.getTime() <= nowMs;

  return {
    mode,
    label,
    due,
    intervalSeconds: Math.round(intervalMs / 1_000),
    nextFetchAt: nextFetchAt.toISOString(),
    generatedAt: now.toISOString(),
    nextMatch: match ? summarizeMatch(match) : null
  };
}

function summarizeMatch(match) {
  return {
    id: String(match.id || ""),
    stage: match.stage || match.round || "",
    kickoffTime: match.kickoffTime || "",
    home: match.home?.name || "",
    away: match.away?.name || "",
    status: match.status || ""
  };
}

function isInMatchWindow(match, nowMs) {
  if (isLiveStatus(match.status)) {
    return true;
  }

  const kickoff = parseDate(match.kickoffTime);

  if (!kickoff) {
    return false;
  }

  const kickoffMs = kickoff.getTime();
  return (
    nowMs >= kickoffMs - WORLD_CUP_REFRESH_WINDOWS.preMatch
    && nowMs <= kickoffMs + WORLD_CUP_REFRESH_WINDOWS.postKickoff
  );
}

function isLiveStatus(status) {
  return ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(String(status || "").toUpperCase());
}

function sortMatches(matches) {
  return [...(Array.isArray(matches) ? matches : [])]
    .filter((match) => parseDate(match.kickoffTime))
    .sort((a, b) => parseDate(a.kickoffTime).getTime() - parseDate(b.kickoffTime).getTime());
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function minDate(dateA, dateB) {
  return dateA.getTime() <= dateB.getTime() ? dateA : dateB;
}
