import { detectGoal } from "../worldcup/lib/detectGoal.js";
import { createMockWorldCupUpdate, mockWorldCupData } from "../worldcup/lib/mockWorldCupData.js";
import { flagUrl } from "../worldcup/lib/flagUrl.js";
import { TEAM_ISO2, TEAM_NAME_ZH } from "../worldcup/lib/teamIsoMap.js";
import { simplifyChinese } from "../worldcup/lib/simplifyChinese.js";
import {
  fetchDataPayload,
  normalizeClientPayload,
  shouldAllowWorldCupMock
} from "./worldcup/data-client.js";

const MATCH_WINDOW_INTERVAL = 5 * 60 * 1_000;
const NEAR_MATCH_INTERVAL = 60 * 60 * 1_000;
const QUIET_INTERVAL = 6 * 60 * 60 * 1_000;
const NEAR_MATCH_WINDOW = 24 * 60 * 60 * 1_000;
const PRE_MATCH_WINDOW = 30 * 60 * 1_000;
const POST_KICKOFF_WINDOW = 150 * 60 * 1_000;
const GOAL_VISIBLE_MS = 2_400;
const BASE_PATH = import.meta.env.BASE_URL || "/";
const PLAYER_NAME_MANIFEST_ENDPOINT = withBasePath("/data/worldcup/player-names/manifest.json");
const DEFAULT_WORLDCUP_TEXT = {
  statusRow: {
    liveCountTemplate: "Live {count}",
    updatedAtTemplate: "Updated {time}"
  },
  panels: {
    schedule: {
      dateFilter: {
        toggleAriaLabel: "Filter matches by date",
        allLabel: "All dates",
        allOptionLabel: "All",
        countTemplate: "{count} matches",
        emptyLabel: "No matches",
        calendarAriaLabel: "World Cup schedule calendar",
        dayAriaLabelTemplate: "{date}, {count}",
        weekdays: ["M", "T", "W", "T", "F", "S", "S"]
      }
    },
    groupStage: {
      title: "Group Stage"
    },
    timeline: {
      title: "Key Moments"
    },
    bracket: {
      title: "Knockout Bracket",
      dragAriaLabel: "Drag horizontally to view the full bracket"
    }
  },
  moments: {
    sort: {
      asc: "Ascending",
      desc: "Descending"
    },
    dateFilter: {
      toggleAriaLabel: "Filter moments by date",
      allLabel: "All dates",
      allOptionLabel: "All",
      countTemplate: "{count} matches",
      emptyLabel: "No moment dates",
      calendarAriaLabel: "World Cup calendar",
      dayAriaLabelTemplate: "{date}, {count}",
      weekdays: ["M", "T", "W", "T", "F", "S", "S"]
    },
    scrollDateAriaLabel: "Current browsing date",
    matchEventsTemplate: "{count} moments",
    expandMatchAriaLabel: "View moments for {match}",
    playerNameTemplate: "{zh}（{original}）",
    playerNames: {}
  },
  champion: {
    logoAlt: "2026 FIFA World Cup logo",
    logoSrc: "/assets/worldcup/2026-emblem-clean.svg",
    slotTitle: "Champion",
    titleTemplate: "Congratulations to {team}",
    copyTemplate: "{team} are the World Cup champions."
  },
  runtime: {
    statusLabels: {
      LIVE: "Live",
      HT: "Halftime",
      NS: "Not Started",
      FT: "Full Time",
      "1H": "First Half",
      "2H": "Second Half",
      ET: "Extra Time",
      AET: "After Extra Time",
      PEN: "Penalties",
      PST: "Postponed",
      CANC: "Canceled",
      SUSP: "Suspended",
      INT: "Interrupted"
    },
    stageLabels: {
      "Group Stage": "Group Stage",
      "Round of 32": "Round of 32",
      "Round of 16": "Round of 16",
      "Quarter-final": "Quarter-final",
      Quarterfinal: "Quarterfinal",
      "Semi-final": "Semi-final",
      Semifinal: "Semifinal",
      "Match for third place": "Third-place Match",
      Final: "Final",
      Finals: "Finals"
    },
    fetchErrors: {
      localMockContinue: "Using local mock data.",
      keepPrevious: "Data is temporarily unavailable. Keeping the previous frame.",
      localMockInitial: "Using local mock data."
    },
    refreshLabels: {
      publicScheduleQuiet: "Public schedule check every 6 hours",
      matchWindow: "Match window refresh every 5 minutes",
      nearKickoff: "Near kickoff refresh every 5 minutes",
      waitForPreMatch: "Waiting for pre-match window",
      hasTodayMatches: "Today's matches check every 30 minutes",
      quiet: "Quiet period check every 6 hours",
      policyTemplate: "{label} · next in {delay}",
      minuteUnitTemplate: "{minutes} min",
      hourUnitTemplate: "{hours} hr"
    },
    states: {
      noMatchData: "No match data yet.",
      noUpcomingMatches: "No upcoming matches.",
      noGroupStageData: "No group-stage data.",
      defaultVenue: "Venue TBD",
      latestGoalTemplate: "Latest goal {minute}' · {player}",
      waitingKickoff: "Waiting for kickoff",
      mockSource: "Mock data",
      liveSource: "Live data",
      noTimelineEvents: "No key events.",
      defaultGoalPlayer: "Team goal",
      versus: "vs",
      noBracketData: "No bracket data.",
      advanceTemplate: "Advances to {nextMatchId}",
      groupMatchesTemplate: "{count} matches",
      groupLabelTemplate: "Group {group}",
      groupStandingPlayed: "P",
      groupStandingGoalDifference: "GD",
      groupStandingPoints: "Pts",
      bracketRunnerUp: "Runner-up",
      bracketThirdPlace: "Third place",
      penaltyScoreTemplate: "Penalties {home}:{away}",
      moreEventsTemplate: "{count} more moments",
      defaultTeam: "TBD",
      defaultStage: "World Cup",
      unknownStatus: "Unknown",
      apiSource: "Live data",
      openaiSource: "Public schedule",
      openfootballSource: "Open schedule",
      mockSourcePill: "Mock data",
      unknownSource: "Unknown source",
      goalEvent: "Goal"
    }
  }
};
export const worldcupText = readWorldCupText();
const runtimeText = worldcupText.runtime;
const STATUS_LABEL = runtimeText.statusLabels;
const STAGE_LABEL = runtimeText.stageLabels;
const SECTION_TABS = ["schedule", "overview", "moments"];
let playerNameIndex = buildPlayerNameIndex(null, null, worldcupText.moments?.playerNames || {});
let playerNameManifestPromise = null;
const playerNameTeamPromises = new Map();
const loadedPlayerNameTeams = new Set();

const root = document.querySelector("[data-worldcup-root]");
let dismissedChampionKey = "";
let selectedScheduleDate = "";
let selectedMomentsDate = "";

function readWorldCupText() {
  const script = document.querySelector("[data-worldcup-client-text]");

  if (!script?.textContent) {
    return DEFAULT_WORLDCUP_TEXT;
  }

  try {
    const parsed = JSON.parse(script.textContent);
    return mergeText(DEFAULT_WORLDCUP_TEXT, parsed?.worldcup || parsed);
  } catch {
    return DEFAULT_WORLDCUP_TEXT;
  }
}

function mergeText(defaultText, overrideText) {
  if (!isPlainObject(defaultText) || !isPlainObject(overrideText)) {
    return overrideText ?? defaultText;
  }

  const merged = { ...defaultText };

  for (const [key, value] of Object.entries(overrideText)) {
    merged[key] = mergeText(defaultText[key], value);
  }

  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

if (root) {
  const elements = {
    sectionTabs: [...root.querySelectorAll("[data-worldcup-tab]")],
    tabViewport: root.querySelector("[data-worldcup-tabs]"),
    tabTrack: root.querySelector("[data-worldcup-tab-track]"),
    tabPanels: [...root.querySelectorAll("[data-worldcup-panel]")],
    schedulePanel: root.querySelector("[data-schedule-wheel-panel]"),
    scheduleStage: root.querySelector("[data-schedule-wheel-stage]"),
    schedule: root.querySelector("[data-schedule-wheel]"),
    scheduleCenter: root.querySelector("[data-schedule-center]"),
    scheduleDateFilter: root.querySelector("[data-schedule-date-filter]"),
    scheduleDateToggle: root.querySelector("[data-schedule-date-toggle]"),
    scheduleDateLabel: root.querySelector("[data-schedule-date-label]"),
    scheduleDateMenu: root.querySelector("[data-schedule-date-menu]"),
    groupStage: root.querySelector("[data-group-stage]"),
    timeline: root.querySelector("[data-timeline]"),
    momentsModeButtons: [...root.querySelectorAll("[data-moments-mode]")],
    momentsPanels: [...root.querySelectorAll("[data-moments-panel]")],
    momentsSort: root.querySelector("[data-moments-sort]"),
    momentsDateFilter: root.querySelector("[data-moments-date-filter]"),
    momentsDateToggle: root.querySelector("[data-moments-date-toggle]"),
    momentsDateLabel: root.querySelector("[data-moments-date-label]"),
    momentsDateMenu: root.querySelector("[data-moments-date-menu]"),
    momentsScrollDate: root.querySelector("[data-moments-scroll-date]"),
    momentsScrollDatePinned: root.querySelector("[data-moments-scroll-date-pinned]"),
    momentsStructure: root.querySelector("[data-moments-structure]"),
    momentsModal: root.querySelector("[data-moments-modal]"),
    momentsDetail: root.querySelector("[data-moments-detail]"),
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
  let activeSectionTab = "schedule";
  let activeMomentsMode = "time";
  let momentsSortDirection = "desc";
  let scheduleScrollFrame = 0;
  const scheduleDragState = {
    active: false,
    frame: 0,
    lastTime: 0,
    lastY: 0,
    pointerId: 0,
    samples: [],
    totalDelta: 0,
    velocity: 0,
    wheelTimer: 0
  };

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
  setupWorldCupTabs(elements, () => data);
  setupScheduleWheel(elements, () => data);
  setupScheduleDateFilter(elements, () => data, (nextDate) => {
    selectedScheduleDate = nextDate;
  }, () => selectedScheduleDate);
  setupMomentsControls(elements, () => data, () => ({
    activeMomentsMode,
    momentsSortDirection,
    momentsDate: selectedMomentsDate
  }), (nextState) => {
    activeMomentsMode = nextState.activeMomentsMode ?? activeMomentsMode;
    momentsSortDirection = nextState.momentsSortDirection ?? momentsSortDirection;
    selectedMomentsDate = nextState.momentsDate ?? selectedMomentsDate;
  });
  setupMomentsScrollDateIndicator(elements);
  setupDraggableBracket(elements.bracket);
  setupHorizontalMomentumScroller(elements.groupStage);
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

    if (event.key === "Escape" && elements.momentsModal && !elements.momentsModal.hidden) {
      clearMomentsDetail(elements);
    }
  });
  loadData();

  window.addEventListener("pagehide", () => {
    window.clearTimeout(refreshTimer);
    window.clearTimeout(goalTimer);
  });

  window.addEventListener("resize", () => {
    syncScheduleWheelEdgePadding(elements);
    syncBracketPosterScale(elements.bracket);
    syncBracketPosterScale(elements.momentsStructure?.querySelector("[data-moments-bracket]"));
    window.requestAnimationFrame(() => drawBracketLines(elements.bracket));
    window.requestAnimationFrame(() => drawBracketLines(elements.momentsStructure?.querySelector("[data-moments-bracket]")));
    window.requestAnimationFrame(() => syncTabViewportHeight(elements, activeSectionTab));
    window.requestAnimationFrame(() => updateScheduleWheelState(elements));
    window.requestAnimationFrame(() => updateMomentsScrollDateIndicator(elements));
  });

  function scheduleNextRefresh(nextData, callback, pageElements) {
    const schedule = getRefreshSchedule(nextData);
    refreshTimer = window.setTimeout(callback, schedule.delayMs);
    renderRefreshPolicy(schedule, pageElements);
  }

  function setupWorldCupTabs(pageElements, readData) {
    setActiveSectionTab(pageElements, activeSectionTab);

    for (const button of pageElements.sectionTabs) {
      button.addEventListener("click", () => {
        activeSectionTab = button.dataset.worldcupTab || "schedule";
        setActiveSectionTab(pageElements, activeSectionTab);
        renderActivePanelData(readData(), pageElements);
        scrollActiveTabContentIntoView(pageElements);
      });
    }
  }

  function setupMomentsControls(pageElements, readData, readState, writeState) {
    for (const button of pageElements.momentsModeButtons) {
      button.addEventListener("click", () => {
        const state = readState();
        const nextState = {
          ...state,
          activeMomentsMode: button.dataset.momentsMode || "time"
        };
        writeState(nextState);
        renderMomentsPanelFromData(readData(), pageElements, nextState, { force: true });
      });
    }

    pageElements.momentsSort?.addEventListener("click", () => {
      const state = readState();
      const nextState = {
        ...state,
        momentsSortDirection: state.momentsSortDirection === "desc" ? "asc" : "desc"
      };
      writeState(nextState);
      renderMomentsPanelFromData(readData(), pageElements, nextState, { force: true });
    });

    pageElements.momentsDateToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = pageElements.momentsDateToggle.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeMomentsDateMenu(pageElements);
      } else {
        openMomentsDateMenu(pageElements);
      }
    });

    pageElements.momentsDateMenu?.addEventListener("click", (event) => {
      const option = event.target.closest("[data-moments-date-option]");

      if (!option) {
        return;
      }

      const nextState = {
        ...readState(),
        momentsDate: option.dataset.momentsDateOption || ""
      };
      writeState(nextState);
      closeMomentsDateMenu(pageElements);
      renderMomentsPanelFromData(readData(), pageElements, nextState, { force: true });
    });

    const openMomentMatch = (matchId, options = {}) => {
      const currentData = readData();
      const sourceMatches = options.sourceMatches || getActiveMomentSourceMatches(currentData);

      renderMomentsDetail(
        matchId,
        currentData,
        pageElements,
        sourceMatches
      );
      syncTabViewportHeight(pageElements, activeSectionTab);

      const match = findMomentMatchById(matchId, currentData, sourceMatches);
      loadPlayerNameData(match ? [match] : []).then(() => {
        if (pageElements.momentsDetail?.dataset.selectedMatchId !== String(matchId)) {
          return;
        }

        renderMomentsDetail(matchId, readData(), pageElements, sourceMatches);
        syncTabViewportHeight(pageElements, activeSectionTab);
      });
    };

    root?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-moments-match-id]");
      const momentsPanel = button?.closest('[data-worldcup-panel="moments"]');

      if (!button || !momentsPanel || !root.contains(button)) {
        return;
      }

      const dragHost = button.closest(".bracket-scroll, .group-stage-scroll");

      if (dragHost?.dataset.suppressClick === "true") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const currentData = readData();
      const sourceMatches = getActiveMomentSourceMatches(currentData);

      openMomentMatch(button.dataset.momentsMatchId, { sourceMatches });
    }, true);

    root?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const button = event.target.closest("[data-moments-match-id]");
      const momentsPanel = button?.closest('[data-worldcup-panel="moments"]');

      if (!button || !momentsPanel || !root.contains(button)) {
        return;
      }

      event.preventDefault();
      const currentData = readData();
      const sourceMatches = getActiveMomentSourceMatches(currentData);

      openMomentMatch(button.dataset.momentsMatchId, { sourceMatches });
    });

    pageElements.momentsModal?.addEventListener("click", (event) => {
      const closeButton = event.target.closest("[data-moments-close]");
      const dismissTarget = event.target.closest("[data-moments-modal-dismiss]");

      if (!closeButton && !dismissTarget) {
        return;
      }

      clearMomentsDetail(pageElements);
      syncTabViewportHeight(pageElements, activeSectionTab);
    });

    document.addEventListener("click", (event) => {
      if (!pageElements.momentsDateFilter?.contains(event.target)) {
        closeMomentsDateMenu(pageElements);
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMomentsDateMenu(pageElements);
      }
    });
  }

  function setupMomentsScrollDateIndicator(pageElements) {
    if (!pageElements.momentsScrollDate || !pageElements.timeline) {
      return;
    }

    let frame = 0;
    const queueUpdate = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateMomentsScrollDateIndicator(pageElements);
      });
    };

    window.addEventListener("scroll", queueUpdate, { passive: true });
    pageElements.tabViewport?.addEventListener("transitionend", queueUpdate);
    queueUpdate();
  }

  function setupScheduleWheel(pageElements, readData) {
    pageElements.scheduleCenter?.addEventListener("click", () => {
      stopScheduleInertia(pageElements, scheduleDragState);

      if (selectedScheduleDate) {
        selectedScheduleDate = "";
        closeScheduleDateMenu(pageElements);
        pageElements.schedule.dataset.hasAutoCentered = "";
        renderDashboard(readData(), null, pageElements);
        return;
      }

      centerScheduleWheel(pageElements, { behavior: "smooth" });
      pageElements.schedule.dataset.hasAutoCentered = "true";
    });

    pageElements.schedule?.addEventListener("scroll", () => {
      window.cancelAnimationFrame(scheduleScrollFrame);
      scheduleScrollFrame = window.requestAnimationFrame(() => {
        constrainScheduleWheelScroll(pageElements);
        updateScheduleWheelState(pageElements);
      });
    }, { passive: true });

    pageElements.schedule?.addEventListener("wheel", () => {
      handleScheduleWheelInput(pageElements, scheduleDragState);
    }, { passive: true });

    pageElements.schedule?.addEventListener("pointerdown", (event) => {
      beginScheduleDrag(event, pageElements, scheduleDragState);
    });

    pageElements.schedule?.addEventListener("pointermove", (event) => {
      moveScheduleDrag(event, pageElements, scheduleDragState);
    });

    pageElements.schedule?.addEventListener("pointerup", (event) => {
      endScheduleDrag(event, pageElements, scheduleDragState);
    });

    pageElements.schedule?.addEventListener("pointercancel", (event) => {
      endScheduleDrag(event, pageElements, scheduleDragState);
    });

    pageElements.schedule?.addEventListener("lostpointercapture", (event) => {
      endScheduleDrag(event, pageElements, scheduleDragState);
    });

    pageElements.schedule?.addEventListener("keydown", (event) => {
      if (event.key !== "Home") {
        return;
      }

      event.preventDefault();
      stopScheduleInertia(pageElements, scheduleDragState);
      centerScheduleWheel(pageElements, { behavior: "smooth" });
    });

    if (readData()) {
      centerScheduleWheel(pageElements);
      pageElements.schedule.dataset.hasAutoCentered = "true";
    }
  }

  function setupScheduleDateFilter(pageElements, readData, writeDate, readDate) {
    pageElements.scheduleDateToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = pageElements.scheduleDateToggle.getAttribute("aria-expanded") === "true";

      if (isOpen) {
        closeScheduleDateMenu(pageElements);
      } else {
        openScheduleDateMenu(pageElements);
      }
    });

    pageElements.scheduleDateMenu?.addEventListener("click", (event) => {
      const option = event.target.closest("[data-schedule-date-option]");

      if (!option) {
        return;
      }

      writeDate(option.dataset.scheduleDateOption || "");
      closeScheduleDateMenu(pageElements);
      pageElements.schedule.dataset.hasAutoCentered = "";
      renderDashboard(readData(), null, pageElements);
    });

    document.addEventListener("click", (event) => {
      if (!pageElements.scheduleDateFilter?.contains(event.target)) {
        closeScheduleDateMenu(pageElements);
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && readDate() !== undefined) {
        closeScheduleDateMenu(pageElements);
      }
    });
  }
}

