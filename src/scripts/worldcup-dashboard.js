import { detectGoal } from "../worldcup/lib/detectGoal.js";
import { createMockWorldCupUpdate, mockWorldCupData } from "../worldcup/lib/mockWorldCupData.js";
import { flagUrl } from "../worldcup/lib/flagUrl.js";
import { TEAM_ISO2, TEAM_NAME_ZH } from "../worldcup/lib/teamIsoMap.js";
import siteText from "../content/siteText";

const MATCH_WINDOW_INTERVAL = 5 * 60 * 1_000;
const NEAR_MATCH_INTERVAL = 30 * 60 * 1_000;
const QUIET_INTERVAL = 6 * 60 * 60 * 1_000;
const PRE_MATCH_WINDOW = 15 * 60 * 1_000;
const POST_KICKOFF_WINDOW = 130 * 60 * 1_000;
const GOAL_VISIBLE_MS = 2_400;
export const DATA_ENDPOINT = "/.netlify/functions/worldcup-live";
const worldcupText = siteText.worldcup;
const runtimeText = worldcupText.runtime;
const STATUS_LABEL = runtimeText.statusLabels;
const STAGE_LABEL = runtimeText.stageLabels;
const TIMELINE_PREVIEW_MATCH_LIMIT = 3;

const root = document.querySelector("[data-worldcup-root]");
let dismissedChampionKey = "";

if (root) {
  const elements = {
    hero: root.querySelector("[data-match-hero]"),
    schedule: root.querySelector("[data-schedule-strip]"),
    groupStage: root.querySelector("[data-group-stage]"),
    timeline: root.querySelector("[data-timeline]"),
    bracket: root.querySelector("[data-bracket]"),
    liveCount: root.querySelector("[data-live-count]"),
    updatedAt: root.querySelector("[data-updated-at]"),
    refreshPolicy: root.querySelector("[data-refresh-policy]"),
    sourcePill: root.querySelector("[data-source-pill]"),
    error: root.querySelector("[data-error]"),
    refresh: root.querySelector("[data-refresh]"),
    goalOverlay: root.querySelector("[data-goal-overlay]"),
    goalTeam: root.querySelector("[data-goal-team]"),
    goalPlayer: root.querySelector("[data-goal-player]"),
    championCelebration: root.querySelector("[data-champion-celebration]"),
    championTitle: root.querySelector("[data-champion-title]"),
    championCopy: root.querySelector("[data-champion-copy]"),
    championBadge: root.querySelector("[data-champion-badge]")
  };

  let data = null;
  let previousData = null;
  let tick = 0;
  let goalTimer = 0;
  let refreshTimer = 0;

  const loadData = async () => {
    window.clearTimeout(refreshTimer);
    tick += 1;
    previousData = data;
    const nextData = await fetchWorldCupData(data, tick, elements);

    if (!nextData) {
      scheduleNextRefresh(data, loadData, elements);
      return;
    }

    data = nextData;
    renderDashboard(data, previousData, elements);
    const goal = findGoal(data, previousData);

    if (goal) {
      window.clearTimeout(goalTimer);
      showGoal(goal, elements);
      goalTimer = window.setTimeout(() => hideGoal(elements), GOAL_VISIBLE_MS);
    }

    scheduleNextRefresh(data, loadData, elements);
  };

  elements.refresh?.addEventListener("click", loadData);
  setupDraggableBracket(elements.bracket);
  elements.championCelebration?.addEventListener("click", (event) => {
    if (event.target.closest(".champion-content")) {
      return;
    }

    dismissChampionCelebration(elements);
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.championCelebration && !elements.championCelebration.hidden) {
      dismissChampionCelebration(elements);
    }
  });
  loadData();

  window.addEventListener("pagehide", () => {
    window.clearTimeout(refreshTimer);
    window.clearTimeout(goalTimer);
  });

  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => drawBracketLines(elements.bracket));
  });

  function scheduleNextRefresh(nextData, callback, pageElements) {
    const schedule = getRefreshSchedule(nextData);
    refreshTimer = window.setTimeout(callback, schedule.delayMs);
    renderRefreshPolicy(schedule, pageElements);
  }
}

