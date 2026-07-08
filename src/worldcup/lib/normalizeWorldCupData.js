import { flagUrl } from "./flagUrl.js";
import { TEAM_ISO2 } from "./teamIsoMap.js";

const STATUS_TEXT = {
  TBD: "待定",
  NS: "未开始",
  "1H": "上半场",
  HT: "中场",
  "2H": "下半场",
  ET: "加时",
  BT: "加时休息",
  P: "点球",
  SUSP: "暂停",
  INT: "中断",
  FT: "完场",
  AET: "加时完场",
  PEN: "点球结束",
  PST: "延期",
  CANC: "取消",
  ABD: "腰斩",
  AWD: "判定",
  WO: "弃权",
  LIVE: "进行中"
};

const UPCOMING_MATCH_LIMIT = 18;
const TIMELINE_MATCH_LIMIT = 10;
const KNOCKOUT_ROUNDS = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Match for third place",
  "Final"
];

export function normalizeApiFootballData(raw) {
  const fixtures = Array.isArray(raw?.response) ? raw.response : [];
  const matches = fixtures.map(normalizeFixture).filter(Boolean);

  return buildTournamentData({
    matches,
    knockout: []
  });
}

export function normalizeOpenAIScheduleData(raw) {
  const matches = Array.isArray(raw?.matches) ? raw.matches : [];
  const normalizedMatches = matches.map(normalizeOpenAIMatch).filter(Boolean);

  return buildTournamentData({
    matches: normalizedMatches,
    knockout: Array.isArray(raw?.knockout) ? raw.knockout : []
  });
}

export function normalizeOpenFootballData(raw, options = {}) {
  const matches = Array.isArray(raw?.matches) ? raw.matches : [];
  const from = options.from ? new Date(`${options.from}T00:00:00.000Z`) : null;
  const to = options.to ? new Date(`${options.to}T23:59:59.999Z`) : null;
  const allMatches = matches
    .map(normalizeOpenFootballMatch)
    .filter(Boolean);
  const windowMatches = allMatches.filter((match) => isInsideDateWindow(match.kickoffTime, from, to));

  return buildTournamentData({
    matches: windowMatches.length ? windowMatches : buildRelevantMatches(allMatches),
    allMatches,
    knockout: buildOpenFootballKnockout(matches)
  });
}

function normalizeFixture(item) {
  const fixture = item?.fixture;
  const home = item?.teams?.home;
  const away = item?.teams?.away;

  if (!fixture || !home || !away) {
    return null;
  }

  const status = fixture.status?.short || "NS";

  const penaltyScore = readApiFootballPenaltyScore(item.score);

  return {
    id: String(fixture.id),
    status,
    statusText: STATUS_TEXT[status] || fixture.status?.long || status,
    minute: fixture.status?.elapsed ?? null,
    stage: item.league?.round || item.league?.name || "世界杯",
    round: item.league?.round || "",
    group: "",
    venue: fixture.venue?.name || "待定球场",
    kickoffTime: fixture.date,
    home: normalizeTeam(home, item.goals?.home),
    away: normalizeTeam(away, item.goals?.away),
    penaltyScore,
    events: normalizeEvents(item.events)
  };
}

function normalizeOpenAIMatch(item) {
  if (!item?.home || !item?.away || !item?.kickoffTime) {
    return null;
  }

  return {
    id: String(item.id || `openai-${item.kickoffTime}-${item.home.name}-${item.away.name}`),
    status: item.status || "NS",
    statusText: item.statusText || STATUS_TEXT[item.status] || "未开始",
    minute: item.minute ?? null,
    stage: item.stage || "世界杯",
    round: item.round || item.stage || "",
    group: item.group || "",
    venue: item.venue || "待定球场",
    kickoffTime: item.kickoffTime,
    home: normalizeScheduleTeam(item.home),
    away: normalizeScheduleTeam(item.away),
    penaltyScore: normalizePenaltyScore(item.penaltyScore || item.score?.penalty || item.score?.p),
    events: Array.isArray(item.events) ? item.events : []
  };
}

