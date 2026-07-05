import {
  formatTime,
  loadPlayerNameData,
  renderTimeline,
  sourceLabel
} from "./worldcup-dashboard.js";
import {
  fetchDataPayload,
  normalizeClientPayload
} from "./worldcup/data-client.js";
import siteText from "../content/siteText";

const worldcupText = siteText.worldcup;
const runtimeText = worldcupText.runtime;
const root = document.querySelector("[data-worldcup-moments-root]");

if (root) {
  const elements = {
    timeline: root.querySelector("[data-moments-timeline]"),
    updatedAt: root.querySelector("[data-updated-at]"),
    sourcePill: root.querySelector("[data-source-pill]"),
    error: root.querySelector("[data-error]"),
    refresh: root.querySelector("[data-refresh]")
  };
  let latestPayload = null;

  const loadMoments = async () => {
    try {
      const payload = normalizeClientPayload(await fetchDataPayload());
      latestPayload = payload;
      renderMoments(payload, elements);
      elements.updatedAt.textContent = formatTemplate(worldcupText.statusRow.updatedAtTemplate, {
        time: formatTime(payload.lastUpdated)
      });
      elements.sourcePill.textContent = sourceLabel(payload.source);
      clearError(elements);
      loadPlayerNameData().then(() => {
        if (latestPayload === payload) {
          renderMoments(payload, elements);
        }
      });
    } catch {
      showError(elements, runtimeText.fetchErrors.keepPrevious);
    }
  };

  elements.refresh?.addEventListener("click", loadMoments);
  loadMoments();
}

function renderMoments(payload, elements) {
  const matches = payload.allMatches?.length
    ? payload.allMatches
    : payload.matches;

  elements.timeline.innerHTML = renderTimeline(matches, {
    limit: Number.POSITIVE_INFINITY,
    withAnchors: true,
    sortMode: "matchTimeDesc"
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

function formatTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