function setActiveSectionTab(elements, tab) {
  const nextTab = SECTION_TABS.includes(tab) ? tab : "schedule";
  const index = SECTION_TABS.indexOf(nextTab);

  if (root) {
    root.dataset.activeWorldcupTab = nextTab;
  }

  if (elements.tabTrack) {
    elements.tabTrack.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
  }

  if (elements.tabViewport) {
    elements.tabViewport.scrollTop = 0;
  }

  for (const button of elements.sectionTabs || []) {
    const isActive = button.dataset.worldcupTab === nextTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const panel of elements.tabPanels || []) {
    const isActive = panel.dataset.worldcupPanel === nextTab;
    panel.classList.toggle("is-active", isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  }

  syncTabViewportHeight(elements, nextTab);
  window.requestAnimationFrame(() => updateMomentsScrollDateIndicator(elements));
  window.setTimeout(() => syncTabViewportHeight(elements, nextTab), 460);
}

function scrollActiveTabContentIntoView(elements) {
  const tabBar = elements.sectionTabs?.[0]?.closest(".worldcup-section-tabs");
  const viewport = elements.tabViewport;

  if (!tabBar || !viewport) {
    return;
  }

  const tabBarRect = tabBar.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const stickyTop = Number.parseFloat(window.getComputedStyle(tabBar).top) || 0;
  const targetTop = window.scrollY + viewportRect.top - tabBarRect.height - stickyTop - 10;
  const contentIsCovered = viewportRect.top < stickyTop + tabBarRect.height + 8;
  const contentIsTooLow = viewportRect.top > window.innerHeight * .72;

  if (!contentIsCovered && !contentIsTooLow) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
  });
}

function syncTabViewportHeight(elements, tab) {
  if (!elements.tabViewport) {
    return;
  }

  const activePanel = (elements.tabPanels || [])
    .find((panel) => panel.dataset.worldcupPanel === tab)
    || (elements.tabPanels || []).find((panel) => panel.classList.contains("is-active"));

  if (!activePanel) {
    return;
  }

  const measuredHeight = activePanel.getBoundingClientRect().height || activePanel.scrollHeight;
  elements.tabViewport.style.height = `${Math.ceil(measuredHeight)}px`;
  elements.tabViewport.scrollTop = 0;
}

function renderActivePanelData(nextData, elements) {
  if (!nextData) {
    syncTabViewportHeight(elements, root?.dataset.activeWorldcupTab || "schedule");
    return;
  }

  const activeTab = root?.dataset.activeWorldcupTab || "schedule";

  if (activeTab === "overview") {
    if (shouldRenderDeferredPanel(elements, activeTab)) {
      renderOverviewPanelFromData(nextData, elements);
      markDeferredPanelRendered(elements, activeTab);
    }
  }

  if (activeTab === "moments") {
    renderMomentsPanelFromData(nextData, elements);
  }

  window.requestAnimationFrame(() => syncTabViewportHeight(elements, activeTab));
  window.setTimeout(() => syncTabViewportHeight(elements, activeTab), 320);
}

function renderOverviewPanelFromData(nextData, elements) {
  elements.groupStage.innerHTML = renderGroupStage(nextData.groupStage || []);
  elements.bracket.innerHTML = renderBracket(nextData.knockout || [], nextData.groupStage || []);
  delete elements.bracket.dataset.bracketScrollCentered;
  setupHorizontalMomentumScroller(elements.groupStage);
  syncBracketPosterScale(elements.bracket);
  window.requestAnimationFrame(() => {
    syncBracketPosterScale(elements.bracket);
    drawBracketLines(elements.bracket);
  });
  window.setTimeout(() => {
    syncBracketPosterScale(elements.bracket);
    drawBracketLines(elements.bracket);
  }, 280);
}

function renderMomentsPanelFromData(nextData, elements, overrideState = null, options = {}) {
  if (!nextData) {
    return;
  }

  if (!shouldRenderDeferredPanel(elements, "moments", options)) {
    return;
  }

  renderMomentsFromData(nextData, elements, overrideState || readMomentsState(elements));
  markDeferredPanelRendered(elements, "moments");
}

function shouldRenderDeferredPanel(elements, panelName, options = {}) {
  if (options.force) {
    return true;
  }

  const panel = findDeferredPanel(elements, panelName);

  return !panel || panel.dataset.panelRendered !== "true" || panel.dataset.panelDirty === "true";
}

function markDeferredPanelsDirty(elements) {
  for (const panelName of ["overview", "moments"]) {
    const panel = findDeferredPanel(elements, panelName);

    if (panel?.dataset.panelRendered === "true") {
      panel.dataset.panelDirty = "true";
    }
  }
}

function markDeferredPanelRendered(elements, panelName) {
  const panel = findDeferredPanel(elements, panelName);

  if (!panel) {
    return;
  }

  panel.dataset.panelRendered = "true";
  panel.dataset.panelDirty = "false";
}

function findDeferredPanel(elements, panelName) {
  return (elements.tabPanels || []).find((panel) => panel.dataset.worldcupPanel === panelName) || null;
}

function readMomentsState(elements) {
  return {
    activeMomentsMode: root?.dataset.activeMomentsMode || "time",
    momentsSortDirection: elements.momentsSort?.dataset.sortDirection || "desc",
    momentsDate: selectedMomentsDate
  };
}

function renderScheduleDateFilter(matches, elements) {
  if (!elements.scheduleDateLabel || !elements.scheduleDateMenu || !elements.scheduleDateToggle) {
    return;
  }

  const dateText = worldcupText.panels.schedule.dateFilter;
  const dates = buildScheduleDateOptions(matches);
  const selected = dates.find((date) => date.key === selectedScheduleDate);
  const label = selected ? selected.label : dateText.allLabel;

  elements.scheduleDateLabel.textContent = label;
  elements.scheduleDateToggle.classList.toggle("is-filtered", Boolean(selected));
  elements.scheduleDateToggle.setAttribute("aria-label", selected ? label : dateText.toggleAriaLabel);
  elements.scheduleDateMenu.classList.toggle("has-calendar", Boolean(dates.length));

  if (!dates.length) {
    elements.scheduleDateMenu.innerHTML = `<div class="schedule-date-empty">${escapeHtml(dateText.emptyLabel)}</div>`;
    return;
  }

  elements.scheduleDateMenu.innerHTML = renderWorldCupDateCalendar(
    matches,
    selectedScheduleDate,
    dateText,
    "data-schedule-date-option"
  );
}

function renderMomentsDateFilter(matches, elements) {
  if (!elements.momentsDateLabel || !elements.momentsDateMenu || !elements.momentsDateToggle) {
    return;
  }

  const dateText = worldcupText.moments.dateFilter;
  const dates = buildMomentDateOptions(matches);
  const selected = dates.find((date) => date.key === selectedMomentsDate);
  const label = selected ? selected.label : dateText.allLabel;

  elements.momentsDateLabel.textContent = label;
  elements.momentsDateToggle.classList.toggle("is-filtered", Boolean(selected));
  elements.momentsDateToggle.setAttribute("aria-label", selected ? label : dateText.toggleAriaLabel);
  elements.momentsDateMenu.classList.toggle("has-calendar", Boolean(dates.length));

  if (!dates.length) {
    elements.momentsDateMenu.innerHTML = `<div class="schedule-date-empty">${escapeHtml(dateText.emptyLabel)}</div>`;
    return;
  }

  elements.momentsDateMenu.innerHTML = renderMomentsCalendar(matches, selectedMomentsDate);
}

function renderMomentsCalendar(matches, selectedDate = "") {
  const dateText = worldcupText.moments.dateFilter;
  return renderWorldCupDateCalendar(matches, selectedDate, dateText, "data-moments-date-option");
}

function renderWorldCupDateCalendar(matches, selectedDate, dateText, optionAttribute) {
  const calendar = buildMomentCalendar(matches);
  const weekdays = Array.isArray(dateText.weekdays) ? dateText.weekdays.slice(0, 7) : [];

  if (!calendar.days.length) {
    return `<div class="schedule-date-empty">${escapeHtml(dateText.emptyLabel)}</div>`;
  }

  return `
    <div class="moments-calendar" aria-label="${escapeAttribute(dateText.calendarAriaLabel)}">
      <div class="moments-calendar-heading">
        <strong>${escapeHtml(calendar.rangeLabel)}</strong>
        <button class="moments-calendar-all ${selectedDate ? "" : "is-active"}" type="button" role="option" aria-selected="${String(!selectedDate)}" ${optionAttribute}="">
          ${escapeHtml(dateText.allOptionLabel)}
        </button>
      </div>
      <div class="moments-calendar-weekdays" aria-hidden="true">
        ${weekdays.map((weekday) => `<span>${escapeHtml(weekday)}</span>`).join("")}
      </div>
      <div class="moments-calendar-grid">
        ${Array.from({ length: calendar.leadingBlanks }, () => `<span class="moments-calendar-blank" aria-hidden="true"></span>`).join("")}
        ${calendar.days.map((day) => {
          const isActive = day.key === selectedDate;
          const countLabel = formatTemplate(dateText.countTemplate, { count: day.count });
          const ariaLabel = formatTemplate(dateText.dayAriaLabelTemplate, {
            date: day.label,
            count: countLabel
          });

          return `
            <button class="moments-calendar-day ${day.count ? "has-matches" : "is-idle"} ${isActive ? "is-active" : ""}" type="button" role="option" aria-selected="${String(isActive)}" aria-label="${escapeAttribute(ariaLabel)}" ${optionAttribute}="${escapeAttribute(day.key)}" ${day.count ? "" : "disabled"}>
              <span>${escapeHtml(String(day.dayNumber))}</span>
              <i aria-hidden="true"></i>
            </button>
          `;
        }).join("")}
        ${Array.from({ length: calendar.trailingBlanks }, () => `<span class="moments-calendar-blank" aria-hidden="true"></span>`).join("")}
      </div>
    </div>
  `;
}

function buildMomentDateOptions(matches) {
  return buildScheduleDateOptions(matches);
}