export async function fetchWorldCupData(currentData, tick, elements) {
  try {
    const response = await fetch(DATA_ENDPOINT, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    clearError(elements);

    if (payload.source === "mock" && currentData?.source === "mock") {
      return {
        ...createMockWorldCupUpdate(currentData, tick),
        message: payload.message || currentData.message,
        polling: payload.polling || currentData.polling
      };
    }

    return normalizeClientPayload(payload);
  } catch (error) {
    const message = currentData?.source === "mock"
      ? runtimeText.fetchErrors.localMockContinue
      : currentData
        ? runtimeText.fetchErrors.keepPrevious
        : runtimeText.fetchErrors.localMockInitial;

    showError(elements, message);

    if (currentData?.source === "mock") {
      return {
        ...createMockWorldCupUpdate(currentData, tick),
        message,
        polling: currentData.polling
      };
    }

    if (currentData) {
      return null;
    }

    return {
      ...withFreshTimestamp(mockWorldCupData),
      message
    };
  }
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

function withFreshTimestamp(sourceData) {
  return {
    ...structuredClone(sourceData),
    lastUpdated: new Date().toISOString()
  };
}

function renderDashboard(nextData, previousData, elements) {
  const matches = sortMatchesForFocus(nextData.matches || []);
  const allMatches = sortMatchesByKickoff(getAllMatches(nextData));
  const upcomingMatches = getUpcomingMatches(nextData, allMatches);
  const timelineMatches = nextData.timelineMatches?.length ? nextData.timelineMatches : allMatches;
  const focusMatch = pickFocusMatch(matches);
  const previousFocusMatch = findPreviousMatch(previousData, focusMatch?.id);

  elements.hero.innerHTML = renderHero(focusMatch, previousFocusMatch, nextData);
  elements.schedule.innerHTML = renderSchedule(upcomingMatches, previousData);
  elements.timeline.innerHTML = renderTimeline(timelineMatches, {
    compact: true,
    limit: TIMELINE_PREVIEW_MATCH_LIMIT,
    linked: true
  });
  elements.groupStage.innerHTML = renderGroupStage(nextData.groupStage || []);
  elements.bracket.innerHTML = renderBracket(nextData.knockout || [], nextData.groupStage || []);
  window.requestAnimationFrame(() => drawBracketLines(elements.bracket));
  window.setTimeout(() => drawBracketLines(elements.bracket), 280);

  const liveCount = allMatches.filter((match) => isLive(match.status)).length;
  elements.liveCount.textContent = formatTemplate(worldcupText.statusRow.liveCountTemplate, { count: liveCount });
  elements.updatedAt.textContent = formatTemplate(worldcupText.statusRow.updatedAtTemplate, {
    time: formatTime(nextData.lastUpdated)
  });
  elements.sourcePill.textContent = sourceLabel(nextData.source);
  renderChampionCelebration(nextData, elements);
}

function getRefreshSchedule(nextData) {
  if (
    nextData?.polling?.mode === "api-empty-fallback"
    || nextData?.polling?.mode === "api-plan-fallback"
    || nextData?.polling?.mode === "openfootball-schedule-fallback"
    || nextData?.polling?.mode === "openai-schedule-fallback"
  ) {
    return {
      delayMs: QUIET_INTERVAL,
      label: runtimeText.refreshLabels.publicScheduleQuiet
    };
  }

  const matches = nextData?.upcomingMatches?.length ? nextData.upcomingMatches : nextData?.matches || [];
  const now = Date.now();

  if (matches.some((match) => isInMatchWindow(match, now))) {
    return {
      delayMs: MATCH_WINDOW_INTERVAL,
      label: runtimeText.refreshLabels.matchWindow
    };
  }

  const nextKickoff = matches
    .filter((match) => match.status === "NS")
    .map((match) => new Date(match.kickoffTime).getTime())
    .filter((time) => Number.isFinite(time) && time > now)
    .sort((a, b) => a - b)[0];

  if (nextKickoff) {
    const msUntilWindow = nextKickoff - PRE_MATCH_WINDOW - now;

    if (msUntilWindow <= 0) {
      return {
        delayMs: MATCH_WINDOW_INTERVAL,
        label: runtimeText.refreshLabels.nearKickoff
      };
    }

    if (msUntilWindow <= NEAR_MATCH_INTERVAL) {
      return {
        delayMs: Math.max(60_000, msUntilWindow),
        label: runtimeText.refreshLabels.waitForPreMatch
      };
    }

    if (nextKickoff - now <= 24 * 60 * 60 * 1_000) {
      return {
        delayMs: NEAR_MATCH_INTERVAL,
        label: runtimeText.refreshLabels.hasTodayMatches
      };
    }
  }

  return {
    delayMs: QUIET_INTERVAL,
    label: runtimeText.refreshLabels.quiet
  };
}

function isInMatchWindow(match, now) {
  if (isLive(match.status)) {
    return true;
  }

  const kickoff = new Date(match.kickoffTime).getTime();

  if (!Number.isFinite(kickoff)) {
    return false;
  }

  return now >= kickoff - PRE_MATCH_WINDOW && now <= kickoff + POST_KICKOFF_WINDOW;
}

function renderRefreshPolicy(schedule, elements) {
  if (!elements.refreshPolicy) {
    return;
  }

  elements.refreshPolicy.textContent = formatTemplate(runtimeText.refreshLabels.policyTemplate, {
    label: schedule.label,
    delay: formatDelay(schedule.delayMs)
  });
}

function renderHero(match, previousMatch, data) {
  if (!match) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noMatchData)}</div>`;
  }

  const homeChanged = scoreChanged(match.home?.score, previousMatch?.home?.score);
  const awayChanged = scoreChanged(match.away?.score, previousMatch?.away?.score);
  const latestGoal = [...(match.events || [])].reverse().find((event) => event.type === "Goal");

  return `
    <div class="flag-wash flag-home" style="--flag-url: url('${escapeAttribute(match.home.flagUrl)}')"></div>
    <div class="flag-wash flag-away" style="--flag-url: url('${escapeAttribute(match.away.flagUrl)}')"></div>
    <div class="hero-meta">
      ${renderStatus(match)}
      <span>${escapeHtml(stageLabel(match.stage))}</span>
      <span>${escapeHtml(match.venue || runtimeText.states.defaultVenue)}</span>
    </div>
    <div class="hero-versus">
      ${renderHeroTeam(match.home, "home")}
      <div class="hero-score" aria-label="${escapeAttribute(scoreLabel(match))}">
        <span class="score-number ${homeChanged ? "score-pop" : ""}">${formatScore(match.home.score)}</span>
        <span class="score-divider">:</span>
        <span class="score-number ${awayChanged ? "score-pop" : ""}">${formatScore(match.away.score)}</span>
      </div>
      ${renderHeroTeam(match.away, "away")}
    </div>
    <div class="hero-footer">
      <span>${match.minute ? `${match.minute}'` : formatKickoff(match.kickoffTime)}</span>
      <span>${escapeHtml(latestGoal ? formatTemplate(runtimeText.states.latestGoalTemplate, {
        minute: latestGoal.minute,
        player: latestGoal.player || teamDisplayName(latestGoal.team)
      }) : runtimeText.states.waitingKickoff)}</span>
      <span>${escapeHtml(data.source === "mock" ? runtimeText.states.mockSource : runtimeText.states.liveSource)}</span>
    </div>
  `;
}

function renderHeroTeam(team, side) {
  return `
    <div class="hero-team ${side}">
      <img src="${escapeAttribute(team.flagUrl)}" alt="" loading="lazy" />
      <span>${escapeHtml(team.code)}</span>
      <strong>${escapeHtml(teamDisplayName(team.name))}</strong>
    </div>
  `;
}

function renderSchedule(matches, previousData) {
  if (!matches.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noUpcomingMatches)}</div>`;
  }

  return sortMatchesByKickoff(matches)
    .map((match) => renderMatchCard(match, previousData))
    .join("");
}

