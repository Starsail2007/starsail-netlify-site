import {
  DATA_ENDPOINT,
  formatTime,
  normalizeClientPayload,
  renderTimeline,
  sourceLabel
} from "./worldcup-dashboard.js";
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

  const loadMoments = async () => {
    try {
      const response = await fetch(DATA_ENDPOINT, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = normalizeClientPayload(await response.json());
      const matches = payload.allMatches?.length
        ? payload.allMatches
        : payload.matches;

      elements.timeline.innerHTML = renderTimeline(matches, {
        limit: Number.POSITIVE_INFINITY,
        withAnchors: true,
        sortMode: "matchTimeDesc"
      });
      elements.updatedAt.textContent = formatTemplate(worldcupText.statusRow.updatedAtTemplate, {
        time: formatTime(payload.lastUpdated)
      });
      elements.sourcePill.textContent = sourceLabel(payload.source);
      clearError(elements);
    } catch {
      showError(elements, runtimeText.fetchErrors.keepPrevious);
    }
  };

  elements.refresh?.addEventListener("click", loadMoments);
  loadMoments();
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