function buildMomentCalendar(matches) {
  const dateOptions = buildScheduleDateOptions(matches);

  if (!dateOptions.length) {
    return { days: [], leadingBlanks: 0, trailingBlanks: 0, rangeLabel: "" };
  }

  const countByDate = new Map(dateOptions.map((date) => [date.key, date.count]));
  const start = parseScheduleDateKey(dateOptions[0].key);
  const end = parseScheduleDateKey(dateOptions[dateOptions.length - 1].key);

  if (!start || !end) {
    return { days: [], leadingBlanks: 0, trailingBlanks: 0, rangeLabel: "" };
  }

  const days = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const key = formatScheduleDateKey(cursor);
    days.push({
      key,
      count: countByDate.get(key) || 0,
      dayNumber: cursor.getDate(),
      label: formatScheduleDateLabel(key)
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const leadingBlanks = (start.getDay() + 6) % 7;
  const trailingBlanks = (7 - ((leadingBlanks + days.length) % 7)) % 7;

  return {
    days,
    leadingBlanks,
    trailingBlanks,
    rangeLabel: formatMomentCalendarRange(start, end)
  };
}

function normalizeSelectedMomentDate(dateKey, matches) {
  if (!dateKey) {
    return "";
  }

  const availableDates = new Set(buildMomentDateOptions(matches).map((date) => date.key));
  return availableDates.has(dateKey) ? dateKey : "";
}

function buildScheduleDateOptions(matches) {
  const byDate = new Map();

  for (const match of matches) {
    const key = scheduleDateKey(match);

    if (!key) {
      continue;
    }

    const entry = byDate.get(key) || {
      key,
      label: formatScheduleDateLabel(key),
      count: 0
    };

    entry.count += 1;
    byDate.set(key, entry);
  }

  return [...byDate.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function normalizeSelectedScheduleDate(dateKey, matches) {
  if (!dateKey) {
    return "";
  }

  const availableDates = new Set(matches.map(scheduleDateKey).filter(Boolean));
  return availableDates.has(dateKey) ? dateKey : "";
}

function filterMatchesByScheduleDate(matches, dateKey) {
  if (!dateKey) {
    return matches;
  }

  return matches.filter((match) => scheduleDateKey(match) === dateKey);
}

function scheduleDateKey(match) {
  const date = new Date(match?.kickoffTime || "");

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-");
}

function formatScheduleDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function parseScheduleDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);

  return Number.isFinite(date.getTime()) ? date : null;
}

function formatScheduleDateKey(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-");
}

function formatMomentCalendarRange(start, end) {
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });

  return `${start.getFullYear()} · ${dateFormatter.format(start)}–${dateFormatter.format(end)}`;
}

function formatMomentScrollDateLabel(dateKey) {
  const date = parseScheduleDateKey(dateKey);

  if (!date) {
    return "";
  }

  const datePart = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);

  return `${datePart} · ${weekday}`;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function openScheduleDateMenu(elements) {
  if (!elements.scheduleDateMenu || !elements.scheduleDateToggle) {
    return;
  }

  elements.scheduleDateMenu.hidden = false;
  elements.scheduleDateMenu.scrollTop = 0;
  elements.scheduleDateToggle.setAttribute("aria-expanded", "true");
}

function closeScheduleDateMenu(elements) {
  if (!elements.scheduleDateMenu || !elements.scheduleDateToggle) {
    return;
  }

  elements.scheduleDateMenu.hidden = true;
  elements.scheduleDateToggle.setAttribute("aria-expanded", "false");
}

function openMomentsDateMenu(elements) {
  if (!elements.momentsDateMenu || !elements.momentsDateToggle) {
    return;
  }

  elements.momentsDateMenu.hidden = false;
  elements.momentsDateMenu.scrollTop = 0;
  elements.momentsDateToggle.setAttribute("aria-expanded", "true");
}

function closeMomentsDateMenu(elements) {
  if (!elements.momentsDateMenu || !elements.momentsDateToggle) {
    return;
  }

  elements.momentsDateMenu.hidden = true;
  elements.momentsDateToggle.setAttribute("aria-expanded", "false");
}