function renderMatchCard(match, previousData) {
  const previousMatch = findPreviousMatch(previousData, match.id);
  const homeChanged = scoreChanged(match.home?.score, previousMatch?.home?.score);
  const awayChanged = scoreChanged(match.away?.score, previousMatch?.away?.score);

  return `
    <article class="schedule-card status-${escapeAttribute(match.status.toLowerCase())}">
      <div class="schedule-card-top">
        ${renderStatus(match)}
        <span>${escapeHtml(stageLabel(match.stage))}</span>
      </div>
      ${renderMiniTeam(match.home)}
      <div class="card-score-row">
        <span class="${homeChanged ? "score-pop" : ""}">${formatScore(match.home.score)}</span>
        <small>${match.minute ? formatEventMinute(match.minute) : formatKickoffDateTime(match.kickoffTime)}</small>
        <span class="${awayChanged ? "score-pop" : ""}">${formatScore(match.away.score)}</span>
      </div>
      ${renderMiniTeam(match.away)}
    </article>
  `;
}

function renderMiniTeam(team) {
  return `
    <div class="mini-team">
      <img src="${escapeAttribute(team.flagUrl)}" alt="" loading="lazy" />
      <span>${escapeHtml(teamDisplayName(team.name))}</span>
      <strong>${escapeHtml(team.code)}</strong>
    </div>
  `;
}

export function renderTimeline(matches, options = {}) {
  const {
    compact = false,
    limit = 8,
    linked = false,
    withAnchors = false,
    sortMode = "eventTimeDesc"
  } = options;
  const groups = buildTimelineGroups(matches, sortMode).slice(0, limit);

  if (!groups.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noTimelineEvents)}</div>`;
  }

  return groups.map(({ match, events }) => {
    const tag = linked ? "a" : "article";
    const href = linked ? ` href="${escapeAttribute(timelineMatchHref(match))}"` : "";
    const id = withAnchors ? ` id="${escapeAttribute(timelineAnchorId(match))}"` : "";
    const displayEvents = compact ? events.slice(0, 2) : events;
    const hiddenEventCount = Math.max(0, events.length - displayEvents.length);

    return `
    <${tag} class="timeline-match ${compact ? "timeline-match-compact" : ""}"${href}${id}>
      <header class="timeline-match-header">
        <div>
          <strong>${escapeHtml(formatMatchTitle(match))}</strong>
          <span>${escapeHtml(formatKickoffDateTime(match.kickoffTime))} · ${escapeHtml(match.group ? formatGroupLabel(match.group) : stageLabel(match.stage))}</span>
        </div>
        ${renderStatus(match)}
      </header>
      <div class="timeline-event-list">
        ${displayEvents.map((event) => renderTimelineEvent(event)).join("")}
        ${hiddenEventCount ? `<p class="timeline-more">${escapeHtml(formatTemplate(runtimeText.states.moreEventsTemplate, { count: hiddenEventCount }))}</p>` : ""}
      </div>
    </${tag}>
  `;
  }).join("");
}

function renderTimelineEvent(event) {
  return `
    <div class="timeline-event">
      <span>${escapeHtml(formatEventMinute(event.minute))}</span>
      <div>
        <strong>${eventTypeLabel(event.type)} · ${escapeHtml(teamDisplayName(event.teamName || event.team))}</strong>
        <p>${escapeHtml(event.player || runtimeText.states.defaultGoalPlayer)}</p>
      </div>
    </div>
  `;
}

function renderGroupStage(groups) {
  if (!groups.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noGroupStageData)}</div>`;
  }

  return groups.map((group) => renderGroupCard(group)).join("");
}