function normalizeOpenFootballMatch(item) {
  if (!item?.date || !item?.time || !item?.team1 || !item?.team2) {
    return null;
  }

  const kickoffTime = parseOpenFootballKickoff(item.date, item.time);

  if (!kickoffTime) {
    return null;
  }

  const score = readOpenFootballScore(item.score);
  const penaltyScore = readOpenFootballPenaltyScore(item.score);
  const status = penaltyScore ? "PEN" : score ? "FT" : readScheduleStatus(kickoffTime);

  return {
    id: String(item.num || `openfootball-${item.date}-${item.team1}-${item.team2}`),
    status,
    statusText: STATUS_TEXT[status] || status,
    minute: status === "LIVE" ? estimateMinute(kickoffTime) : null,
    stage: item.group ? "Group Stage" : item.round || "世界杯",
    round: item.round || "",
    group: item.group || "",
    venue: item.ground || "待定球场",
    kickoffTime,
    home: normalizeScheduleTeam({
      name: item.team1,
      score: score?.[0] ?? null
    }),
    away: normalizeScheduleTeam({
      name: item.team2,
      score: score?.[1] ?? null
    }),
    penaltyScore,
    events: normalizeOpenFootballGoals(item)
  };
}

function normalizeScheduleTeam(sourceTeam) {
  const name = sourceTeam.name || "TBD";
  const iso2 = sourceTeam.iso2 || TEAM_ISO2[name] || "";

  return {
    name,
    code: sourceTeam.code || makeCode(name),
    iso2,
    logo: sourceTeam.logo || (iso2 ? flagUrl(iso2) : ""),
    flagUrl: sourceTeam.flagUrl || (iso2 ? flagUrl(iso2) : sourceTeam.logo || ""),
    score: sourceTeam.score ?? null
  };
}

function parseOpenFootballKickoff(date, time) {
  const match = String(time).match(/^(\d{1,2}):(\d{2})\s+UTC([+-]\d{1,2})$/);

  if (!match) {
    return null;
  }

  const [, hour, minute, offset] = match;
  const utcMs = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(hour) - Number(offset),
    Number(minute)
  );

  return new Date(utcMs).toISOString();
}

function readOpenFootballScore(score) {
  if (Array.isArray(score?.et)) {
    return score.et;
  }

  if (Array.isArray(score?.ft)) {
    return score.ft;
  }

  return null;
}

function readOpenFootballPenaltyScore(score) {
  return normalizePenaltyScore(score?.p);
}

function readApiFootballPenaltyScore(score) {
  return normalizePenaltyScore(score?.penalty);
}

function normalizePenaltyScore(value) {
  let home = null;
  let away = null;

  if (Array.isArray(value)) {
    [home, away] = value;
  } else if (value && typeof value === "object") {
    home = value.home ?? value.homeScore ?? value.team1 ?? null;
    away = value.away ?? value.awayScore ?? value.team2 ?? null;
  }

  if (!isExplicitScoreValue(home) || !isExplicitScoreValue(away)) {
    return null;
  }

  return {
    home: Number(home),
    away: Number(away)
  };
}

function isExplicitScoreValue(value) {
  return value !== null
    && value !== undefined
    && value !== ""
    && Number.isFinite(Number(value));
}

function normalizeOpenFootballGoals(item) {
  const goals1 = Array.isArray(item.goals1)
    ? item.goals1.map((goal) => normalizeOpenFootballGoal(goal, item.team1))
    : [];
  const goals2 = Array.isArray(item.goals2)
    ? item.goals2.map((goal) => normalizeOpenFootballGoal(goal, item.team2))
    : [];

  return [...goals1, ...goals2].sort((a, b) => Number(a.minuteSort || 0) - Number(b.minuteSort || 0));
}

function normalizeOpenFootballGoal(goal, team) {
  const minute = String(goal.minute || "").trim();

  return {
    type: "Goal",
    minute: minute || null,
    minuteSort: parseGoalMinute(minute),
    team,
    teamName: team,
    player: goal.name || "",
    penalty: Boolean(goal.penalty),
    ownGoal: Boolean(goal.owngoal)
  };
}

function readScheduleStatus(kickoffTime) {
  const now = Date.now();
  const kickoff = new Date(kickoffTime).getTime();

  if (now >= kickoff && now <= kickoff + 130 * 60 * 1_000) {
    return "LIVE";
  }

  if (now > kickoff + 130 * 60 * 1_000) {
    return "FT";
  }

  return "NS";
}

