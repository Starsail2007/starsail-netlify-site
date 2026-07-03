const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const TARGET_LOOKBACK_HOURS = 14;
const COMPLETED_MATCH_MINUTES = 80;
const TARGET_LIMIT = 6;

export async function patchOpenFootballScoresWithOpenAI(raw, options = {}) {
  const apiKey = options.apiKey || "";
  const matches = Array.isArray(raw?.matches) ? raw.matches : [];
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const targets = findScorePatchTargets(matches, now);

  if (!apiKey || !targets.length) {
    return {
      data: raw,
      patches: [],
      error: apiKey ? "" : "OPENAI_API_KEY is not configured."
    };
  }

  try {
    const payload = await requestScorePatches(targets, {
      apiKey,
      model: options.model || DEFAULT_OPENAI_MODEL,
      now
    });
    const patches = Array.isArray(payload?.matches) ? payload.matches : [];
    const patchedRaw = applyScorePatches(raw, patches);

    return {
      data: patchedRaw.data,
      patches: patchedRaw.patches,
      error: ""
    };
  } catch (error) {
    return {
      data: raw,
      patches: [],
      error: error instanceof Error ? error.message : "OpenAI score patch failed."
    };
  }
}

export function patchOpenFootballScoresWithOverrides(raw, overrides = []) {
  return applyScorePatches(raw, Array.isArray(overrides) ? overrides : []);
}

function findScorePatchTargets(matches, now) {
  const nowMs = now.getTime();
  const earliestMs = nowMs - TARGET_LOOKBACK_HOURS * 60 * 60 * 1_000;
  const completedByMs = nowMs - COMPLETED_MATCH_MINUTES * 60 * 1_000;

  return matches
    .filter((match) => !hasScore(match))
    .map((match) => ({
      match,
      kickoffMs: parseOpenFootballKickoff(match.date, match.time)
    }))
    .filter(({ kickoffMs }) => Number.isFinite(kickoffMs) && kickoffMs >= earliestMs && kickoffMs <= completedByMs)
    .sort((left, right) => right.kickoffMs - left.kickoffMs)
    .slice(0, TARGET_LIMIT)
    .map(({ match, kickoffMs }) => ({
      num: match.num,
      date: match.date,
      time: match.time,
      kickoffTime: new Date(kickoffMs).toISOString(),
      round: match.round || "",
      ground: match.ground || "",
      team1: match.team1,
      team2: match.team2
    }));
}

async function requestScorePatches(targets, { apiKey, model, now }) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      tool_choice: { type: "web_search_preview" },
      input: [
        {
          role: "system",
          content: [
            "You return strict JSON only.",
            "Use web search to verify recently completed FIFA World Cup 2026 match results.",
            "Prefer FIFA match centre pages. If FIFA does not expose the final score, use established sports score pages such as ESPN, theScore, The Guardian, or major sports news outlets.",
            "Only return a match when you can verify a completed result. Do not guess live scores or future results."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Current time: ${now.toISOString()}.`,
            "Patch only these openfootball matches if they are completed:",
            JSON.stringify(targets),
            "Return JSON with this exact shape:",
            "{ \"matches\": [{ \"num\": 85, \"team1\": \"Switzerland\", \"team2\": \"Algeria\", \"status\": \"FT\", \"score\": { \"ft\": [2, 0], \"ht\": [1, 0] }, \"goals1\": [{ \"name\": \"Breel Embolo\", \"minute\": \"10\" }], \"goals2\": [], \"sourceUrl\": \"https://...\", \"confidence\": 0.9 }] }"
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    const errorPayload = await safeReadJson(response);
    throw new Error(formatOpenAIError(errorPayload, response.status));
  }

  const payload = await response.json();
  const parsed = parseJsonObject(extractResponseText(payload));

  if (!parsed) {
    throw new Error("OpenAI did not return parseable score JSON.");
  }

  return parsed;
}

function applyScorePatches(raw, patches) {
  const data = structuredClone(raw);
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  const applied = [];

  for (const patch of patches) {
    const target = matches.find((match) => String(match.num) === String(patch?.num));

    if (!target || !isVerifiedCompletedPatch(target, patch)) {
      continue;
    }

    target.score = normalizePatchScore(patch.score);

    if (Array.isArray(patch.goals1)) {
      target.goals1 = patch.goals1.map(normalizePatchGoal).filter(Boolean);
    }

    if (Array.isArray(patch.goals2)) {
      target.goals2 = patch.goals2.map(normalizePatchGoal).filter(Boolean);
    }

    applied.push({
      num: String(target.num),
      team1: target.team1,
      team2: target.team2,
      score: target.score,
      sourceUrl: patch.sourceUrl || ""
    });
  }

  return {
    data,
    patches: applied
  };
}

function isVerifiedCompletedPatch(target, patch) {
  const status = String(patch?.status || "").toUpperCase();
  const score = normalizePatchScore(patch?.score);

  return ["FT", "AET", "PEN"].includes(status)
    && hasScore({ score })
    && sameTeamName(target.team1, patch.team1)
    && sameTeamName(target.team2, patch.team2);
}

function normalizePatchScore(score) {
  if (!score || typeof score !== "object") {
    return null;
  }

  const normalized = {};

  for (const key of ["ft", "ht", "et", "p"]) {
    if (isScorePair(score[key])) {
      normalized[key] = [Number(score[key][0]), Number(score[key][1])];
    }
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizePatchGoal(goal) {
  const name = String(goal?.name || "").trim();
  const minute = String(goal?.minute || "").trim();

  if (!name || !minute) {
    return null;
  }

  return {
    name,
    minute,
    penalty: Boolean(goal.penalty),
    owngoal: Boolean(goal.owngoal)
  };
}

function hasScore(match) {
  const score = match?.score;
  return isScorePair(score?.ft) || isScorePair(score?.et) || isScorePair(score?.p);
}

function isScorePair(value) {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
}

function sameTeamName(left, right) {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseOpenFootballKickoff(date, time) {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})\s+UTC([+-]\d{1,2})$/);

  if (!match || !date) {
    return Number.NaN;
  }

  const [, hour, minute, offset] = match;
  return Date.UTC(
    Number(String(date).slice(0, 4)),
    Number(String(date).slice(5, 7)) - 1,
    Number(String(date).slice(8, 10)),
    Number(hour) - Number(offset),
    Number(minute)
  );
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatOpenAIError(payload, status) {
  const error = payload?.error;

  if (error?.code === "insufficient_quota") {
    return "OpenAI API quota is insufficient or billing is not enabled.";
  }

  if (error?.message) {
    return `OpenAI API request failed: ${error.message}`;
  }

  return `OpenAI API request failed: HTTP ${status}`;
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  return (payload?.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function parseJsonObject(text) {
  if (!text) {
    return null;
  }

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