function renderGroupCard(group) {
  const matches = sortMatchesByKickoff(group.matches || []);
  const played = matches.filter(hasCompleteScore).length;

  return `
    <section class="group-card">
      <header class="group-card-header">
        <h3>${escapeHtml(formatGroupLabel(group.group))}</h3>
        <span>${escapeHtml(formatTemplate(runtimeText.states.groupFixtureCountTemplate, {
          played,
          total: matches.length
        }))}</span>
      </header>
      <div class="group-standings">
        <div class="standing-row standing-head">
          <span></span>
          <span>${escapeHtml(runtimeText.states.groupStandingPlayed)}</span>
          <span>${escapeHtml(runtimeText.states.groupStandingGoalDifference)}</span>
          <span>${escapeHtml(runtimeText.states.groupStandingPoints)}</span>
        </div>
        ${(group.standings || []).map((team, index) => (
          renderStandingRow(team, index)
          + (index === group.qualificationCutIndex ? renderAdvanceLine() : "")
        )).join("")}
      </div>
      <div class="group-fixtures">
        ${matches.map(renderGroupFixture).join("")}
      </div>
    </section>
  `;
}

function renderStandingRow(team, index) {
  return `
    <div class="standing-row ${team.isQualified ? "is-qualified" : ""}" data-rank="${index + 1}">
      <strong class="standing-team">${renderTeamFlag(team.name)}<span>${escapeHtml(teamDisplayName(team.name))}</span></strong>
      <span>${formatScore(team.played)}</span>
      <span>${formatSignedNumber(team.goalDifference)}</span>
      <span>${formatScore(team.points)}</span>
    </div>
  `;
}

function renderAdvanceLine() {
  return `
    <div class="standing-cut-line" aria-hidden="true"></div>
  `;
}

function renderGroupFixture(match) {
  return `
    <article class="group-fixture">
      <span>${escapeHtml(formatKickoffDateTime(match.kickoffTime))}</span>
      <div>
        <strong>${renderTeamFlag(match.home.name)}<span>${escapeHtml(teamDisplayName(match.home.name))}</span></strong>
        <small>${formatScore(match.home.score)} : ${formatScore(match.away.score)}</small>
        <strong>${renderTeamFlag(match.away.name)}<span>${escapeHtml(teamDisplayName(match.away.name))}</span></strong>
      </div>
    </article>
  `;
}

