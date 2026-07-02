import siteText from "../content/siteText";

const initialDataElement = document.getElementById("maimai-initial-data");
const dashboard = document.querySelector("[data-maimai-dashboard]");
const emptyState = document.querySelector("[data-maimai-empty]");
const defaultCover = "/assets/maimai/default-cover.png";
const text = siteText.maimai;

const readInitialData = () => {
  if (!initialDataElement?.textContent) {
    return null;
  }

  try {
    return JSON.parse(initialDataElement.textContent);
  } catch {
    return null;
  }
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const escapeAttribute = escapeHtml;

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, month, day] = value.split("-");
    return `${month}/${day}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatAchievement = (value) => Number.isFinite(Number(value))
  ? `${Number(value).toFixed(4)}%`
  : "--";

const formatSource = (value) => value === "diving_fish" ? "Diving-Fish" : value || "local";

const difficultyClass = (difficulty) => `difficulty-${String(difficulty).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const allItems = (snapshot) => [...(snapshot?.b35 || []), ...(snapshot?.b15 || [])];

const getNearRankUpItems = (snapshot) => {
  const lines = [100.5, 100, 99.5, 99];
  return allItems(snapshot)
    .map((item) => {
      const nextLine = lines.find((line) => Number(item.achievements) < line);
      return { item, gap: nextLine === undefined ? Number.POSITIVE_INFINITY : nextLine - Number(item.achievements) };
    })
    .filter(({ gap }) => gap > 0 && gap <= 0.35)
    .sort((a, b) => a.gap - b.gap || Number(b.item.ra) - Number(a.item.ra))
    .slice(0, 6)
    .map(({ item }) => item);
};

const getBorderItems = (snapshot) => [
  ...(snapshot?.b35 || []).slice(-5),
  ...(snapshot?.b15 || []).slice(-5)
].sort((a, b) => Number(a.ra) - Number(b.ra));

const getHighValuePracticeItems = (snapshot) => {
  const items = allItems(snapshot);
  const average = items.reduce((sum, item) => sum + Number(item.achievements || 0), 0) / Math.max(1, items.length);
  return items
    .filter((item) => Number(item.ds) >= 12 && Number(item.achievements) < average - 0.45)
    .sort((a, b) => Number(b.ds) - Number(a.ds) || Number(a.achievements) - Number(b.achievements))
    .slice(0, 6);
};

const renderStatusBadge = (label, value) => `
  <span class="maimai-status-badge">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </span>
`;

const renderCard = (item) => {
  const badges = [item.rate, item.fc, item.fs].filter(Boolean);
  const badgeHtml = badges.length > 0
    ? badges.map((badge) => `<span>${escapeHtml(String(badge).toUpperCase())}</span>`).join("")
    : `<span>${escapeHtml(text.b50.playBadge)}</span>`;

  return `
    <article class="b50-card ${difficultyClass(item.difficulty)}" data-b50-card>
      <div class="b50-rank">#${escapeHtml(item.rankIndex)}</div>
      <img
        class="maimai-cover"
        src="${escapeHtml(item.coverUrl || defaultCover)}"
        alt="${escapeHtml(item.title)} ${escapeHtml(text.b50.coverAltSuffix)}"
        loading="lazy"
        decoding="async"
        data-cover-fallback="${defaultCover}"
      />
      <div class="b50-card-body">
        <div class="b50-card-topline">
          <span>${escapeHtml(item.type)}</span>
          <span>${escapeHtml(item.difficulty)}</span>
        </div>
        <h3 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.artist || item.version || text.b50.defaultArtist)}</p>
        <div class="b50-score-row">
          <strong>${formatAchievement(item.achievements)}</strong>
          <span>${Number(item.ds || 0).toFixed(1)} ${escapeHtml(text.b50.scoreSeparator)} ${escapeHtml(item.ra)}</span>
        </div>
        <div class="b50-badges" aria-label="${escapeAttribute(text.b50.badgesAriaLabel)}">${badgeHtml}</div>
      </div>
    </article>
  `;
};

const renderTrend = (history) => {
  const ordered = [...history].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  if (ordered.length === 0) {
    return `<p class="empty-note">${escapeHtml(text.sections.trend.empty)}</p>`;
  }

  const ratings = ordered.map((point) => Number(point.rating || 0));
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const range = Math.max(1, max - min);
  const pointFor = (point, index) => {
    const x = ordered.length <= 1 ? 12 : 12 + (index / (ordered.length - 1)) * 276;
    const y = 112 - ((Number(point.rating || 0) - min) / range) * 88;
    return { x, y };
  };
  const path = ordered.map((point, index) => {
    const { x, y } = pointFor(point, index);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const circles = ordered.length <= 80
    ? ordered.map((point, index) => {
      const { x, y } = pointFor(point, index);
      return `<circle class="trend-point" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" />`;
    }).join("")
    : "";

  return `
    <svg viewBox="0 0 300 128" role="img" aria-label="${escapeAttribute(text.sections.trend.chartAriaLabel)}">
      <path class="trend-grid-line" d="M 12 24 H 288" />
      <path class="trend-grid-line" d="M 12 68 H 288" />
      <path class="trend-grid-line" d="M 12 112 H 288" />
      <path class="trend-line" d="${path}" />
      ${circles}
    </svg>
    <div class="trend-meta">
      <span>${formatDateTime(ordered[0]?.createdAt)}</span>
      <strong>${escapeHtml(ordered[ordered.length - 1]?.rating)}</strong>
      <span>${formatDateTime(ordered[ordered.length - 1]?.createdAt)}</span>
    </div>
  `;
};

const renderTimeline = (history) => {
  const ordered = [...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (ordered.length === 0) {
    return `<li class="empty-note">${escapeHtml(text.sections.timeline.empty)}</li>`;
  }

  return ordered.slice(0, 8).map((point, index) => {
    const previous = ordered[index + 1];
    const delta = previous ? Number(point.rating || 0) - Number(previous.rating || 0) : 0;
    return `
      <li>
        <span>${formatDateTime(point.createdAt)}</span>
        <strong>${escapeHtml(point.rating)}</strong>
        <em>${delta >= 0 ? `+${delta}` : delta}</em>
      </li>
    `;
  }).join("");
};

const renderSuggestions = (snapshot) => {
  const groups = [
    [text.sections.suggestions.groups.nearRankUp, getNearRankUpItems(snapshot)],
    [text.sections.suggestions.groups.borderItems, getBorderItems(snapshot)],
    [text.sections.suggestions.groups.practiceItems, getHighValuePracticeItems(snapshot)]
  ];

  return groups.map(([title, items]) => `
    <div class="suggestion-group">
      <h3>${escapeHtml(title)}</h3>
      ${items.length > 0 ? `
        <ol>
          ${items.slice(0, 4).map((item) => `
            <li>
              <span>${escapeHtml(item.title)}</span>
              <strong>${formatAchievement(item.achievements)}</strong>
            </li>
          `).join("")}
        </ol>
      ` : `<p class="empty-note">${escapeHtml(text.sections.suggestions.empty)}</p>`}
    </div>
  `).join("");
};

const renderDashboard = (snapshot, history) => {
  if (!dashboard || !snapshot) {
    dashboard?.setAttribute("hidden", "");
    emptyState?.removeAttribute("hidden");
    return;
  }

  dashboard.removeAttribute("hidden");
  emptyState?.setAttribute("hidden", "");

  const field = (name) => dashboard.querySelector(`[data-maimai-field="${name}"]`);
  const nickname = field("nickname");
  const rating = field("rating");

  if (nickname) {
    nickname.textContent = snapshot.nickname || "--";
  }

  if (rating) {
    rating.textContent = String(snapshot.rating ?? "--");
  }

  const heroStats = dashboard.querySelector(".hero-stats");
  if (heroStats) {
    heroStats.innerHTML = [
      renderStatusBadge(text.hero.stats.b35, snapshot.b35Rating ?? "--"),
      renderStatusBadge(text.hero.stats.b15, snapshot.b15Rating ?? "--"),
      renderStatusBadge(text.hero.stats.source, formatSource(snapshot.source)),
      renderStatusBadge(text.hero.stats.updated, formatDateTime(snapshot.createdAt))
    ].join("");
  }

  const b35Grid = dashboard.querySelector('[data-maimai-grid="b35"]');
  const b15Grid = dashboard.querySelector('[data-maimai-grid="b15"]');
  const b35Count = dashboard.querySelector('[data-maimai-count="b35"]');
  const b15Count = dashboard.querySelector('[data-maimai-count="b15"]');
  const trend = dashboard.querySelector("[data-maimai-trend]");
  const timeline = dashboard.querySelector("[data-maimai-timeline]");
  const suggestions = dashboard.querySelector("[data-maimai-suggestions]");

  if (b35Grid) {
    b35Grid.innerHTML = (snapshot.b35 || []).map(renderCard).join("");
  }

  if (b15Grid) {
    b15Grid.innerHTML = (snapshot.b15 || []).map(renderCard).join("");
  }

  if (b35Count) {
    b35Count.textContent = String((snapshot.b35 || []).length);
  }

  if (b15Count) {
    b15Count.textContent = String((snapshot.b15 || []).length);
  }

  if (trend) {
    trend.innerHTML = renderTrend(history);
  }

  if (timeline) {
    timeline.innerHTML = renderTimeline(history);
  }

  if (suggestions) {
    suggestions.innerHTML = renderSuggestions(snapshot);
  }
};

document.addEventListener("error", (event) => {
  const target = event.target;

  if (target instanceof HTMLImageElement && target.classList.contains("maimai-cover")) {
    const fallback = target.dataset.coverFallback || defaultCover;

    if (target.src !== new URL(fallback, window.location.href).href) {
      target.src = fallback;
    }
  }
}, true);

const initialData = readInitialData();

if (initialData?.snapshot) {
  renderDashboard(initialData.snapshot, initialData.history || []);
}

const loadRemoteData = async () => {
  if (!dashboard) {
    return;
  }

  try {
    const [latestResponse, historyResponse] = await Promise.all([
      fetch("/.netlify/functions/maimai-latest", { headers: { accept: "application/json" } }),
      fetch("/.netlify/functions/maimai-history?limit=1000", { headers: { accept: "application/json" } })
    ]);

    if (!latestResponse.ok) {
      return;
    }

    const latestJson = await latestResponse.json();
    const historyJson = historyResponse.ok ? await historyResponse.json() : null;

    if (latestJson.ok && latestJson.data) {
      renderDashboard(latestJson.data, historyJson?.data || initialData?.history || []);
    }
  } catch {
    // The static fallback is already rendered; failed function calls should stay quiet.
  }
};

loadRemoteData();