function estimateMinute(kickoffTime) {
  const elapsed = Math.max(1, Math.floor((Date.now() - new Date(kickoffTime).getTime()) / 60_000));
  return Math.min(120, elapsed);
}

function isInsideDateWindow(kickoffTime, from, to) {
  const date = new Date(kickoffTime);

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
}

function buildOpenFootballKnockout(matches) {
  const knockoutMatches = matches.filter((match) => isKnockoutRound(match.round));

  return knockoutMatches
    .map((match) => {
      const score = readOpenFootballScore(match.score);
      const penaltyScore = readOpenFootballPenaltyScore(match.score);
      const winner = readOpenFootballWinner(match);
      const nextMatchIds = findOpenFootballNextMatchIds(match, knockoutMatches, winner);

      return {
        id: String(match.num || `ko-${match.date}-${match.team1}-${match.team2}`),
        round: match.round,
        home: match.team1,
        away: match.team2,
        homeScore: score?.[0] ?? null,
        awayScore: score?.[1] ?? null,
        homePenaltyScore: penaltyScore?.home ?? null,
        awayPenaltyScore: penaltyScore?.away ?? null,
        penaltyScore,
        winner,
        status: penaltyScore ? "PEN" : score ? "FT" : "NS",
        nextMatchId: nextMatchIds[0] || "",
        nextMatchIds
      };
    });
}

function readOpenFootballWinner(match) {
  const score = match?.score;
  const decisiveScore = Array.isArray(score?.p)
    ? score.p
    : Array.isArray(score?.et)
      ? score.et
      : Array.isArray(score?.ft)
        ? score.ft
        : null;

  if (!decisiveScore || decisiveScore[0] === decisiveScore[1]) {
    return "";
  }

  return decisiveScore[0] > decisiveScore[1] ? match.team1 : match.team2;
}

function findOpenFootballNextMatchIds(match, knockoutMatches, winner) {
  const matchNumber = String(match.num || "");
  const winnerToken = matchNumber ? `W${matchNumber}` : "";
  const loserToken = matchNumber ? `L${matchNumber}` : "";
  const possibleEntrants = [winnerToken, loserToken, winner].filter(Boolean);

  return knockoutMatches
    .filter((candidate) => {
      if (candidate === match || Number(candidate.num || 0) <= Number(match.num || 0)) {
        return false;
      }

      return possibleEntrants.includes(candidate.team1) || possibleEntrants.includes(candidate.team2);
    })
    .map((candidate) => String(candidate.num || `ko-${candidate.date}-${candidate.team1}-${candidate.team2}`));
}

function isKnockoutRound(round) {
  return KNOCKOUT_ROUNDS.includes(round);
}

function normalizeTeam(sourceTeam, score) {
  const name = sourceTeam.name || "TBD";
  const iso2 = TEAM_ISO2[name] || "";

  return {
    name,
    code: makeCode(name),
    iso2,
    logo: sourceTeam.logo || (iso2 ? flagUrl(iso2) : ""),
    flagUrl: iso2 ? flagUrl(iso2) : sourceTeam.logo || "",
    score: score ?? null
  };
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter((event) => event?.type === "Goal")
    .map((event) => ({
      type: "Goal",
      minute: event.time?.elapsed ?? null,
      minuteSort: event.time?.elapsed ?? null,
      team: event.team?.name || "",
      teamName: event.team?.name || "",
      player: event.player?.name || ""
    }));
}