function renderBracket(knockout, groupStage = []) {
  if (!knockout.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noBracketData)}</div>`;
  }

  const columns = buildBracketColumns(knockout);

  return `
    <svg class="bracket-lines" data-bracket-lines aria-hidden="true"></svg>
    <div class="bracket-columns">
      ${renderBracketGroupColumn(groupStage)}
      ${columns.map((column) => `
        <section class="bracket-round" data-round="${escapeAttribute(column.round)}">
          <h3>${escapeHtml(stageLabel(column.label))}</h3>
          <div class="bracket-round-track">
            ${column.matches.map(({ match, index }) => renderBracketMatch(match, match.round, index)).join("")}
          </div>
        </section>
      `).join("")}
      ${renderChampionColumn(knockout)}
    </div>
  `;
}

function buildBracketColumns(knockout) {
  const columns = [];
  const orderedRounds = orderBracketRounds([...new Set(knockout.map((match) => match.round))]);
  const orderedMatches = buildOrderedBracketMatches(knockout);
  const finals = [];

  for (const round of orderedRounds) {
    const matches = (orderedMatches.get(round) || knockout.filter((match) => match.round === round))
      .map((match, index) => ({ match, index }));

    if (round === "Final" || round === "Match for third place") {
      finals.push(...matches);
      continue;
    }

    columns.push({
      round,
      label: round,
      matches
    });
  }

  if (finals.length) {
    columns.push({
      round: "Finals",
      label: "Finals",
      matches: finals.sort((a, b) => (a.match.round === "Final" ? -1 : 1) - (b.match.round === "Final" ? -1 : 1))
    });
  }

  return columns;
}

function renderBracketGroupColumn(groups) {
  if (!groups.length) {
    return "";
  }

  return `
    <section class="bracket-group-column" data-round="Group Stage">
      <h3>${escapeHtml(stageLabel("Group Stage"))}</h3>
      <div class="bracket-source-groups">
        ${groups.map(renderBracketGroupCard).join("")}
      </div>
    </section>
  `;
}

function renderBracketGroupCard(group) {
  const standings = group.standings || [];

  return `
    <article class="bracket-group-card">
      <header class="bracket-group-card-header">
        <strong>${escapeHtml(formatGroupLabel(group.group))}</strong>
        <span>
          <b>${escapeHtml(runtimeText.states.groupStandingPlayed)}</b>
          <b>${escapeHtml(runtimeText.states.groupStandingGoalDifference)}</b>
          <b>${escapeHtml(runtimeText.states.groupStandingPoints)}</b>
        </span>
      </header>
      <div class="bracket-group-standings">
        ${standings.map((team, teamIndex) => (
          renderBracketGroupStandingRow(team)
          + (teamIndex === group.qualificationCutIndex ? renderBracketGroupCutLine() : "")
        )).join("")}
      </div>
    </article>
  `;
}

function renderBracketGroupStandingRow(team) {
  return `
    <span class="bracket-source-team ${team.isQualified ? "is-qualified" : "is-eliminated"}" data-bracket-source-team="${escapeAttribute(team.name)}">
      <span class="bracket-source-name">
        ${renderTeamFlag(team.name)}
        <b>${escapeHtml(teamDisplayName(team.name))}</b>
      </span>
      <span class="bracket-source-stats">
        <em>${formatScore(team.played)}</em>
        <em>${formatSignedNumber(team.goalDifference)}</em>
        <strong>${formatScore(team.points)}</strong>
      </span>
    </span>
  `;
}

function renderBracketGroupCutLine() {
  return `<span class="bracket-group-cut-line" aria-hidden="true"></span>`;
}

function renderChampionColumn(knockout) {
  const finalMatch = knockout.find((match) => match.round === "Final");
  const champion = finalMatch?.winner || "";

  return `
    <section class="bracket-champion-column" data-round="Champion">
      <h3>${escapeHtml(worldcupText.champion.slotTitle)}</h3>
      <div class="bracket-champion-track">
        <article class="bracket-champion-card" data-champion-slot>
          <img class="bracket-worldcup-logo" src="${escapeAttribute(worldcupText.champion.logoSrc)}" alt="${escapeAttribute(worldcupText.champion.logoAlt)}" loading="lazy" />
          <div>
            ${champion ? renderTeamFlag(champion) : ""}
            <strong>${escapeHtml(champion ? teamDisplayName(champion) : runtimeText.states.defaultTeam)}</strong>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderBracketMatch(match, round, index) {
  const advanceText = match.nextMatchId
    ? formatTemplate(runtimeText.states.advanceTemplate, { nextMatchId: match.nextMatchId })
    : "";
  const placement = bracketPlacement(round, index);

  return `
    <article class="bracket-match status-${escapeAttribute(match.status.toLowerCase())}" style="--slot: ${placement.slot}; --span: ${placement.span};" data-match-id="${escapeAttribute(match.id)}" data-bracket-round="${escapeAttribute(round)}" data-next-match-id="${escapeAttribute(match.nextMatchId || "")}" data-next-match-ids="${escapeAttribute((match.nextMatchIds || []).join(","))}">
      ${renderBracketTeamRow(match, round, "home")}
      ${renderBracketTeamRow(match, round, "away")}
      <small>${escapeHtml(statusLabel(match.status))}${advanceText ? ` · ${escapeHtml(advanceText)}` : ""}</small>
    </article>
  `;
}

function renderBracketTeamRow(match, round, side) {
  const team = match[side];
  const score = side === "home" ? match.homeScore : match.awayScore;
  const placementLabel = bracketPlacementLabel(match, round, team);

  return `
    <div class="bracket-row ${match.winner === team ? "winner" : ""} ${placementLabel ? "has-placement-badge" : ""}">
      <span data-bracket-participant-team="${escapeAttribute(team)}">
        ${renderTeamFlag(team)}
        <b>${escapeHtml(teamDisplayName(team))}</b>
        ${placementLabel ? `<em class="bracket-placement-badge">${escapeHtml(placementLabel)}</em>` : ""}
      </span>
      <strong>${formatScore(score)}</strong>
    </div>
  `;
}

function bracketPlacementLabel(match, round, team) {
  if (!match.winner || !team || ![match.home, match.away].includes(team)) {
    return "";
  }

  if (round === "Final" && team !== match.winner) {
    return runtimeText.states.bracketRunnerUp;
  }

  if (round === "Match for third place" && team === match.winner) {
    return runtimeText.states.bracketThirdPlace;
  }

  return "";
}

function bracketPlacement(round, index) {
  if (round === "Round of 32") {
    return { slot: index * 2 + 1, span: 2 };
  }

  if (round === "Round of 16") {
    return { slot: index * 4 + 1, span: 4 };
  }

  if (round === "Quarter-final" || round === "Quarterfinal") {
    return { slot: index * 8 + 1, span: 8 };
  }

  if (round === "Semi-final" || round === "Semifinal") {
    return { slot: index * 16 + 1, span: 16 };
  }

  if (round === "Final") {
    return { slot: 13, span: 8 };
  }

  if (round === "Match for third place") {
    return { slot: 25, span: 6 };
  }

  return { slot: index * 2 + 1, span: 2 };
}