function renderScheduleWheel(matches, previousData) {
  if (!matches.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noUpcomingMatches)}</div>`;
  }

  const orderedMatches = sortMatchesByKickoff(matches);
  const focusMatch = pickScheduleWheelFocus(orderedMatches);

  return orderedMatches
    .map((match) => renderScheduleWheelCard(match, previousData, focusMatch?.id))
    .join("");
}

function renderScheduleWheelCard(match, previousData, focusMatchId) {
  const previousMatch = findPreviousMatch(previousData, match.id);
  const homeChanged = scoreChanged(match.home?.score, previousMatch?.home?.score);
  const awayChanged = scoreChanged(match.away?.score, previousMatch?.away?.score);
  const homeFlag = teamFlagUrl(match.home);
  const awayFlag = teamFlagUrl(match.away);
  const homeName = teamDisplayName(match.home?.name);
  const awayName = teamDisplayName(match.away?.name);
  const hasPenaltyScore = Boolean(readPenaltyScorePair(match));
  return `
    <article class="schedule-wheel-card status-${escapeAttribute(String(match.status || "").toLowerCase())}${hasPenaltyScore ? " has-penalty-score" : ""}" data-schedule-card data-match-id="${escapeAttribute(match.id)}" data-focus-match="${String(match.id) === String(focusMatchId) ? "true" : "false"}" data-home-flag="${escapeAttribute(homeFlag)}" data-away-flag="${escapeAttribute(awayFlag)}">
      <div class="schedule-wheel-team schedule-wheel-team-home">
        ${renderTeamImage(match.home)}
        <strong>${escapeHtml(homeName)}</strong>
      </div>
      <div class="schedule-wheel-score">
        <span>${escapeHtml(stageLabel(match.stage))}</span>
        <strong aria-label="${escapeAttribute(scoreLabel(match))}">
          <b class="${homeChanged ? "score-pop" : ""}">${escapeHtml(formatSideScore(match, "home"))}</b>
          <em>:</em>
          <b class="${awayChanged ? "score-pop" : ""}">${escapeHtml(formatSideScore(match, "away"))}</b>
        </strong>
        <small>${escapeHtml(match.minute ? formatEventMinute(match.minute) : formatKickoffDateTime(match.kickoffTime))}</small>
      </div>
      <div class="schedule-wheel-team schedule-wheel-team-away">
        ${renderTeamImage(match.away)}
        <strong>${escapeHtml(awayName)}</strong>
      </div>
      <div class="schedule-wheel-venue">
        ${renderStatus(match)}
        <span>${escapeHtml(match.venue || runtimeText.states.defaultVenue)}</span>
      </div>
    </article>
  `;
}

function pickScheduleWheelFocus(matches) {
  const now = Date.now();
  const live = matches.find((match) => isLive(match.status));

  if (live) {
    return live;
  }

  const recentFinished = [...matches]
    .filter((match) => isFinished(match.status))
    .filter((match) => now - matchKickoffTime(match) <= POST_KICKOFF_WINDOW)
    .sort((a, b) => matchKickoffTime(b) - matchKickoffTime(a))[0];

  if (recentFinished) {
    return recentFinished;
  }

  const nextMatch = matches
    .filter((match) => match.status === "NS")
    .filter((match) => matchKickoffTime(match) >= now)
    .sort((a, b) => matchKickoffTime(a) - matchKickoffTime(b))[0];

  if (nextMatch) {
    return nextMatch;
  }

  return [...matches]
    .filter((match) => match.status !== "NS")
    .sort((a, b) => matchKickoffTime(b) - matchKickoffTime(a))[0] || matches[0] || null;
}

function centerScheduleWheel(elements, options = {}) {
  const wheel = elements.schedule;
  const focusCard = wheel?.querySelector('[data-focus-match="true"]');

  if (!wheel || !focusCard) {
    updateScheduleWheelState(elements);
    return;
  }

  const targetTop = focusCard.offsetTop + focusCard.offsetHeight / 2 - wheel.clientHeight / 2;
  const clampedTop = clampScheduleScrollTop(wheel, targetTop);
  const behavior = options.behavior || "auto";

  if (behavior === "smooth") {
    wheel.scrollTo({
      top: clampedTop,
      behavior
    });
  } else {
    const previousScrollBehavior = wheel.style.scrollBehavior;
    wheel.style.scrollBehavior = "auto";
    wheel.scrollTop = clampedTop;
    wheel.style.scrollBehavior = previousScrollBehavior;
  }

  window.setTimeout(() => updateScheduleWheelState(elements), behavior === "smooth" ? 360 : 40);
}

function beginScheduleDrag(event, elements, state) {
  const wheel = elements.schedule;

  if (!wheel || event.pointerType === "touch" || event.button > 0) {
    return;
  }

  stopScheduleInertia(elements, state);
  state.active = true;
  state.lastY = event.clientY;
  state.lastTime = performance.now();
  state.pointerId = event.pointerId;
  state.samples = [{ time: state.lastTime, y: state.lastY }];
  state.totalDelta = 0;
  state.velocity = 0;
  wheel.classList.add("is-dragging");
  wheel.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleScheduleWheelInput(elements, state) {
  const wheel = elements.schedule;

  if (!wheel || state.active) {
    return;
  }

  window.cancelAnimationFrame(state.frame);
  window.clearTimeout(state.wheelTimer);
  state.frame = 0;
  state.wheelTimer = 0;
  wheel.classList.remove("is-gliding");
}

function moveScheduleDrag(event, elements, state) {
  const wheel = elements.schedule;

  if (!wheel || !state.active || state.pointerId !== event.pointerId) {
    return;
  }

  const now = performance.now();
  const deltaScroll = state.lastY - event.clientY;
  const deltaTime = Math.max(1, now - state.lastTime);
  const nextVelocity = deltaScroll / deltaTime;

  wheel.scrollTop += deltaScroll;
  constrainScheduleWheelScroll(elements);
  state.totalDelta += deltaScroll;
  state.velocity = state.velocity * .58 + nextVelocity * .42;
  state.lastY = event.clientY;
  state.lastTime = now;
  state.samples.push({ time: now, y: event.clientY });
  state.samples = state.samples.filter((sample) => now - sample.time <= 140);
  updateScheduleWheelState(elements);
  event.preventDefault();
}

function endScheduleDrag(event, elements, state) {
  const wheel = elements.schedule;

  if (!wheel || !state.active || state.pointerId !== event.pointerId) {
    return;
  }

  state.active = false;
  wheel.classList.remove("is-dragging");

  try {
    wheel.releasePointerCapture?.(event.pointerId);
  } catch {
    // The browser can release capture before pointerup in some drag paths.
  }

  const releaseVelocity = calculateScheduleReleaseVelocity(state);
  const dragDirection = Math.sign(state.totalDelta || releaseVelocity);
  const minimumThrowVelocity = Math.min(Math.max(Math.abs(state.totalDelta) / 210, .62), 1.45);
  const naturalVelocity = Math.abs(state.totalDelta) > 28 && Math.abs(releaseVelocity) < minimumThrowVelocity
    ? dragDirection * minimumThrowVelocity
    : releaseVelocity;

  if (Math.abs(naturalVelocity) > .018) {
    state.velocity = naturalVelocity;
    startScheduleInertia(elements, state);
    return;
  }

  snapScheduleWheelToNearest(elements);
}

function startScheduleInertia(elements, state) {
  const wheel = elements.schedule;

  if (!wheel) {
    return;
  }

  const speed = Math.min(Math.abs(state.velocity), 3.6);
  const direction = Math.sign(state.velocity);
  const distance = direction * Math.min(
    Math.max(speed * 1900, 420),
    wheel.clientHeight * 6.2
  );
  const duration = Math.min(1800, Math.max(620, 520 + speed * 420));
  const startTop = clampScheduleScrollTop(wheel, wheel.scrollTop);
  const targetTop = clampScheduleScrollTop(wheel, startTop + distance);
  const clampedDistance = targetTop - startTop;
  const startedAt = performance.now();

  if (Math.abs(clampedDistance) < 1) {
    snapScheduleWheelToNearest(elements);
    return;
  }

  wheel.scrollTop = startTop;
  wheel.classList.add("is-gliding");

  const step = (time) => {
    const progress = Math.min(1, (time - startedAt) / duration);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const previousTop = wheel.scrollTop;

    wheel.scrollTop = clampScheduleScrollTop(wheel, startTop + clampedDistance * easedProgress);
    updateScheduleWheelState(elements);

    const atScrollBoundary = progress > .08 && Math.abs(wheel.scrollTop - previousTop) < .05;

    if (progress >= 1 || atScrollBoundary) {
      state.frame = 0;
      wheel.classList.remove("is-gliding");
      snapScheduleWheelToNearest(elements);
      return;
    }

    state.frame = window.requestAnimationFrame(step);
  };

  window.cancelAnimationFrame(state.frame);
  state.frame = window.requestAnimationFrame(step);
}

function stopScheduleInertia(elements, state) {
  window.cancelAnimationFrame(state.frame);
  window.clearTimeout(state.wheelTimer);
  state.frame = 0;
  state.wheelTimer = 0;
  state.velocity = 0;
  state.samples = [];
  state.totalDelta = 0;
  elements.schedule?.classList.remove("is-dragging", "is-gliding");
}

function calculateScheduleReleaseVelocity(state) {
  const samples = state.samples || [];

  if (samples.length < 2) {
    return state.velocity;
  }

  const newestSample = samples[samples.length - 1];
  const oldestSample = samples[0];
  const deltaTime = Math.max(1, newestSample.time - oldestSample.time);
  const sampledVelocity = (oldestSample.y - newestSample.y) / deltaTime;

  return sampledVelocity * .74 + state.velocity * .26;
}

function snapScheduleWheelToNearest(elements) {
  const wheel = elements.schedule;
  const card = getNearestScheduleCard(wheel);

  if (!wheel || !card) {
    updateScheduleWheelState(elements);
    return;
  }

  const targetTop = card.offsetTop + card.offsetHeight / 2 - wheel.clientHeight / 2;
  const clampedTop = clampScheduleScrollTop(wheel, targetTop);

  if (Math.abs(wheel.scrollTop - clampedTop) < 1) {
    updateScheduleWheelState(elements);
    return;
  }

  wheel.scrollTo({
    top: clampedTop,
    behavior: "smooth"
  });
  window.setTimeout(() => updateScheduleWheelState(elements), 320);
}

function getNearestScheduleCard(wheel) {
  if (!wheel) {
    return null;
  }

  const centerY = wheel.scrollTop + wheel.clientHeight / 2;
  let nearestCard = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const card of wheel.querySelectorAll("[data-schedule-card]")) {
    const cardCenter = card.offsetTop + card.offsetHeight / 2;
    const distance = Math.abs(cardCenter - centerY);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCard = card;
    }
  }

  return nearestCard;
}

function updateScheduleWheelState(elements) {
  const wheel = elements.schedule;

  if (!wheel) {
    return;
  }

  constrainScheduleWheelScroll(elements);

  const cards = [...wheel.querySelectorAll("[data-schedule-card]")];

  if (!cards.length) {
    return;
  }

  const centerY = wheel.scrollTop + wheel.clientHeight / 2;
  const influenceRange = Math.max(1, wheel.clientHeight / 2);
  let activeCard = cards[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const cardCenter = card.offsetTop + card.offsetHeight / 2;
    const distance = (cardCenter - centerY) / influenceRange;
    const clampedDistance = Math.max(-1.35, Math.min(1.35, distance));
    const absDistance = Math.abs(distance);

    card.style.setProperty("--wheel-distance", clampedDistance.toFixed(3));
    card.classList.toggle("is-before-center", distance < -.22);
    card.classList.toggle("is-after-center", distance > .22);

    if (absDistance < bestDistance) {
      bestDistance = absDistance;
      activeCard = card;
    }
  }

  for (const card of cards) {
    card.classList.toggle("is-active", card === activeCard);
  }

  updateScheduleFlagWash(elements, activeCard);
}

function updateScheduleFlagWash(elements, card) {
  if (!elements.schedulePanel || !card) {
    return;
  }

  const homeFlag = card.dataset.homeFlag || "";
  const awayFlag = card.dataset.awayFlag || "";
  const distance = card.style.getPropertyValue("--wheel-distance") || "0";

  elements.schedulePanel.style.setProperty("--wheel-home-flag", homeFlag ? `url('${homeFlag}')` : "none");
  elements.schedulePanel.style.setProperty("--wheel-away-flag", awayFlag ? `url('${awayFlag}')` : "none");
  elements.schedulePanel.style.setProperty("--wheel-distance", distance);
}

function syncScheduleWheelEdgePadding(elements) {
  const wheel = elements.schedule;

  if (!wheel) {
    return;
  }

  wheel.style.removeProperty("--schedule-wheel-padding-start");
  wheel.style.removeProperty("--schedule-wheel-padding-end");

  const cards = [...wheel.querySelectorAll("[data-schedule-card]")];

  if (!cards.length) {
    return;
  }

  const styles = window.getComputedStyle(wheel);
  const basePaddingStart = Number.parseFloat(styles.paddingTop) || 0;
  const basePaddingEnd = Number.parseFloat(styles.paddingBottom) || 0;
  const firstCard = cards[0];
  const lastCard = cards[cards.length - 1];
  const firstCenterTop = firstCard.offsetTop + firstCard.offsetHeight / 2 - wheel.clientHeight / 2;
  const nativeMaxTop = Math.max(0, wheel.scrollHeight - wheel.clientHeight);
  const lastCenterTop = lastCard.offsetTop + lastCard.offsetHeight / 2 - wheel.clientHeight / 2;
  const startCorrection = Math.max(0, firstCenterTop);
  const endCorrection = Math.max(0, nativeMaxTop - lastCenterTop);
  const nextPaddingStart = Math.max(0, basePaddingStart - startCorrection);
  const nextPaddingEnd = Math.max(0, basePaddingEnd - endCorrection);

  wheel.style.setProperty("--schedule-wheel-padding-start", `${nextPaddingStart.toFixed(1)}px`);
  wheel.style.setProperty("--schedule-wheel-padding-end", `${nextPaddingEnd.toFixed(1)}px`);
}

function constrainScheduleWheelScroll(elements) {
  const wheel = elements.schedule;

  if (!wheel) {
    return 0;
  }

  const clampedTop = clampScheduleScrollTop(wheel, wheel.scrollTop);

  if (Math.abs(wheel.scrollTop - clampedTop) > .5) {
    wheel.scrollTop = clampedTop;
  }

  return clampedTop;
}

function clampScheduleScrollTop(wheel, scrollTop) {
  const bounds = getScheduleScrollBounds(wheel);

  return Math.max(bounds.minTop, Math.min(bounds.maxTop, scrollTop));
}

function getScheduleScrollBounds(wheel) {
  const nativeMaxTop = Math.max(0, (wheel?.scrollHeight || 0) - (wheel?.clientHeight || 0));

  return {
    minTop: 0,
    maxTop: nativeMaxTop
  };
}

function updateMomentsScrollDateIndicator(elements) {
  const indicator = elements?.momentsScrollDate;
  const pinnedIndicator = elements?.momentsScrollDatePinned;
  const timeline = elements?.timeline;
  const isTimeMode = root?.dataset.activeWorldcupTab === "moments"
    && root?.dataset.activeMomentsMode === "time";

  if (!indicator || !timeline || !isTimeMode) {
    if (indicator) {
      indicator.hidden = true;
    }
    if (pinnedIndicator) {
      pinnedIndicator.hidden = true;
      pinnedIndicator.classList.remove("is-stacked");
    }
    return;
  }

  const cards = [...timeline.querySelectorAll("[data-timeline-date]")];

  if (!cards.length) {
    indicator.hidden = true;
    if (pinnedIndicator) {
      pinnedIndicator.hidden = true;
      pinnedIndicator.classList.remove("is-stacked");
    }
    return;
  }

  const tabNav = root?.querySelector(".worldcup-section-tabs");
  const timePanel = timeline.closest('[data-moments-panel="time"]');
  const heading = indicator.closest(".moments-panel-heading");
  const navRect = tabNav?.getBoundingClientRect();
  const anchorY = Math.max(16, (navRect?.bottom || 0) + 12);
  const currentCard = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return rect.bottom > anchorY && rect.top < window.innerHeight;
  }) || cards[0];
  const dateKey = currentCard.dataset.timelineDate || "";
  const label = formatMomentScrollDateLabel(dateKey);

  if (!label) {
    indicator.hidden = true;
    if (pinnedIndicator) {
      pinnedIndicator.hidden = true;
    }
    return;
  }

  indicator.hidden = false;
  indicator.textContent = label;
  indicator.dataset.currentDate = dateKey;

  if (pinnedIndicator) {
    pinnedIndicator.textContent = label;
    pinnedIndicator.dataset.currentDate = dateKey;
  }

  const headingRect = heading?.getBoundingClientRect();
  const panelRect = timePanel?.getBoundingClientRect();
  const shouldPin = Boolean(navRect && headingRect && panelRect
    && headingRect.bottom <= navRect.bottom + 8
    && panelRect.bottom > navRect.bottom + 52);

  if (!pinnedIndicator || !shouldPin || !navRect) {
    if (pinnedIndicator) {
      pinnedIndicator.hidden = true;
      pinnedIndicator.classList.remove("is-stacked");
    }
    return;
  }

  pinnedIndicator.hidden = false;
  const availableRight = window.innerWidth - navRect.right;
  const shouldStack = availableRight < pinnedIndicator.offsetWidth + 18;
  pinnedIndicator.classList.toggle("is-stacked", shouldStack);
  pinnedIndicator.style.setProperty("--moments-date-pin-left", `${Math.round(navRect.right + 10)}px`);
  pinnedIndicator.style.setProperty(
    "--moments-date-pin-top",
    `${Math.round(shouldStack ? navRect.bottom + 8 : navRect.top + (navRect.height - pinnedIndicator.offsetHeight) / 2)}px`
  );
}

function renderMomentsFromData(nextData, elements, state = {}) {
  if (!nextData) {
    return;
  }

  const activeMode = state.activeMomentsMode || "time";
  const sortDirection = state.momentsSortDirection === "asc" ? "asc" : "desc";
  const sourceMatches = getMomentSourceMatches(nextData);
  selectedMomentsDate = normalizeSelectedMomentDate(state.momentsDate ?? selectedMomentsDate, sourceMatches);
  const timeMatches = filterMatchesByScheduleDate(sourceMatches, selectedMomentsDate);

  if (root) {
    root.dataset.activeMomentsMode = activeMode;
  }

  for (const button of elements.momentsModeButtons || []) {
    const isActive = button.dataset.momentsMode === activeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const panel of elements.momentsPanels || []) {
    const isActive = panel.dataset.momentsPanel === activeMode;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  }

  if (elements.momentsSort) {
    elements.momentsSort.dataset.sortDirection = sortDirection;
    elements.momentsSort.textContent = sortDirection === "asc"
      ? worldcupText.moments.sort.asc
      : worldcupText.moments.sort.desc;
  }

  renderMomentsDateFilter(sourceMatches, elements);

  if (elements.timeline) {
    elements.timeline.innerHTML = renderTimeline(timeMatches, {
      limit: Number.POSITIVE_INFINITY,
      sortMode: sortDirection === "asc" ? "matchTimeAsc" : "matchTimeDesc"
    });
  }

  window.requestAnimationFrame(() => updateMomentsScrollDateIndicator(elements));

  if (elements.momentsStructure) {
    elements.momentsStructure.innerHTML = renderMomentsStructure(
      sourceMatches,
      nextData.groupStage || [],
      nextData.knockout || [],
      elements.momentsDetail?.dataset.selectedMatchId || "",
      sortDirection
    );

    const momentsBracket = elements.momentsStructure.querySelector("[data-moments-bracket]");

    if (momentsBracket) {
      setupDraggableBracket(momentsBracket);
      window.requestAnimationFrame(() => drawBracketLines(momentsBracket));
      window.setTimeout(() => drawBracketLines(momentsBracket), 280);
    }

    for (const scroller of elements.momentsStructure.querySelectorAll(".group-stage-scroll")) {
      setupHorizontalMomentumScroller(scroller);
    }
  }

  const selectedMatchId = elements.momentsDetail?.dataset.selectedMatchId || "";
  const detailSourceMatches = activeMode === "structure" ? sourceMatches : timeMatches;
  const selectedStillVisible = selectedMatchId
    && getStructureMomentSourceMatches(nextData, detailSourceMatches).some((match) => String(match.id) === String(selectedMatchId));

  if (selectedStillVisible) {
    renderMomentsDetail(selectedMatchId, nextData, elements, detailSourceMatches);
  } else {
    clearMomentsDetail(elements);
  }

  syncTabViewportHeight(elements, root?.dataset.activeWorldcupTab || "schedule");
}

function getMomentSourceMatches(nextData) {
  const allMatches = getAllMatches(nextData);

  if (allMatches.length) {
    return allMatches;
  }

  return nextData?.timelineMatches || [];
}

function getActiveMomentSourceMatches(nextData) {
  const sourceMatches = getMomentSourceMatches(nextData);

  return root?.dataset.activeMomentsMode === "structure"
    ? sourceMatches
    : filterMatchesByScheduleDate(sourceMatches, selectedMomentsDate);
}

function renderMomentsStructure(matches, groupStage, knockout, selectedMatchId = "", sortDirection = "desc") {
  const sortMode = sortDirection === "asc" ? "matchTimeAsc" : "matchTimeDesc";
  const groups = buildTimelineGroups(matches, sortMode);

  if (!groups.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noTimelineEvents)}</div>`;
  }

  const momentMatchIds = new Set(groups.map(({ match }) => String(match.id)));
  const interactiveMatchIds = buildStructureMatchIds(groupStage, knockout);
  const hasKnockout = Array.isArray(knockout) && knockout.length;
  const hasGroupStage = Array.isArray(groupStage) && groupStage.length;

  return `
    <div class="moments-structure-visual">
      ${hasKnockout ? `
        <section class="moments-structure-section moments-structure-bracket">
          <h3>${escapeHtml(worldcupText.panels.bracket.title)}</h3>
          <div class="bracket-scroll moments-bracket-scroll" data-moments-bracket>
            ${renderBracket(knockout, [], {
              momentMatchIds,
              interactiveMatchIds,
              selectedMatchId,
              interactiveMoments: true
            })}
          </div>
        </section>
      ` : ""}
      ${hasGroupStage ? `
        <section class="moments-structure-section moments-structure-groups">
          <h3>${escapeHtml(worldcupText.panels.groupStage.title)}</h3>
          <div class="group-stage-scroll moments-group-stage-scroll">
            ${renderGroupStage(groupStage, {
              momentMatchIds,
              interactiveMatchIds,
              selectedMatchId
            })}
          </div>
        </section>
      ` : ""}
      ${!hasKnockout && !hasGroupStage ? renderMomentStageSection(stageLabel("Group Stage"), groups, selectedMatchId) : ""}
    </div>
  `;
}

function buildStructureMatchIds(groupStage, knockout) {
  return new Set([
    ...(knockout || []).map((match) => String(match.id)),
    ...(groupStage || []).flatMap((group) => (group.matches || []).map((match) => String(match.id)))
  ]);
}

function renderMomentGroupStageSections(momentGroups, groupStage, selectedMatchId, sortDirection = "desc") {
  if (!groupStage.length) {
    const groupOnly = momentGroups.filter(({ match }) => isGroupStageMatch(match));
    return groupOnly.length
      ? renderMomentStageSection(stageLabel("Group Stage"), groupOnly, selectedMatchId)
      : "";
  }

  const groupMap = new Map(momentGroups.map((group) => [String(group.match.id), group]));

  return groupStage.map((group) => {
    const orderedMatches = sortMatchesByKickoff(group.matches || []);
    const sectionGroups = (sortDirection === "asc" ? orderedMatches : [...orderedMatches].reverse())
      .map((match) => groupMap.get(String(match.id)))
      .filter(Boolean);

    if (!sectionGroups.length) {
      return "";
    }

    return renderMomentStageSection(formatGroupLabel(group.group), sectionGroups, selectedMatchId);
  }).join("");
}

function renderMomentKnockoutSections(momentGroups, knockout, selectedMatchId) {
  const knockoutIds = new Set((knockout || []).map((match) => String(match.id)));
  const byStage = new Map();

  for (const group of momentGroups) {
    const match = group.match;

    if (isGroupStageMatch(match) && !knockoutIds.has(String(match.id))) {
      continue;
    }

    const stage = stageLabel(match.stage || match.round);

    if (!byStage.has(stage)) {
      byStage.set(stage, []);
    }

    byStage.get(stage).push(group);
  }

  return [...byStage.entries()]
    .map(([stage, groups]) => renderMomentStageSection(stage, groups, selectedMatchId))
    .join("");
}

function renderMomentStageSection(title, groups, selectedMatchId) {
  return `
    <section class="moments-structure-section">
      <h3>${escapeHtml(title)}</h3>
      <div class="moments-match-list">
        ${groups.map((group) => renderMomentMatchButton(group, selectedMatchId)).join("")}
      </div>
    </section>
  `;
}

function renderMomentMatchButton(group, selectedMatchId) {
  const { match, events } = group;
  const selected = String(match.id) === String(selectedMatchId);
  const score = formatMatchScore(match);

  return `
    <button class="moments-match-button ${selected ? "is-selected" : ""}" type="button" data-moments-match-id="${escapeAttribute(match.id)}" aria-label="${escapeAttribute(formatTemplate(worldcupText.moments.expandMatchAriaLabel, { match: formatMatchTitle(match) }))}">
      <span class="moments-match-meta">
        <b>${escapeHtml(formatKickoffDateTime(match.kickoffTime))}</b>
        <em>${escapeHtml(formatTemplate(worldcupText.moments.matchEventsTemplate, { count: events.length }))}</em>
      </span>
      <span class="moments-match-teams">
        <span>${renderTeamFlag(match.home?.name)}${escapeHtml(teamDisplayName(match.home?.name))}</span>
          <strong>${escapeHtml(score)}</strong>
        <span>${renderTeamFlag(match.away?.name)}${escapeHtml(teamDisplayName(match.away?.name))}</span>
      </span>
    </button>
  `;
}