function makeCode(name) {
  if (!name || name === "TBD") {
    return "TBD";
  }

  if (/^[WL]\d+$/i.test(name)) {
    return name.toUpperCase();
  }

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function buildTournamentData({ matches, allMatches = matches, knockout }) {
  const sortedMatches = sortMatchesByKickoff(matches);
  const sortedAllMatches = sortMatchesByKickoff(allMatches);

  return {
    matches: sortedMatches,
    allMatches: sortedAllMatches,
    upcomingMatches: buildUpcomingMatches(sortedAllMatches),
    timelineMatches: buildTimelineMatches(sortedAllMatches),
    groupStage: buildGroupStage(sortedAllMatches),
    knockout: Array.isArray(knockout) ? knockout : []
  };
}

function buildRelevantMatches(matches) {
  const upcoming = buildUpcomingMatches(matches);

  if (upcoming.length) {
    return upcoming.slice(0, 8);
  }

  return sortMatchesByKickoff(matches).slice(-8);
}

function buildUpcomingMatches(matches) {
  const now = Date.now();

  return sortMatchesByKickoff(matches)
    .filter((match) => {
      const kickoff = new Date(match.kickoffTime).getTime();
      return match.status === "NS" || (Number.isFinite(kickoff) && kickoff > now);
    })
    .slice(0, UPCOMING_MATCH_LIMIT);
}

function buildTimelineMatches(matches) {
  return matches
    .filter((match) => Array.isArray(match.events) && match.events.length)
    .sort((a, b) => latestEventTime(b) - latestEventTime(a))
    .slice(0, TIMELINE_MATCH_LIMIT);
}

function buildGroupStage(matches) {
  const groupMap = new Map();

  for (const match of matches) {
    if (!match.group) {
      continue;
    }

    if (!groupMap.has(match.group)) {
      groupMap.set(match.group, []);
    }

    groupMap.get(match.group).push(match);
  }

  const groups = [...groupMap.entries()]
    .sort(([groupA], [groupB]) => compareGroupNames(groupA, groupB))
    .map(([group, groupMatches]) => {
      const sortedMatches = sortMatchesByKickoff(groupMatches);

      return {
        group,
        matches: sortedMatches,
        standings: buildGroupStandings(sortedMatches)
      };
    });

  return applyGroupQualification(groups);
}

function applyGroupQualification(groups) {
  const thirdPlaceQualifiers = new Set(
    groups
      .map((group) => group.standings?.[2])
      .filter(Boolean)
      .sort(compareStandings)
      .slice(0, 8)
      .map((team) => team.name)
  );

  return groups.map((group) => {
    const standings = (group.standings || []).map((team, index) => {
      const isAutomatic = index < 2;
      const isThirdPlaceQualifier = index === 2 && thirdPlaceQualifiers.has(team.name);

      return {
        ...team,
        rank: index + 1,
        isQualified: isAutomatic || isThirdPlaceQualifier,
        qualificationType: isAutomatic ? "automatic" : isThirdPlaceQualifier ? "third-place" : ""
      };
    });
    const qualificationCutIndex = findLastQualifiedIndex(standings);

    return {
      ...group,
      standings,
      qualificationCutIndex
    };
  });
}

function buildGroupStandings(matches) {
  const table = new Map();

  for (const match of matches) {
    ensureStanding(table, match.home.name);
    ensureStanding(table, match.away.name);

    if (!hasCompleteScore(match)) {
      continue;
    }

    const home = table.get(match.home.name);
    const away = table.get(match.away.name);
    const homeScore = Number(match.home.score);
    const awayScore = Number(match.away.score);

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (homeScore < awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...table.values()]
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst
    }))
    .sort(compareStandings);
}

function compareStandings(a, b) {
  return (
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || a.name.localeCompare(b.name)
  );
}

function findLastQualifiedIndex(standings) {
  for (let index = standings.length - 1; index >= 0; index -= 1) {
    if (standings[index].isQualified) {
      return index;
    }
  }

  return -1;
}

function ensureStanding(table, name) {
  if (table.has(name)) {
    return;
  }

  table.set(name, {
    name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0
  });
}

function hasCompleteScore(match) {
  return Number.isFinite(Number(match.home?.score)) && Number.isFinite(Number(match.away?.score));
}

function sortMatchesByKickoff(matches) {
  return [...matches].sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
}

function latestEventTime(match) {
  const kickoff = new Date(match.kickoffTime).getTime();
  const baseTime = Number.isFinite(kickoff) ? kickoff : 0;
  const latestMinute = Math.max(
    0,
    ...(match.events || []).map((event) => Number(event.minuteSort ?? parseGoalMinute(event.minute) ?? 0))
  );

  return baseTime + latestMinute * 60_000;
}

function compareGroupNames(groupA, groupB) {
  const suffixA = String(groupA).match(/[A-Z]$/)?.[0] || groupA;
  const suffixB = String(groupB).match(/[A-Z]$/)?.[0] || groupB;
  return String(suffixA).localeCompare(String(suffixB));
}

function parseGoalMinute(value) {
  const match = String(value || "").match(/^(\d+)(?:\+(\d+))?/);

  if (!match) {
    return null;
  }

  return Number(match[1]) + Number(match[2] || 0);
}