function buildOrderedBracketMatches(knockout) {
  const ordered = new Map();
  const seen = new Set();
  const matchMap = new Map(knockout.map((match) => [String(match.id), match]));
  const sourcesByTarget = new Map();

  for (const match of knockout) {
    for (const nextId of readNextMatchIds(match)) {
      const target = matchMap.get(String(nextId));

      if (!target || target.round === "Match for third place") {
        continue;
      }

      if (!sourcesByTarget.has(String(nextId))) {
        sourcesByTarget.set(String(nextId), []);
      }

      sourcesByTarget.get(String(nextId)).push(match);
    }
  }

  const addMatch = (match) => {
    const key = String(match.id);

    if (seen.has(key) || match.round === "Final" || match.round === "Match for third place") {
      return;
    }

    if (!ordered.has(match.round)) {
      ordered.set(match.round, []);
    }

    ordered.get(match.round).push(match);
    seen.add(key);
  };

  const collectSources = (target) => {
    const sources = (sourcesByTarget.get(String(target.id)) || [])
      .sort((sourceA, sourceB) => sourceSideOrder(sourceA, target) - sourceSideOrder(sourceB, target) || compareMatchIds(sourceA, sourceB));

    for (const source of sources) {
      collectSources(source);
      addMatch(source);
    }
  };

  const finalMatch = knockout.find((match) => match.round === "Final");

  if (finalMatch) {
    collectSources(finalMatch);
  }

  for (const match of knockout) {
    addMatch(match);
  }

  return ordered;
}

function readNextMatchIds(match) {
  return String((match.nextMatchIds || []).join(",") || match.nextMatchId || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function sourceSideOrder(source, target) {
  const homeScore = participantSourceScore(target.home, source);
  const awayScore = participantSourceScore(target.away, source);

  if (homeScore !== awayScore) {
    return homeScore < awayScore ? 0 : 1;
  }

  return 2;
}

function participantSourceScore(participant, source) {
  const value = String(participant || "");

  if (value === `W${source.id}`) {
    return 0;
  }

  if (source.winner && value === source.winner) {
    return 1;
  }

  if (value && (value === source.home || value === source.away)) {
    return 2;
  }

  return 9;
}

function compareMatchIds(matchA, matchB) {
  const numberA = Number(matchA.id);
  const numberB = Number(matchB.id);

  if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
    return numberA - numberB;
  }

  return String(matchA.id).localeCompare(String(matchB.id));
}

function drawBracketLines(container) {
  const svg = container?.querySelector("[data-bracket-lines]");

  if (!container || !svg) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const width = Math.max(container.scrollWidth, container.clientWidth);
  const height = Math.max(container.scrollHeight, container.clientHeight);
  const paths = [
    ...buildKnockoutPaths(container, containerRect)
  ];

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.innerHTML = paths.join("");
}

function buildKnockoutPaths(container, containerRect) {
  const paths = [];
  const matches = [...container.querySelectorAll("[data-match-id]")];

  for (const match of matches) {
    const nextIds = String(match.dataset.nextMatchIds || match.dataset.nextMatchId || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    for (const nextId of nextIds) {
      const target = container.querySelector(`[data-match-id="${cssEscape(nextId)}"]`);

      if (!target || target.dataset.bracketRound === "Match for third place") {
        continue;
      }

      paths.push(renderBracketPath(
        pointFromRect(match.getBoundingClientRect(), containerRect, "right", container),
        pointFromRect(target.getBoundingClientRect(), containerRect, "left", container),
        "knockout"
      ));
    }

    if (match.dataset.bracketRound === "Final") {
      const championTarget = container.querySelector("[data-champion-slot]");

      if (championTarget) {
        paths.push(renderBracketPath(
          pointFromRect(match.getBoundingClientRect(), containerRect, "right", container),
          pointFromRect(championTarget.getBoundingClientRect(), containerRect, "left", container),
          "champion"
        ));
      }
    }
  }

  return paths;
}

function pointFromRect(rect, containerRect, side, container) {
  return {
    x: (side === "left" ? rect.left - containerRect.left : rect.right - containerRect.left) + (container?.scrollLeft || 0),
    y: rect.top - containerRect.top + rect.height / 2 + (container?.scrollTop || 0)
  };
}

function renderBracketPath(from, to, kind) {
  const midX = from.x + Math.max(24, (to.x - from.x) * 0.5);
  const d = [
    `M ${from.x.toFixed(1)} ${from.y.toFixed(1)}`,
    `H ${midX.toFixed(1)}`,
    `V ${to.y.toFixed(1)}`,
    `H ${to.x.toFixed(1)}`
  ].join(" ");

  return `<path class="bracket-line bracket-line-${kind}" d="${d}" />`;
}

function setupDraggableBracket(container) {
  if (!container || container.dataset.dragReady === "true") {
    return;
  }

  container.dataset.dragReady = "true";
  container.tabIndex = 0;
  container.setAttribute("role", "region");
  container.setAttribute("aria-label", worldcupText.panels.bracket.dragAriaLabel);

  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startScrollLeft = 0;

  const stopDragging = () => {
    isDragging = false;
    container.classList.remove("is-dragging");
  };

  container.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType === "touch" || container.scrollWidth <= container.clientWidth) {
      return;
    }

    isDragging = true;
    hasMoved = false;
    startX = event.clientX;
    startScrollLeft = container.scrollLeft;
    container.classList.add("is-dragging");
    container.setPointerCapture(event.pointerId);
  });

  container.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - startX;

    if (Math.abs(deltaX) > 3) {
      hasMoved = true;
    }

    container.scrollLeft = startScrollLeft - deltaX;

    if (hasMoved) {
      event.preventDefault();
    }
  });

  container.addEventListener("pointerup", stopDragging);
  container.addEventListener("pointercancel", stopDragging);
  container.addEventListener("lostpointercapture", stopDragging);
  container.addEventListener("click", (event) => {
    if (!hasMoved) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    hasMoved = false;
  }, true);
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(String(value));
  }

  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function renderStatus(match) {
  const live = isLive(match.status);
  return `
    <span class="live-badge ${live ? "is-live" : ""}">
      ${live ? `<span class="live-dot"></span>` : ""}
      ${escapeHtml(statusLabel(match.status))}
    </span>
  `;
}