function renderMomentsDetail(matchId, nextData, elements, sourceMatches = null) {
  const source = getStructureMomentSourceMatches(nextData, sourceMatches);
  const groups = buildTimelineGroups(source, "matchTimeDesc");
  const group = groups.find(({ match }) => String(match.id) === String(matchId));
  const fallbackMatch = source.find((match) => String(match.id) === String(matchId));

  if (!elements.momentsDetail || !elements.momentsModal || (!group && !fallbackMatch)) {
    clearMomentsDetail(elements);
    return;
  }

  elements.momentsDetail.dataset.selectedMatchId = String(matchId);
  elements.momentsModal.hidden = false;
  elements.momentsModal.classList.add("is-visible");
  elements.momentsDetail.innerHTML = renderMomentDetailCard(group?.match || fallbackMatch, group?.events || []);

  for (const button of elements.momentsStructure?.querySelectorAll("[data-moments-match-id]") || []) {
    button.classList.toggle("is-selected", button.dataset.momentsMatchId === String(matchId));
  }
}

function findMomentMatchById(matchId, nextData, sourceMatches = null) {
  return getStructureMomentSourceMatches(nextData, sourceMatches)
    .find((match) => String(match.id) === String(matchId)) || null;
}

function getStructureMomentSourceMatches(nextData, sourceMatches = null) {
  const source = sourceMatches || getMomentSourceMatches(nextData);
  const byId = new Map(source.map((match) => [String(match.id), match]));

  for (const match of nextData?.knockout || []) {
    if (!byId.has(String(match.id))) {
      byId.set(String(match.id), bracketMatchToMomentMatch(match));
    }
  }

  for (const group of nextData?.groupStage || []) {
    for (const match of group.matches || []) {
      if (!byId.has(String(match.id))) {
        byId.set(String(match.id), match);
      }
    }
  }

  return [...byId.values()];
}

function bracketMatchToMomentMatch(match) {
  return {
    id: match.id,
    status: match.status,
    statusText: match.statusText,
    stage: match.round,
    round: match.round,
    group: "",
    venue: match.venue || runtimeText.states.defaultVenue,
    kickoffTime: match.kickoffTime || "",
    home: {
      name: match.home,
      score: match.homeScore
    },
    away: {
      name: match.away,
      score: match.awayScore
    },
    homePenaltyScore: match.homePenaltyScore,
    awayPenaltyScore: match.awayPenaltyScore,
    penaltyScore: match.penaltyScore,
    events: []
  };
}

function clearMomentsDetail(elements) {
  if (!elements.momentsDetail) {
    return;
  }

  delete elements.momentsDetail.dataset.selectedMatchId;
  elements.momentsDetail.innerHTML = "";

  if (elements.momentsModal) {
    elements.momentsModal.classList.remove("is-visible");
    elements.momentsModal.hidden = true;
  }

  for (const button of elements.momentsStructure?.querySelectorAll("[data-moments-match-id]") || []) {
    button.classList.remove("is-selected");
  }
}

function renderMomentDetailCard(match, events) {
  return `
    <article class="moments-detail-card">
      <header class="moments-detail-header">
        <div>
          <strong>${escapeHtml(formatMatchTitle(match))}</strong>
          <span>${escapeHtml(formatKickoffDateTime(match.kickoffTime))} · ${escapeHtml(match.group ? formatGroupLabel(match.group) : stageLabel(match.stage))}</span>
        </div>
      </header>
      <div class="timeline-event-list">
        ${events.length ? events.map((event) => renderTimelineEvent(event)).join("") : `<div class="empty-state">${escapeHtml(runtimeText.states.noTimelineEvents)}</div>`}
      </div>
    </article>
  `;
}

function isGroupStageMatch(match) {
  return match?.stage === "Group Stage" || Boolean(match?.group);
}

export async function fetchWorldCupData(currentData, tick, elements) {
  try {
    const payload = await fetchDataPayload();
    const allowMock = shouldAllowWorldCupMock();

    if (payload.source === "mock" && currentData?.source === "mock" && allowMock) {
      clearError(elements);
      return {
        ...createMockWorldCupUpdate(currentData, tick),
        message: payload.message || currentData.message,
        polling: payload.polling || currentData.polling
      };
    }

    clearError(elements);
    return normalizeClientPayload(payload);
  } catch (error) {
    const allowMock = shouldAllowWorldCupMock();
    const isCurrentMock = currentData?.source === "mock";
    const message = isCurrentMock && allowMock
      ? runtimeText.fetchErrors.localMockContinue
      : currentData
        ? runtimeText.fetchErrors.keepPrevious
        : allowMock
          ? runtimeText.fetchErrors.localMockInitial
          : runtimeText.fetchErrors.latestUnavailable;

    showError(elements, message);

    if (isCurrentMock && allowMock) {
      return {
        ...createMockWorldCupUpdate(currentData, tick),
        message,
        polling: currentData.polling
      };
    }

    if (currentData) {
      return null;
    }

    if (!allowMock) {
      return null;
    }

    return {
      ...withFreshTimestamp(mockWorldCupData),
      message
    };
  }
}

function withBasePath(path) {
  if (!path || path === "#" || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) {
    return path;
  }

  const normalizedBase = BASE_PATH.endsWith("/") ? BASE_PATH : `${BASE_PATH}/`;
  const cleanedPath = path.startsWith("/") ? path.slice(1) : path;

  return `${normalizedBase}${cleanedPath}`;
}

function withFreshTimestamp(sourceData) {
  return {
    ...structuredClone(sourceData),
    lastUpdated: new Date().toISOString()
  };
}

function renderDashboard(nextData, previousData, elements) {
  const allMatches = sortMatchesByKickoff(getAllMatches(nextData));
  selectedScheduleDate = normalizeSelectedScheduleDate(selectedScheduleDate, allMatches);
  renderScheduleDateFilter(allMatches, elements);
  const scheduleMatches = filterMatchesByScheduleDate(allMatches, selectedScheduleDate);
  const scheduleScrollTop = elements.schedule.scrollTop;
  const shouldAutoCenterSchedule = elements.schedule.dataset.hasAutoCentered !== "true";

  elements.schedule.innerHTML = renderScheduleWheel(scheduleMatches, previousData);
  syncScheduleWheelEdgePadding(elements);
  if (!shouldAutoCenterSchedule) {
    elements.schedule.scrollTop = clampScheduleScrollTop(elements.schedule, scheduleScrollTop);
  }
  window.requestAnimationFrame(() => {
    if (shouldAutoCenterSchedule) {
      centerScheduleWheel(elements);
      elements.schedule.dataset.hasAutoCentered = "true";
    }
    updateScheduleWheelState(elements);
  });
  markDeferredPanelsDirty(elements);
  renderActivePanelData(nextData, elements);
  window.requestAnimationFrame(() => syncTabViewportHeight(elements, root.dataset.activeWorldcupTab || "schedule"));

  const liveCount = allMatches.filter((match) => isLive(match.status)).length;
  elements.liveCount.textContent = formatTemplate(worldcupText.statusRow.liveCountTemplate, { count: liveCount });
  elements.updatedAt.textContent = formatTemplate(worldcupText.statusRow.updatedAtTemplate, {
    time: formatTime(nextData.lastUpdated)
  });
  if (elements.sourcePill) {
    elements.sourcePill.textContent = sourceLabel(nextData.source);
  }
  if (nextData.clientDataState?.staleFallback) {
    showError(elements, runtimeText.fetchErrors.staleSnapshot);
  } else {
    clearError(elements);
  }
  renderChampionCelebration(nextData, elements);
}

function getRefreshSchedule(nextData) {
  if (
    nextData?.polling?.mode === "api-empty-fallback"
    || nextData?.polling?.mode === "api-plan-fallback"
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

    if (nextKickoff - now <= NEAR_MATCH_WINDOW) {
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
    ${renderFlagWash(match.home, "home")}
    ${renderFlagWash(match.away, "away")}
    <div class="hero-meta">
      ${renderStatus(match)}
      <span>${escapeHtml(stageLabel(match.stage))}</span>
      <span>${escapeHtml(match.venue || runtimeText.states.defaultVenue)}</span>
    </div>
    <div class="hero-versus">
      ${renderHeroTeam(match.home, "home")}
      <div class="hero-score" aria-label="${escapeAttribute(scoreLabel(match))}">
        <span class="score-number ${homeChanged ? "score-pop" : ""}">${escapeHtml(formatSideScore(match, "home", { unknownWhenNotStarted: true }))}</span>
        <span class="score-divider">:</span>
        <span class="score-number ${awayChanged ? "score-pop" : ""}">${escapeHtml(formatSideScore(match, "away", { unknownWhenNotStarted: true }))}</span>
      </div>
      ${renderHeroTeam(match.away, "away")}
    </div>
    <div class="hero-footer">
      <span>${match.minute ? `${match.minute}'` : formatKickoff(match.kickoffTime)}</span>
      <span>${escapeHtml(latestGoal ? formatTemplate(runtimeText.states.latestGoalTemplate, {
        minute: latestGoal.minute,
        player: latestGoal.player ? formatPlayerDisplayName(latestGoal.player, latestGoal.team) : teamDisplayName(latestGoal.team)
      }) : runtimeText.states.waitingKickoff)}</span>
      <span>${escapeHtml(data.source === "mock" ? runtimeText.states.mockSource : runtimeText.states.liveSource)}</span>
    </div>
  `;
}

function renderHeroTeam(team, side) {
  return `
    <div class="hero-team ${side}">
      ${renderTeamImage(team)}
      ${renderHeroTeamCode(team)}
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
        <span class="${homeChanged ? "score-pop" : ""}">${escapeHtml(formatSideScore(match, "home"))}</span>
        <small>${match.minute ? formatEventMinute(match.minute) : formatKickoffDateTime(match.kickoffTime)}</small>
        <span class="${awayChanged ? "score-pop" : ""}">${escapeHtml(formatSideScore(match, "away"))}</span>
      </div>
      ${renderMiniTeam(match.away)}
    </article>
  `;
}

function renderMiniTeam(team) {
  return `
    <div class="mini-team">
      ${renderTeamImage(team)}
      <span>${escapeHtml(teamDisplayName(team.name))}</span>
      ${renderMiniTeamCode(team)}
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
    const dateKey = scheduleDateKey(match);
    const dateAttr = dateKey ? ` data-timeline-date="${escapeAttribute(dateKey)}"` : "";
    const displayEvents = compact ? events.slice(0, 2) : events;
    const hiddenEventCount = Math.max(0, events.length - displayEvents.length);

    return `
    <${tag} class="timeline-match ${compact ? "timeline-match-compact" : ""}"${href}${id}${dateAttr}>
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
  const teamName = event.teamName || event.team || "";

  return `
    <div class="timeline-event">
      <span class="timeline-event-minute">${escapeHtml(formatEventMinute(event.minute))}</span>
      <div>
        <strong class="timeline-event-team">
          ${renderTeamFlag(teamName)}
          <span>${escapeHtml(eventTypeLabel(event.type))} · ${escapeHtml(teamDisplayName(teamName))}</span>
        </strong>
        <p class="timeline-player-name">${escapeHtml(formatPlayerDisplayName(event.player, teamName))}</p>
      </div>
    </div>
  `;
}

function renderGroupStage(groups, options = {}) {
  if (!groups.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noGroupStageData)}</div>`;
  }

  return groups.map((group) => renderGroupCard(group, options)).join("");
}

function renderGroupCard(group, options = {}) {
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
        ${matches.map((match) => renderGroupFixture(match, options)).join("")}
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

function renderGroupFixture(match, options = {}) {
  const matchId = String(match.id);
  const hasMomentFilter = options.momentMatchIds instanceof Set;
  const hasMoments = hasMomentFilter && options.momentMatchIds.has(matchId);
  const isInteractive = options.interactiveMatchIds instanceof Set && options.interactiveMatchIds.has(matchId);
  const isSelected = String(options.selectedMatchId || "") === matchId;
  const tag = isInteractive ? "button" : "article";
  const attrs = isInteractive
    ? ` type="button" data-moments-match-id="${escapeAttribute(match.id)}" aria-label="${escapeAttribute(formatTemplate(worldcupText.moments.expandMatchAriaLabel, { match: formatMatchTitle(match) }))}"`
    : "";
  const className = [
    "group-fixture",
    hasMomentFilter ? "moments-group-fixture" : "",
    hasMoments ? "has-moments" : hasMomentFilter ? "is-muted" : "",
    isInteractive ? "is-interactive" : "",
    isSelected ? "is-selected" : ""
  ].filter(Boolean).join(" ");

  return `
    <${tag} class="${escapeAttribute(className)}"${attrs}>
      <span>${escapeHtml(formatKickoffDateTime(match.kickoffTime))}</span>
      <div>
        <strong>${renderTeamFlag(match.home.name)}<span>${escapeHtml(teamDisplayName(match.home.name))}</span></strong>
        <small>${escapeHtml(formatMatchScore(match))}</small>
        <strong>${renderTeamFlag(match.away.name)}<span>${escapeHtml(teamDisplayName(match.away.name))}</span></strong>
      </div>
    </${tag}>
  `;
}

function renderBracket(knockout, groupStage = [], options = {}) {
  if (!knockout.length) {
    return `<div class="empty-state">${escapeHtml(runtimeText.states.noBracketData)}</div>`;
  }

  const model = buildPosterBracketModel(knockout);

  return `
    <svg class="bracket-lines" data-bracket-lines aria-hidden="true"></svg>
    <div class="bracket-poster" data-bracket-poster>
      <div class="bracket-poster-label bracket-poster-label-top">${escapeHtml(stageLabel("Round of 32"))}</div>
      <div class="bracket-poster-label bracket-poster-label-center">${escapeHtml(stageLabel("Final"))}</div>
      <div class="bracket-poster-label bracket-poster-label-bottom">${escapeHtml(stageLabel("Round of 32"))}</div>
      ${model.nodes.map((node) => renderPosterBracketMatch(node, options, model.context)).join("")}
    </div>
  `;
}

function buildPosterBracketModel(knockout) {
  const finalMatch = knockout.find((match) => match.round === "Final");
  const matchMap = new Map(knockout.map((match) => [String(match.id), match]));
  const context = {
    matchMap,
    roundIndex: buildBracketRoundIndexMap(knockout)
  };
  const sourcesByTarget = buildBracketSourcesByTarget(knockout);
  const nodes = [];
  const seen = new Set();

  const addBranch = (match, half, leafStart, leafSpan) => {
    if (!match) {
      return;
    }

    const matchId = String(match.id);
    const placement = posterBranchPlacement(match, half, leafStart, leafSpan);

    if (!seen.has(matchId)) {
      nodes.push({
        match,
        placement,
        kind: "branch"
      });
      seen.add(matchId);
    }

    const sources = readPosterSourceMatches(match, sourcesByTarget);
    const childSpan = sources.length ? leafSpan / sources.length : 0;

    sources.forEach((source, index) => {
      addBranch(source, half, leafStart + childSpan * index, childSpan);
    });
  };

  const finalSources = finalMatch ? readPosterSourceMatches(finalMatch, sourcesByTarget).slice(0, 2) : [];

  if (finalSources.length >= 2) {
    addBranch(finalSources[0], "top", 0, 8);
    addBranch(finalSources[1], "bottom", 0, 8);
  } else {
    addFallbackPosterBranches(knockout, nodes, seen);
  }

  if (finalMatch) {
    nodes.push({
      match: finalMatch,
      placement: {
        x: 50,
        y: 50,
        width: 21,
        depth: 4,
        half: "center"
      },
      kind: "final"
    });
  }

  normalizePosterNodeColumns(nodes);

  return {
    context,
    nodes: nodes.sort((nodeA, nodeB) => nodeA.placement.y - nodeB.placement.y || nodeA.placement.x - nodeB.placement.x)
  };
}

function buildBracketSourcesByTarget(knockout) {
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

  return sourcesByTarget;
}

function readPosterSourceMatches(match, sourcesByTarget) {
  return [...(sourcesByTarget.get(String(match.id)) || [])]
    .filter((source) => source.round !== "Match for third place")
    .sort((sourceA, sourceB) => sourceSideOrder(sourceA, match) - sourceSideOrder(sourceB, match) || compareMatchIds(sourceA, sourceB));
}

function posterBranchPlacement(match, half, leafStart, leafSpan) {
  const depth = posterRoundDepth(match.round);
  const leafCenter = leafStart + leafSpan / 2;

  if (depth === 0) {
    return {
      x: posterRoundX(leafCenter),
      y: posterRoundY(depth, half),
      width: posterRoundWidth(depth),
      depth,
      half
    };
  }

  const x = posterRoundX(leafCenter);

  return {
    x,
    y: posterRoundY(depth, half),
    width: posterRoundWidth(depth),
    depth,
    half
  };
}

function posterRoundX(leafCenter) {
  return 6 + (leafCenter / 8) * 88;
}

function normalizePosterNodeColumns(nodes) {
  const fixedColumns = new Map([
    [0, [9, 21, 33, 45, 55, 67, 79, 91]],
    [1, [15, 39, 61, 85]],
    [2, [27, 73]],
    [3, [50]]
  ]);
  const groups = new Map();

  for (const node of nodes) {
    const { placement } = node;

    if (!placement || placement.half === "center" || !Number.isFinite(placement.depth)) {
      continue;
    }

    const key = `${placement.half}:${placement.depth}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(node);
  }

  for (const groupedNodes of groups.values()) {
    groupedNodes.sort((nodeA, nodeB) => nodeA.placement.x - nodeB.placement.x);

    const depth = groupedNodes[0]?.placement.depth;
    const columns = fixedColumns.get(depth);

    groupedNodes.forEach((node, index) => {
      node.placement.x = columns?.[index] ?? ((index + .5) / groupedNodes.length) * 100;
    });
  }
}

function posterRoundDepth(round) {
  if (round === "Round of 16") {
    return 1;
  }

  if (round === "Quarter-final" || round === "Quarterfinal") {
    return 2;
  }

  if (round === "Semi-final" || round === "Semifinal") {
    return 3;
  }

  if (round === "Final" || round === "Finals") {
    return 4;
  }

  return 0;
}

function posterRoundY(depth, half) {
  const topRows = [7.2, 20.2, 33.4, 39.2, 50];
  const bottomRows = [92.8, 79.8, 66.6, 60.8, 50];
  const rows = half === "bottom" ? bottomRows : topRows;

  return rows[Math.min(depth, rows.length - 1)];
}

function posterRoundWidth(depth) {
  const widths = [8.2, 18, 15.4, 21.6, 20];

  return widths[Math.min(depth, widths.length - 1)];
}

function addFallbackPosterBranches(knockout, nodes, seen) {
  const rounds = buildBracketColumns(knockout).filter((column) => column.round !== "Finals");
  const upperHalfCut = Math.ceil(rounds.length / 2);

  rounds.forEach((column, roundIndex) => {
    const depth = posterRoundDepth(column.round);
    const half = roundIndex < upperHalfCut ? "top" : "bottom";
    const matches = column.matches || [];
    const denominator = Math.max(1, matches.length);

    matches.forEach(({ match }, index) => {
      const matchId = String(match.id);

      if (seen.has(matchId) || match.round === "Final" || match.round === "Match for third place") {
        return;
      }

      nodes.push({
        match,
        placement: {
          x: ((index + .5) / denominator) * 100,
          y: posterRoundY(depth, half),
          width: posterRoundWidth(depth),
          depth,
          half
        },
        kind: "branch"
      });
      seen.add(matchId);
    });
  });
}

function renderPosterBracketMatch(node, options = {}, context = {}) {
  const { match, placement, kind } = node;
  const momentAttrs = renderMomentMatchAttrs(match, options);
  const momentClass = renderMomentMatchClass(match, options);
  const classes = [
    "bracket-match",
    "bracket-poster-match",
    kind === "final" ? "bracket-final-match" : "",
    kind === "third" ? "bracket-result-match bracket-third-place-match" : "",
    momentClass,
    `status-${String(match.status || "").toLowerCase()}`
  ].filter(Boolean).join(" ");

  return `
    <article class="${classes}" style="--x: ${placement.x.toFixed(3)}; --y: ${placement.y.toFixed(3)}; --w: ${placement.width.toFixed(3)}%;" data-match-id="${escapeAttribute(match.id)}" data-bracket-round="${escapeAttribute(match.round)}" data-bracket-half="${escapeAttribute(placement.half)}" data-bracket-depth="${escapeAttribute(String(placement.depth))}" data-next-match-id="${escapeAttribute(match.nextMatchId || "")}" data-next-match-ids="${escapeAttribute((match.nextMatchIds || []).join(","))}"${momentAttrs}>
      <div class="bracket-tree-pair">
        ${renderPosterTeamSlot(match, "home", context)}
        ${renderPosterMatchMeta(match, kind, context)}
        ${renderPosterTeamSlot(match, "away", context)}
      </div>
      ${kind === "final" ? renderPosterChampionLine(match) : ""}
    </article>
  `;
}

function renderPosterTeamSlot(match, side, context = {}) {
  const participant = formatBracketParticipant(match[side], context);
  const winnerClass = match.winner && match.winner === match[side] ? " is-winner" : "";
  const placeholderClass = participant.isPlaceholder ? " is-placeholder" : "";

  return `
    <span class="bracket-tree-team bracket-tree-team-${side}${winnerClass}${placeholderClass}" data-bracket-participant-team="${escapeAttribute(match[side])}">
      ${participant.flagName ? renderTeamFlag(participant.flagName) : `<i class="bracket-team-placeholder" aria-hidden="true"></i>`}
      <b>${escapeHtml(participant.label)}</b>
    </span>
  `;
}

function renderPosterMatchMeta(match, kind, context = {}) {
  const isPlayed = isFinished(match.status) || isLive(match.status);
  const date = isPlayed ? "" : formatPosterKickoffDate(match.kickoffTime) || posterRoundFallbackDate(match, context);
  const score = isPlayed
    ? formatMatchScore(match).replace(":", "-")
    : kind === "final" ? "VS" : date;
  const secondaryDate = !isPlayed && kind === "final" ? date : "";

  if (!score) {
    return `<span class="bracket-tree-meta is-empty" aria-hidden="true"></span>`;
  }

  return `
    <span class="bracket-tree-meta">
      <b>${escapeHtml(score)}</b>
      ${secondaryDate ? `<small>${escapeHtml(secondaryDate)}</small>` : ""}
    </span>
  `;
}

function posterRoundFallbackDate(match, context = {}) {
  const round = String(match.round || "");
  const index = context.roundIndex?.get?.(String(match.id)) || 0;

  if (round === "Quarter-final" || round === "Quarterfinal") {
    return ["07/10", "07/11", "07/12", "07/12"][index - 1] || "";
  }

  if (round === "Semi-final" || round === "Semifinal") {
    return ["07/15", "07/16"][index - 1] || "";
  }

  if (round === "Final" || round === "Finals") {
    return "07/20";
  }

  return "";
}

function formatPosterKickoffDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function renderPosterChampionLine(match) {
  const champion = match.winner || "";

  if (!champion || !isFinished(match.status)) {
    return "";
  }

  return `
    <div class="bracket-final-champion">
      ${renderTeamFlag(champion)}
      <b>${escapeHtml(teamDisplayName(champion))}</b>
    </div>
  `;
}

function buildBracketRoundIndexMap(knockout) {
  const index = new Map();
  const orderedMatches = buildOrderedBracketMatches(knockout);

  for (const round of orderBracketRounds([...new Set(knockout.map((match) => match.round))])) {
    const matches = (orderedMatches.get(round) || knockout.filter((match) => match.round === round))
      .sort(compareMatchIds);

    matches.forEach((match, matchIndex) => {
      index.set(String(match.id), matchIndex + 1);
    });
  }

  return index;
}

function buildBracketColumns(knockout) {
  const columns = [];
  const orderedRounds = orderBracketRounds([...new Set(knockout.map((match) => match.round))]);
  const orderedMatches = buildOrderedBracketMatches(knockout);
  const finalMatches = [];

  for (const round of orderedRounds) {
    const matches = (orderedMatches.get(round) || knockout.filter((match) => match.round === round))
      .map((match, index) => ({ match, index }));

    if (round === "Final") {
      finalMatches.push(...matches);
      continue;
    }

    if (round === "Match for third place") {
      continue;
    }

    columns.push({
      round,
      label: round,
      matches
    });
  }

  if (finalMatches.length) {
    columns.push({
      round: "Finals",
      label: "Finals",
      matches: finalMatches
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

function renderChampionColumn(knockout, options = {}) {
  const finalMatch = knockout.find((match) => match.round === "Final");
  const thirdPlaceMatch = knockout.find((match) => match.round === "Match for third place");
  const champion = finalMatch?.winner || "";
  const logoSrc = withBasePath(worldcupText.champion.logoSrc);

  return `
    <section class="bracket-champion-column" data-round="Champion">
      <h3>${escapeHtml(worldcupText.champion.slotTitle)}</h3>
      <div class="bracket-champion-track">
        <article class="bracket-champion-card" data-champion-slot>
          <img class="bracket-worldcup-logo" src="${escapeAttribute(logoSrc)}" alt="${escapeAttribute(worldcupText.champion.logoAlt)}" loading="lazy" decoding="async" />
          <div>
            ${champion ? renderTeamFlag(champion) : ""}
            <strong>${escapeHtml(champion ? teamDisplayName(champion) : runtimeText.states.defaultTeam)}</strong>
          </div>
        </article>
        ${thirdPlaceMatch ? renderBracketResultMatch(thirdPlaceMatch, thirdPlaceMatch.round, options) : ""}
      </div>
    </section>
  `;
}

function renderBracketResultMatch(match, round, options = {}) {
  const momentAttrs = renderMomentMatchAttrs(match, options);
  const momentClass = renderMomentMatchClass(match, options);

  return `
    <article class="bracket-match bracket-result-match bracket-third-place-match ${momentClass} status-${escapeAttribute(match.status.toLowerCase())}" style="--slot: 21; --span: 5;" data-match-id="${escapeAttribute(match.id)}" data-bracket-round="${escapeAttribute(round)}"${momentAttrs}>
      <span class="bracket-result-kicker">${escapeHtml(stageLabel(round))}</span>
      ${renderBracketTeamRow(match, round, "home")}
      ${renderBracketTeamRow(match, round, "away")}
    </article>
  `;
}

function renderBracketMatch(match, round, index, options = {}) {
  const advanceText = match.nextMatchId
    ? formatTemplate(runtimeText.states.advanceTemplate, { nextMatchId: match.nextMatchId })
    : "";
  const placement = bracketPlacement(round, index);
  const momentAttrs = renderMomentMatchAttrs(match, options);
  const momentClass = renderMomentMatchClass(match, options);

  return `
    <article class="bracket-match ${momentClass} status-${escapeAttribute(match.status.toLowerCase())}" style="--slot: ${placement.slot}; --span: ${placement.span};" data-match-id="${escapeAttribute(match.id)}" data-bracket-round="${escapeAttribute(round)}" data-next-match-id="${escapeAttribute(match.nextMatchId || "")}" data-next-match-ids="${escapeAttribute((match.nextMatchIds || []).join(","))}"${momentAttrs}>
      ${renderBracketTeamRow(match, round, "home")}
      ${renderBracketTeamRow(match, round, "away")}
      <small>${escapeHtml(statusLabel(match.status))}${advanceText ? ` · ${escapeHtml(advanceText)}` : ""}</small>
    </article>
  `;
}

function renderMomentMatchAttrs(match, options = {}) {
  const canOpen = options.interactiveMatchIds instanceof Set
    ? options.interactiveMatchIds.has(String(match.id))
    : options.momentMatchIds instanceof Set && options.momentMatchIds.has(String(match.id));

  if (!options.interactiveMoments || !canOpen) {
    return "";
  }

  return ` data-moments-match-id="${escapeAttribute(match.id)}" role="button" tabindex="0" aria-label="${escapeAttribute(formatTemplate(worldcupText.moments.expandMatchAriaLabel, { match: formatBracketMatchTitle(match) }))}"`;
}

function renderMomentMatchClass(match, options = {}) {
  if (!options.interactiveMoments || !(options.momentMatchIds instanceof Set)) {
    return "";
  }

  const hasMoments = options.momentMatchIds.has(String(match.id));
  const isInteractive = options.interactiveMatchIds instanceof Set && options.interactiveMatchIds.has(String(match.id));
  const selected = String(options.selectedMatchId || "") === String(match.id);

  return [
    hasMoments ? "has-moments" : "is-muted",
    isInteractive ? "is-interactive" : "",
    selected ? "is-selected" : ""
  ].filter(Boolean).join(" ");
}

function renderBracketTeamRow(match, round, side, options = {}) {
  const team = match[side];
  const score = side === "home" ? match.homeScore : match.awayScore;
  const participant = formatBracketParticipant(team, options.bracketContext);
  const placementLabel = participant.isPlaceholder ? "" : bracketPlacementLabel(match, round, team);

  return `
    <div class="bracket-row ${match.winner === team ? "winner" : ""} ${placementLabel ? "has-placement-badge" : ""} ${participant.isPlaceholder ? "is-placeholder" : ""}">
      <span data-bracket-participant-team="${escapeAttribute(team)}">
        ${participant.flagName ? renderTeamFlag(participant.flagName) : ""}
        <b>${escapeHtml(participant.label)}</b>
        ${placementLabel ? `<em class="bracket-placement-badge">${escapeHtml(placementLabel)}</em>` : ""}
      </span>
      <strong>${escapeHtml(formatSideScore(match, side, { score }))}</strong>
    </div>
  `;
}

function formatBracketParticipant(team, context = {}) {
  const rawTeam = String(team || "").trim();
  const placeholder = rawTeam.match(/^([WL])(.+)$/);

  if (!placeholder || !context?.matchMap) {
    return {
      flagName: placeholder ? "" : rawTeam,
      isPlaceholder: Boolean(placeholder),
      label: placeholder ? runtimeText.states.defaultTeam : teamDisplayName(team)
    };
  }

  const [, resultType, sourceId] = placeholder;
  const sourceMatch = context.matchMap.get(String(sourceId));

  if (!sourceMatch) {
    return {
      flagName: "",
      isPlaceholder: true,
      label: rawTeam || runtimeText.states.defaultTeam
    };
  }

  const resolvedTeam = resolveBracketSourceTeam(resultType, sourceMatch);

  if (resolvedTeam) {
    return {
      flagName: resolvedTeam,
      isPlaceholder: false,
      label: teamDisplayName(resolvedTeam)
    };
  }

  if (!isBracketPlaceholder(sourceMatch.home) && !isBracketPlaceholder(sourceMatch.away)) {
    return {
      flagName: "",
      isPlaceholder: true,
      label: `${teamDisplayName(sourceMatch.home)}/${teamDisplayName(sourceMatch.away)}`
    };
  }

  return {
    flagName: "",
    isPlaceholder: true,
    label: runtimeText.states.defaultTeam
  };
}

function resolveBracketSourceTeam(resultType, sourceMatch) {
  const winner = sourceMatch?.winner || "";

  if (!winner) {
    return "";
  }

  if (resultType === "W") {
    return winner;
  }

  if (sourceMatch.home === winner) {
    return sourceMatch.away;
  }

  if (sourceMatch.away === winner) {
    return sourceMatch.home;
  }

  return "";
}

function isBracketPlaceholder(value) {
  return /^([WL])\d+$/.test(String(value || "").trim());
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

  syncBracketPosterScale(container);

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

function syncBracketPosterScale(container) {
  const poster = container?.querySelector?.("[data-bracket-poster]");

  if (!container || !poster) {
    return;
  }

  const styles = window.getComputedStyle(container);
  const designWidth = Number.parseFloat(styles.getPropertyValue("--bracket-design-width")) || 960;
  const minScale = Number.parseFloat(styles.getPropertyValue("--bracket-min-scale")) || .58;
  const maxScale = Number.parseFloat(styles.getPropertyValue("--bracket-max-scale")) || 1;
  const paddingInline = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
  const availableWidth = Math.max(1, container.clientWidth - paddingInline);
  const nextScale = Math.min(maxScale, Math.max(minScale, availableWidth / designWidth));

  container.style.setProperty("--bracket-scale", nextScale.toFixed(4));

  const isScrollLocked = styles.overflowX === "hidden";
  const hasHorizontalOverflow = container.scrollWidth > container.clientWidth + 2;

  if (isScrollLocked || !hasHorizontalOverflow) {
    container.scrollLeft = 0;
    delete container.dataset.bracketScrollCentered;
    return;
  }

  if (container.dataset.bracketScrollCentered !== "true") {
    container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
    container.dataset.bracketScrollCentered = "true";
  }
}

function buildKnockoutPaths(container, containerRect) {
  const paths = [];
  const matches = [...container.querySelectorAll("[data-match-id]")];
  const isPoster = Boolean(container.querySelector("[data-bracket-poster]"));

  if (isPoster) {
    return buildPosterKnockoutPaths(container, containerRect, matches);
  }

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

      const fromPoint = isPoster
        ? pointBetweenBracketRects(match.getBoundingClientRect(), target.getBoundingClientRect(), containerRect, container, "from")
        : pointFromRect(match.getBoundingClientRect(), containerRect, "right", container);
      const toPoint = isPoster
        ? pointBetweenBracketRects(match.getBoundingClientRect(), target.getBoundingClientRect(), containerRect, container, "to")
        : pointFromRect(target.getBoundingClientRect(), containerRect, "left", container);

      paths.push(renderBracketPath(
        fromPoint,
        toPoint,
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

function buildPosterKnockoutPaths(container, containerRect, matches) {
  const paths = [];
  const poster = container.querySelector("[data-bracket-poster]");
  const posterRect = poster?.getBoundingClientRect();
  const matchesById = new Map(matches.map((match) => [String(match.dataset.matchId), match]));
  const sourcesByTarget = new Map();

  if (!poster || !posterRect) {
    return paths;
  }

  for (const match of matches) {
    const nextIds = String(match.dataset.nextMatchIds || match.dataset.nextMatchId || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    for (const nextId of nextIds) {
      const target = matchesById.get(nextId);

      if (!target || target.dataset.bracketRound === "Match for third place") {
        continue;
      }

      const sourceDepth = Number.parseInt(match.dataset.bracketDepth || "", 10);
      const targetDepth = Number.parseInt(target.dataset.bracketDepth || "", 10);

      if (Number.isFinite(sourceDepth) && Number.isFinite(targetDepth) && targetDepth !== sourceDepth + 1) {
        continue;
      }

      if (!sourcesByTarget.has(nextId)) {
        sourcesByTarget.set(nextId, []);
      }

      sourcesByTarget.get(nextId).push(match);
    }
  }

  for (const [targetId, sources] of sourcesByTarget.entries()) {
    const target = matchesById.get(targetId);

    if (!target) {
      continue;
    }

    const targetPoint = posterPointFromMatch(target, posterRect, containerRect, container);
    const sourcePoints = sources
      .map((source) => posterPointFromMatch(source, posterRect, containerRect, container))
      .sort((pointA, pointB) => pointA.y - pointB.y || pointA.x - pointB.x);

    if (sourcePoints.length >= 2) {
      paths.push(renderPosterMergedBracketPath(sourcePoints[0], sourcePoints[1], targetPoint, "knockout"));
    } else if (sourcePoints.length === 1) {
      paths.push(renderPosterBracketPath(sourcePoints[0], targetPoint, "knockout"));
    }
  }

  return paths;
}

function pointFromRect(rect, containerRect, side, container) {
  const scrollLeft = container?.scrollLeft || 0;
  const scrollTop = container?.scrollTop || 0;
  const x = rect.left - containerRect.left + scrollLeft;
  const y = rect.top - containerRect.top + scrollTop;

  if (side === "top" || side === "bottom") {
    return {
      x: x + rect.width / 2,
      y: y + (side === "bottom" ? rect.height : 0)
    };
  }

  return {
    x: x + (side === "left" ? 0 : rect.width),
    y: y + rect.height / 2
  };
}

function pointBetweenBracketRects(fromRect, toRect, containerRect, container, role) {
  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2
  };
  const verticalTravel = Math.abs(toCenter.y - fromCenter.y) >= Math.abs(toCenter.x - fromCenter.x) * .62;

  if (verticalTravel) {
    const targetIsLower = toCenter.y >= fromCenter.y;
    const fromSide = targetIsLower ? "bottom" : "top";
    const toSide = targetIsLower ? "top" : "bottom";

    return role === "from"
      ? pointFromRect(fromRect, containerRect, fromSide, container)
      : pointFromRect(toRect, containerRect, toSide, container);
  }

  const targetIsRight = toCenter.x >= fromCenter.x;
  const fromSide = targetIsRight ? "right" : "left";
  const toSide = targetIsRight ? "left" : "right";

  return role === "from"
    ? pointFromRect(fromRect, containerRect, fromSide, container)
    : pointFromRect(toRect, containerRect, toSide, container);
}

function posterPointFromMatch(match, posterRect, containerRect, container) {
  const scrollLeft = container?.scrollLeft || 0;
  const scrollTop = container?.scrollTop || 0;
  const x = Number.parseFloat(match.style.getPropertyValue("--x")) || 50;
  const y = Number.parseFloat(match.style.getPropertyValue("--y")) || 50;
  const depth = Number.parseInt(match.dataset.bracketDepth || "", 10);
  const half = match.dataset.bracketHalf || "";
  const leafOffset = depth === 0
    ? (half === "bottom" ? -10 : 10)
    : 0;

  return {
    x: posterRect.left - containerRect.left + scrollLeft + posterRect.width * x / 100,
    y: posterRect.top - containerRect.top + scrollTop + posterRect.height * y / 100 + leafOffset
  };
}

function renderPosterBracketPath(from, to, kind) {
  const midY = from.y + (to.y - from.y) * .5;
  const d = [
    `M ${from.x.toFixed(1)} ${from.y.toFixed(1)}`,
    `V ${midY.toFixed(1)}`,
    `H ${to.x.toFixed(1)}`,
    `V ${to.y.toFixed(1)}`
  ].join(" ");

  return `<path class="bracket-line bracket-line-${kind}" d="${d}" />`;
}

function renderPosterMergedBracketPath(sourceA, sourceB, target, kind) {
  if (Math.abs(sourceA.x - sourceB.x) < 1) {
    const d = [
      `M ${sourceA.x.toFixed(1)} ${sourceA.y.toFixed(1)}`,
      `V ${sourceB.y.toFixed(1)}`,
      `V ${target.y.toFixed(1)}`
    ].join(" ");

    return `<path class="bracket-line bracket-line-${kind}" d="${d}" />`;
  }

  if (Math.abs(sourceA.y - sourceB.y) > Math.abs(target.y - (sourceA.y + sourceB.y) / 2) * .5) {
    const d = [
      `M ${sourceA.x.toFixed(1)} ${sourceA.y.toFixed(1)}`,
      `V ${target.y.toFixed(1)}`,
      `M ${sourceB.x.toFixed(1)} ${sourceB.y.toFixed(1)}`,
      `V ${target.y.toFixed(1)}`
    ].join(" ");

    return `<path class="bracket-line bracket-line-${kind}" d="${d}" />`;
  }

  const joinY = sourceA.y + (target.y - sourceA.y) * .58;
  const midX = (sourceA.x + sourceB.x) / 2;
  const d = [
    `M ${sourceA.x.toFixed(1)} ${sourceA.y.toFixed(1)}`,
    `V ${joinY.toFixed(1)}`,
    `H ${sourceB.x.toFixed(1)}`,
    `V ${sourceB.y.toFixed(1)}`,
    `M ${midX.toFixed(1)} ${joinY.toFixed(1)}`,
    `V ${target.y.toFixed(1)}`
  ].join(" ");

  return `<path class="bracket-line bracket-line-${kind}" d="${d}" />`;
}

function renderBracketPath(from, to, kind) {
  if (Math.abs(to.y - from.y) > Math.abs(to.x - from.x) * .72) {
    const midY = from.y + (to.y - from.y) * .5;
    const d = [
      `M ${from.x.toFixed(1)} ${from.y.toFixed(1)}`,
      `V ${midY.toFixed(1)}`,
      `H ${to.x.toFixed(1)}`,
      `V ${to.y.toFixed(1)}`
    ].join(" ");

    return `<path class="bracket-line bracket-line-${kind}" d="${d}" />`;
  }

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
  let suppressClickAfterDrag = false;
  let suppressClickTimer = 0;

  const isInteractiveTarget = (target) => Boolean(target?.closest?.("[data-moments-match-id]"));

  const clearSuppressedClick = () => {
    suppressClickAfterDrag = false;
    hasMoved = false;
    container.dataset.suppressClick = "";
    window.clearTimeout(suppressClickTimer);
  };

  const stopDragging = () => {
    if (isDragging && hasMoved) {
      suppressClickAfterDrag = true;
      container.dataset.suppressClick = "true";
      window.clearTimeout(suppressClickTimer);
      suppressClickTimer = window.setTimeout(clearSuppressedClick, 120);
    }

    isDragging = false;
    container.classList.remove("is-dragging");
  };

  container.addEventListener("pointerdown", (event) => {
    clearSuppressedClick();

    if (isInteractiveTarget(event.target)) {
      return;
    }

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
    if (!suppressClickAfterDrag && !hasMoved) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    clearSuppressedClick();
  }, true);
}

function setupHorizontalMomentumScroller(container) {
  if (!container || container.dataset.momentumReady === "true") {
    return;
  }

  container.dataset.momentumReady = "true";

  let state = null;
  let frame = 0;
  let suppressClickTimer = 0;

  const maxScrollLeft = () => Math.max(0, container.scrollWidth - container.clientWidth);
  const clampLeft = (value) => Math.max(0, Math.min(maxScrollLeft(), value));
  const isInteractiveTarget = (target) => Boolean(target?.closest?.("[data-moments-match-id]"));
  const clearSuppressedClick = () => {
    container.dataset.suppressClick = "";
    window.clearTimeout(suppressClickTimer);
  };
  const stopInertia = () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    container.classList.remove("is-gliding");
  };
  const resetState = () => {
    state = null;
    container.classList.remove("is-dragging");
  };
  const releasePointer = (event) => {
    try {
      container.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be gone after a browser-canceled gesture.
    }
  };

  container.addEventListener("pointerdown", (event) => {
    clearSuppressedClick();

    if (event.pointerType !== "touch" && isInteractiveTarget(event.target)) {
      return;
    }

    if (event.button > 0 || maxScrollLeft() <= 0) {
      return;
    }

    stopInertia();
    state = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: container.scrollLeft,
      lastX: event.clientX,
      lastTime: performance.now(),
      locked: event.pointerType !== "touch",
      moved: false,
      velocity: 0,
      samples: [{ time: performance.now(), x: event.clientX }]
    };

    if (state.locked) {
      container.classList.add("is-dragging");
      container.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
  });

  container.addEventListener("pointermove", (event) => {
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (!state.locked) {
      if (Math.abs(deltaX) < 7 && Math.abs(deltaY) < 7) {
        return;
      }

      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        resetState();
        return;
      }

      state.locked = true;
      container.classList.add("is-dragging");
      container.setPointerCapture?.(event.pointerId);
    }

    const now = performance.now();
    const deltaTime = Math.max(1, now - state.lastTime);
    const nextVelocity = (state.lastX - event.clientX) / deltaTime;

    container.scrollLeft = clampLeft(state.startLeft - deltaX);
    state.moved = state.moved || Math.abs(deltaX) > 4;
    state.velocity = state.velocity * .58 + nextVelocity * .42;
    state.lastX = event.clientX;
    state.lastTime = now;
    state.samples.push({ time: now, x: event.clientX });
    state.samples = state.samples.filter((sample) => now - sample.time <= 140);
    event.preventDefault();
  });

  const endDrag = (event) => {
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    const endedState = state;
    releasePointer(event);
    resetState();

    if (!endedState.locked) {
      return;
    }

    if (endedState.moved) {
      container.dataset.suppressClick = "true";
      window.clearTimeout(suppressClickTimer);
      suppressClickTimer = window.setTimeout(clearSuppressedClick, 140);
    }

    const releaseVelocity = calculateHorizontalReleaseVelocity(endedState);

    if (Math.abs(releaseVelocity) > .018) {
      startHorizontalInertia(container, releaseVelocity, clampLeft, () => {
        frame = 0;
      }, (nextFrame) => {
        frame = nextFrame;
      });
    }
  };

  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);
  container.addEventListener("lostpointercapture", endDrag);
  container.addEventListener("click", (event) => {
    if (container.dataset.suppressClick !== "true") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    clearSuppressedClick();
  }, true);
}

function calculateHorizontalReleaseVelocity(state) {
  const samples = state.samples || [];

  if (samples.length < 2) {
    return state.velocity;
  }

  const newestSample = samples[samples.length - 1];
  const oldestSample = samples[0];
  const deltaTime = Math.max(1, newestSample.time - oldestSample.time);
  const sampledVelocity = (oldestSample.x - newestSample.x) / deltaTime;

  return sampledVelocity * .74 + state.velocity * .26;
}

function startHorizontalInertia(container, velocity, clampLeft, clearFrame, writeFrame) {
  const speed = Math.min(Math.abs(velocity), 3);
  const direction = Math.sign(velocity);
  const distance = direction * Math.min(
    Math.max(speed * 1500, 180),
    container.clientWidth * 2.4
  );
  const duration = Math.min(1350, Math.max(520, 460 + speed * 360));
  const startLeft = clampLeft(container.scrollLeft);
  const targetLeft = clampLeft(startLeft + distance);
  const clampedDistance = targetLeft - startLeft;
  const startedAt = performance.now();

  if (Math.abs(clampedDistance) < 1) {
    clearFrame();
    return;
  }

  container.scrollLeft = startLeft;
  container.classList.add("is-gliding");

  const step = (time) => {
    const progress = Math.min(1, (time - startedAt) / duration);
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    container.scrollLeft = clampLeft(startLeft + clampedDistance * easedProgress);

    if (progress >= 1) {
      container.classList.remove("is-gliding");
      clearFrame();
      return;
    }

    writeFrame(window.requestAnimationFrame(step));
  };

  writeFrame(window.requestAnimationFrame(step));
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

function renderHeroTeamCode(team) {
  if (!shouldShowTeamCode(team)) {
    return "";
  }

  return `<span>${escapeHtml(team.code)}</span>`;
}

function renderMiniTeamCode(team) {
  if (!shouldShowTeamCode(team)) {
    return "";
  }

  return `<strong>${escapeHtml(team.code)}</strong>`;
}

function shouldShowTeamCode(team) {
  const code = String(team?.code || "").trim();
  const name = String(team?.name || "").trim();

  return Boolean(code)
    && !isPlaceholderParticipant(name)
    && code !== name
    && code !== teamDisplayName(name);
}

function renderFlagWash(team, side) {
  const url = teamFlagUrl(team);

  if (!url) {
    return "";
  }

  return `<div class="flag-wash flag-${escapeAttribute(side)}" style="--flag-url: url('${escapeAttribute(url)}')"></div>`;
}

function renderTeamImage(team) {
  const url = teamFlagUrl(team);

  if (!url) {
    return "";
  }

  return `<img src="${escapeAttribute(url)}" alt="" loading="lazy" />`;
}

function renderTeamFlag(name) {
  const url = teamFlagUrl(name);

  if (!url) {
    return "";
  }

  return `<img src="${escapeAttribute(url)}" alt="" loading="lazy" />`;
}

function teamFlagUrl(teamOrName) {
  const name = typeof teamOrName === "string" ? teamOrName : teamOrName?.name;

  if (isPlaceholderParticipant(name)) {
    return "";
  }

  const iso2 = TEAM_ISO2[name];

  if (iso2) {
    return flagUrl(iso2);
  }

  if (typeof teamOrName === "object" && teamOrName) {
    return teamOrName.flagUrl || teamOrName.logo || "";
  }

  return "";
}

function isPlaceholderParticipant(value) {
  const normalized = String(value || "").trim();
  return !normalized
    || /^(?:W|L)\d+$/i.test(normalized)
    || /^(?:TBD|To be determined)$/i.test(normalized)
    || normalized === runtimeText.states.defaultTeam
    || /^(?:Winner|Loser)\b/i.test(normalized);
}

function findGoal(nextData, previousData) {
  return getAllMatches(nextData)
    .map((match) => detectGoal(match, findPreviousMatch(previousData, match.id)))
    .find(Boolean);
}

function showGoal(goal, elements) {
  elements.goalTeam.textContent = teamDisplayName(goal.team.name);
  elements.goalPlayer.textContent = goal.player
    ? `${goal.minute}' · ${formatPlayerDisplayName(goal.player, goal.team?.name)}`
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

function isFinished(status) {
  return status === "FT" || status === "AET" || status === "PEN";
}

function scoreChanged(current, previous) {
  return previous !== undefined && Number(current ?? -1) !== Number(previous ?? -1);
}

function formatScore(score) {
  return score === null || score === undefined ? "–" : String(score);
}

function formatBaseScoreValue(score, status, options = {}) {
  if (options.unknownWhenNotStarted && status === "NS" && (score === null || score === undefined)) {
    return "?";
  }

  return formatScore(score);
}

function formatSideScore(match, side, options = {}) {
  const score = options.score !== undefined ? options.score : readSideScore(match, side);
  const baseScore = formatBaseScoreValue(score, match?.status, options);
  if (options.includePenalty === false) {
    return baseScore;
  }

  const penaltyScore = readPenaltyScore(match, side);

  return penaltyScore === null ? baseScore : `${baseScore}(${penaltyScore})`;
}

function formatMatchScore(match, options = {}) {
  return `${formatSideScore(match, "home", options)}:${formatSideScore(match, "away", options)}`;
}

function readSideScore(match, side) {
  if (!match || side !== "home" && side !== "away") {
    return null;
  }

  if (match[side] && typeof match[side] === "object" && "score" in match[side]) {
    return match[side].score;
  }

  return side === "home" ? match.homeScore : match.awayScore;
}

function readPenaltyScore(match, side) {
  const pair = readPenaltyScorePair(match);

  if (!pair || side !== "home" && side !== "away") {
    return null;
  }

  return pair[side];
}

function formatPenaltyScoreText(pair) {
  return formatTemplate(runtimeText.states.penaltyScoreTemplate, pair);
}

function readPenaltyScorePair(match) {
  if (!isPenaltyShootoutScoreVisible(match)) {
    return null;
  }

  const home = readPenaltyScoreValue(match, "home");
  const away = readPenaltyScoreValue(match, "away");

  if (!isExplicitScoreValue(home) || !isExplicitScoreValue(away)) {
    return null;
  }

  return {
    home: String(Number(home)),
    away: String(Number(away))
  };
}

function readPenaltyScoreValue(match, side) {
  const direct = side === "home" ? match.homePenaltyScore : match.awayPenaltyScore;

  if (isExplicitScoreValue(direct)) {
    return direct;
  }

  const source = match.penaltyScore || match.penalties || match.penalty || match.score?.penalty || match.score?.p;
  let value = null;

  if (Array.isArray(source)) {
    value = side === "home" ? source[0] : source[1];
  } else if (source && typeof source === "object") {
    value = side === "home"
      ? source.home ?? source.homeScore ?? source.team1
      : source.away ?? source.awayScore ?? source.team2;
  }

  return value;
}

function isPenaltyShootoutScoreVisible(match) {
  if (!match || !isKnockoutStageForPenalty(match)) {
    return false;
  }

  const homeScore = readSideScore(match, "home");
  const awayScore = readSideScore(match, "away");

  if (!isExplicitScoreValue(homeScore) || !isExplicitScoreValue(awayScore) || Number(homeScore) !== Number(awayScore)) {
    return false;
  }

  return hasPenaltyPair(match);
}

function hasPenaltyPair(match) {
  const homeDirect = match?.homePenaltyScore;
  const awayDirect = match?.awayPenaltyScore;

  if (isExplicitScoreValue(homeDirect) && isExplicitScoreValue(awayDirect)) {
    return true;
  }

  const source = match?.penaltyScore || match?.penalties || match?.penalty || match?.score?.penalty || match?.score?.p;

  if (Array.isArray(source)) {
    return isExplicitScoreValue(source[0]) && isExplicitScoreValue(source[1]);
  }

  if (!source || typeof source !== "object") {
    return false;
  }

  return isExplicitScoreValue(source.home ?? source.homeScore ?? source.team1)
    && isExplicitScoreValue(source.away ?? source.awayScore ?? source.team2);
}

function isKnockoutStageForPenalty(match) {
  const label = String(match.round || match.stage || "");
  return !isGroupStageMatch(match)
    && /Round of 32|Round of 16|Quarter|Semi|Final|third place/i.test(label);
}

function isExplicitScoreValue(value) {
  return value !== null
    && value !== undefined
    && value !== ""
    && Number.isFinite(Number(value));
}

function scoreLabel(match) {
  const baseLabel = `${teamDisplayName(match.home.name)} ${formatSideScore(match, "home", { includePenalty: false, unknownWhenNotStarted: true })}, ${teamDisplayName(match.away.name)} ${formatSideScore(match, "away", { includePenalty: false, unknownWhenNotStarted: true })}`;
  const penalties = readPenaltyScorePair(match);

  return penalties ? `${baseLabel}, ${formatPenaltyScoreText(penalties)}` : baseLabel;
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
  return simplifyChinese(TEAM_NAME_ZH[name] || name || runtimeText.states.defaultTeam);
}

function formatPlayerDisplayName(playerName, teamName = "") {
  const original = String(playerName || "").trim();

  if (!original) {
    return runtimeText.states.defaultGoalPlayer;
  }

  const mapped = findPlayerMapping(original, teamName);

  if (!mapped?.zhName || mapped.zhName === original) {
    return original;
  }

  return simplifyChinese(mapped.displayName || formatTemplate(worldcupText.moments.playerNameTemplate, {
    zh: mapped.zhName,
    original: mapped.originalName || original
  }));
}

function findPlayerMapping(playerName, teamName = "") {
  const exactCandidates = [
    playerName,
    teamName ? `${teamName}::${playerName}` : ""
  ].filter(Boolean);

  for (const candidate of exactCandidates) {
    const exact = playerNameIndex.exact.get(candidate);

    if (exact) {
      return exact;
    }
  }

  return playerNameIndex.normalized.get(normalizePlayerName(playerName)) || null;
}

function buildPlayerNameIndex(mapData, dataOverrides, textOverrides) {
  const index = {
    exact: new Map(),
    normalized: new Map()
  };

  for (const [key, entry] of Object.entries(mapData?.players || {})) {
    addPlayerMapping(index, key, entry);
  }

  for (const [key, entry] of Object.entries(dataOverrides?.players || {})) {
    addPlayerMapping(index, key, {
      ...mapData?.players?.[key],
      ...entry
    });
  }

  for (const [name, zhName] of Object.entries(textOverrides || {})) {
    addPlayerMapping(index, name, {
      aliases: [name],
      zhName,
      originalName: name
    });
  }

  return index;
}

function addPlayerMapping(index, key, entry) {
  const names = uniqueStrings([
    key,
    entry.playerName,
    entry.commonName,
    entry.originalName,
    entry.nameOnShirt,
    ...(entry.aliases || [])
  ]);
  const originalName = entry.originalName || entry.commonName || names[0] || key;
  const normalizedEntry = {
    ...entry,
    originalName,
    displayName: entry.displayName || (entry.zhName ? formatTemplate(worldcupText.moments.playerNameTemplate, {
      zh: entry.zhName,
      original: originalName
    }) : "")
  };

  for (const name of names) {
    index.exact.set(name, normalizedEntry);
    index.normalized.set(normalizePlayerName(name), normalizedEntry);

    if (entry.teamName) {
      index.exact.set(`${entry.teamName}::${name}`, normalizedEntry);
      index.normalized.set(normalizePlayerName(`${entry.teamName}::${name}`), normalizedEntry);
    }
  }
}

function normalizePlayerName(value) {
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

function formatMatchTitle(match) {
  return [
    teamDisplayName(match.home?.name),
    runtimeText.states.versus,
    teamDisplayName(match.away?.name)
  ].join(" ");
}

function formatBracketMatchTitle(match) {
  return [
    teamDisplayName(match.home),
    runtimeText.states.versus,
    teamDisplayName(match.away)
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
      if (sortMode === "matchTimeAsc") {
        return a.kickoffTime - b.kickoffTime;
      }

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

export async function loadPlayerNameData(matches = []) {
  const targetMatches = Array.isArray(matches) ? matches.filter(Boolean) : [matches].filter(Boolean);

  if (!targetMatches.length) {
    return playerNameIndex;
  }

  try {
    const manifest = await loadPlayerNameManifest();
    const teamCodes = getPlayerNameTeamCodes(targetMatches, manifest);

    await Promise.all(teamCodes.map((teamCode) => loadPlayerNameTeamShard(teamCode, manifest)));
  } catch {
    return playerNameIndex;
  }

  return playerNameIndex;
}

function loadPlayerNameManifest() {
  if (playerNameManifestPromise) {
    return playerNameManifestPromise;
  }

  playerNameManifestPromise = fetchJsonAsset(PLAYER_NAME_MANIFEST_ENDPOINT)
    .catch(() => null);

  return playerNameManifestPromise;
}

function getPlayerNameTeamCodes(matches, manifest) {
  const codes = new Set();

  for (const match of matches) {
    addPlayerNameTeamCode(codes, manifest, match?.home?.name || match?.home);
    addPlayerNameTeamCode(codes, manifest, match?.away?.name || match?.away);

    for (const event of match?.events || []) {
      addPlayerNameTeamCode(codes, manifest, event.teamName || event.team);
    }
  }

  return [...codes];
}

function addPlayerNameTeamCode(codes, manifest, teamName) {
  const code = resolvePlayerNameTeamCode(teamName, manifest);

  if (code) {
    codes.add(code);
  }
}

function resolvePlayerNameTeamCode(teamName, manifest) {
  const normalized = normalizePlayerNameTeam(teamName);

  if (!normalized || !manifest?.aliases) {
    return "";
  }

  return manifest.aliases[normalized] || "";
}

function normalizePlayerNameTeam(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadPlayerNameTeamShard(teamCode, manifest) {
  if (loadedPlayerNameTeams.has(teamCode)) {
    return Promise.resolve(playerNameIndex);
  }

  if (playerNameTeamPromises.has(teamCode)) {
    return playerNameTeamPromises.get(teamCode);
  }

  const file = manifest?.teams?.[teamCode]?.file;

  if (!file) {
    return Promise.resolve(playerNameIndex);
  }

  const promise = fetchJsonAsset(withBasePath(`/data/worldcup/player-names/${file}`))
    .then((teamData) => {
      mergePlayerNameData(playerNameIndex, teamData);
      loadedPlayerNameTeams.add(teamCode);
      return playerNameIndex;
    })
    .catch(() => playerNameIndex);

  playerNameTeamPromises.set(teamCode, promise);
  return promise;
}

function mergePlayerNameData(index, mapData) {
  for (const [key, entry] of Object.entries(mapData?.players || {})) {
    addPlayerMapping(index, key, entry);
  }

  return index;
}

async function fetchJsonAsset(url) {
  const response = await fetch(url, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.json();
}

function eventTypeLabel(type) {
  return type === "Goal" ? runtimeText.states.goalEvent : type;
}

function timelineAnchorId(match) {
  return `moment-${safeDomId(match?.id || `${match?.kickoffTime}-${match?.home?.name}-${match?.away?.name}`)}`;
}

function timelineMatchHref(match) {
  return withBasePath(`/worldcup/moments/#${timelineAnchorId(match)}`);
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