function renderTeamFlag(name) {
  const iso2 = TEAM_ISO2[name];

  if (!iso2) {
    return "";
  }

  return `<img src="${escapeAttribute(flagUrl(iso2))}" alt="" loading="lazy" />`;
}

function findGoal(nextData, previousData) {
  return getAllMatches(nextData)
    .map((match) => detectGoal(match, findPreviousMatch(previousData, match.id)))
    .find(Boolean);
}

function showGoal(goal, elements) {
  elements.goalTeam.textContent = teamDisplayName(goal.team.name);
  elements.goalPlayer.textContent = goal.player
    ? `${goal.minute}' · ${goal.player}`
    : `${goal.minute}'`;
  elements.goalOverlay.hidden = false;
  elements.goalOverlay.classList.remove("is-visible");

  window.requestAnimationFrame(() => {
    elements.goalOverlay.classList.add("is-visible");
  });
}

function hideGoal(elements) {
  elements.goalOverlay?.classList.remove("is-visible");

  window.setTimeout(() => {
    if (!elements.goalOverlay?.classList.contains("is-visible")) {
      elements.goalOverlay.hidden = true;
    }
  }, 360);
}

function dismissChampionCelebration(elements) {
  dismissedChampionKey = elements.championCelebration?.dataset.championKey || "";
  hideChampionCelebration(elements);
}

function hideChampionCelebration(elements) {
  root.classList.remove("is-champion-mode");

  if (elements.championCelebration) {
    elements.championCelebration.hidden = true;
  }
}

function renderChampionCelebration(nextData, elements) {
  const demoChampion = readChampionDemoTeam();
  const finalMatch = (nextData.knockout || []).find((match) => match.round === "Final");
  const champion = demoChampion || (finalMatch?.status === "FT" ? finalMatch.winner : "");

  if (!elements.championCelebration || !champion) {
    hideChampionCelebration(elements);
    return;
  }

  const championKey = `${demoChampion ? "demo" : "winner"}:${champion}`;

  if (dismissedChampionKey === championKey) {
    hideChampionCelebration(elements);
    return;
  }

  const displayName = teamDisplayName(champion);
  const iso2 = TEAM_ISO2[champion];

  root.classList.add("is-champion-mode");
  root.style.setProperty("--champion-flag-url", iso2 ? `url('${flagUrl(iso2)}')` : "none");
  elements.championCelebration.dataset.championKey = championKey;
  elements.championCelebration.hidden = false;
  elements.championTitle.textContent = formatTemplate(worldcupText.champion.titleTemplate, { team: displayName });
  elements.championCopy.textContent = formatTemplate(worldcupText.champion.copyTemplate, { team: displayName });

  if (elements.championBadge) {
    elements.championBadge.hidden = !demoChampion;
  }
}

function readChampionDemoTeam() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("championDemo");

  if (!value) {
    return "";
  }

  if (value === "1" || value === "true") {
    return "Argentina";
  }

  return normalizeTeamNameInput(value);
}

function normalizeTeamNameInput(value) {
  const decoded = String(value || "").trim();

  if (TEAM_ISO2[decoded]) {
    return decoded;
  }

  return Object.entries(TEAM_NAME_ZH)
    .find(([, zhName]) => zhName === decoded)?.[0] || decoded;
}

function sortMatchesForFocus(matches) {
  const statusWeight = { LIVE: 0, HT: 1, NS: 2, FT: 3 };
  return [...matches].sort((a, b) => {
    const statusSort = (statusWeight[a.status] ?? 9) - (statusWeight[b.status] ?? 9);
    return statusSort || new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  });
}

function sortMatchesByKickoff(matches) {
  return [...matches].sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
}

function pickFocusMatch(matches) {
  return matches.find((match) => isLive(match.status))
    || matches.find((match) => match.status === "NS")
    || matches[0]
    || null;
}

function isLive(status) {
  return status === "LIVE" || status === "HT";
}

function scoreChanged(current, previous) {
  return previous !== undefined && Number(current ?? -1) !== Number(previous ?? -1);
}

function formatScore(score) {
  return score === null || score === undefined ? "–" : String(score);
}

function scoreLabel(match) {
  return `${teamDisplayName(match.home.name)} ${formatScore(match.home.score)}, ${teamDisplayName(match.away.name)} ${formatScore(match.away.score)}`;
}

export function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function formatKickoff(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatKickoffDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDelay(delayMs) {
  const minutes = Math.round(delayMs / 60_000);

  if (minutes < 60) {
    return formatTemplate(runtimeText.refreshLabels.minuteUnitTemplate, { minutes });
  }

  const hours = Math.round(minutes / 60);
  return formatTemplate(runtimeText.refreshLabels.hourUnitTemplate, { hours });
}

function teamDisplayName(name) {
  return TEAM_NAME_ZH[name] || name || runtimeText.states.defaultTeam;
}

function formatMatchTitle(match) {
  return [
    teamDisplayName(match.home?.name),
    runtimeText.states.versus,
    teamDisplayName(match.away?.name)
  ].join(" ");
}

function formatGroupLabel(group) {
  const suffix = String(group || "").match(/^Group\s+(.+)$/)?.[1];

  if (!suffix) {
    return group || runtimeText.states.defaultStage;
  }

  return formatTemplate(runtimeText.states.groupLabelTemplate, { group: suffix });
}

function formatEventMinute(minute) {
  return minute ? `${minute}'` : "";
}

function formatSignedNumber(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function getAllMatches(nextData) {
  return nextData?.allMatches?.length ? nextData.allMatches : nextData?.matches || [];
}

function getUpcomingMatches(nextData, allMatches) {
  if (nextData?.upcomingMatches?.length) {
    return sortMatchesByKickoff(nextData.upcomingMatches);
  }

  const now = Date.now();
  return sortMatchesByKickoff(allMatches)
    .filter((match) => {
      const kickoff = new Date(match.kickoffTime).getTime();
      return match.status === "NS" || (Number.isFinite(kickoff) && kickoff > now);
    })
    .slice(0, 18);
}

function findPreviousMatch(previousData, matchId) {
  if (!previousData || !matchId) {
    return null;
  }

  return [
    ...(previousData.matches || []),
    ...(previousData.allMatches || []),
    ...(previousData.upcomingMatches || [])
  ].find((match) => match.id === matchId) || null;
}

function buildTimelineGroups(matches, sortMode = "eventTimeDesc") {
  return matches
    .filter((match) => Array.isArray(match.events) && match.events.length)
    .map((match) => ({
      match,
      events: [...match.events].sort((a, b) => eventMinuteSort(a) - eventMinuteSort(b)),
      kickoffTime: matchKickoffTime(match),
      latestEventTime: latestEventTime(match)
    }))
    .sort((a, b) => {
      if (sortMode === "matchTimeDesc") {
        return b.kickoffTime - a.kickoffTime;
      }

      return b.latestEventTime - a.latestEventTime;
    });
}

function matchKickoffTime(match) {
  const kickoff = new Date(match.kickoffTime).getTime();
  return Number.isFinite(kickoff) ? kickoff : 0;
}

function eventMinuteSort(event) {
  return Number(event.minuteSort ?? parseEventMinute(event.minute) ?? 0);
}

function latestEventTime(match) {
  const kickoff = new Date(match.kickoffTime).getTime();
  const latestMinute = Math.max(0, ...(match.events || []).map(eventMinuteSort));
  return (Number.isFinite(kickoff) ? kickoff : 0) + latestMinute * 60_000;
}

function parseEventMinute(value) {
  const match = String(value || "").match(/^(\d+)(?:\+(\d+))?/);

  if (!match) {
    return null;
  }

  return Number(match[1]) + Number(match[2] || 0);
}

function hasCompleteScore(match) {
  return match?.home?.score !== null
    && match?.home?.score !== undefined
    && match?.away?.score !== null
    && match?.away?.score !== undefined;
}

function stageLabel(stage) {
  return STAGE_LABEL[stage] || stage || runtimeText.states.defaultStage;
}

function statusLabel(status) {
  return STATUS_LABEL[status] || status || runtimeText.states.unknownStatus;
}

export function sourceLabel(source) {
  if (source === "api-football") {
    return runtimeText.states.apiSource;
  }

  if (source === "openai-web") {
    return runtimeText.states.openaiSource;
  }

  if (source === "openfootball") {
    return runtimeText.states.openfootballSource;
  }

  if (source === "mock") {
    return runtimeText.states.mockSourcePill;
  }

  return runtimeText.states.unknownSource;
}

function eventTypeLabel(type) {
  return type === "Goal" ? runtimeText.states.goalEvent : type;
}

function timelineAnchorId(match) {
  return `moment-${safeDomId(match?.id || `${match?.kickoffTime}-${match?.home?.name}-${match?.away?.name}`)}`;
}

function timelineMatchHref(match) {
  return `/worldcup/moments/#${timelineAnchorId(match)}`;
}

function safeDomId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "match";
}

function orderBracketRounds(rounds) {
  const order = [
    "Round of 32",
    "Round of 16",
    "Quarter-final",
    "Quarterfinal",
    "Semi-final",
    "Semifinal",
    "Match for third place",
    "Final"
  ];

  return [...rounds].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });
}

function showError(elements, message) {
  if (!elements.error) {
    return;
  }

  elements.error.hidden = false;
  elements.error.textContent = message;
}

function clearError(elements) {
  if (!elements.error) {
    return;
  }

  elements.error.hidden = true;
  elements.error.textContent = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function formatTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
