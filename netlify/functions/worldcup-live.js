import { mockWorldCupData } from "../../src/worldcup/lib/mockWorldCupData.js";
import {
  normalizeApiFootballData,
  normalizeOpenFootballData,
  normalizeOpenAIScheduleData
} from "../../src/worldcup/lib/normalizeWorldCupData.js";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const DEFAULT_LEAGUE_ID = "1";
const DEFAULT_SEASON = "2026";
const SCHEDULE_LOOKBACK_DAYS = 1;
const SCHEDULE_LOOKAHEAD_DAYS = 3;
const OPENFOOTBALL_2026_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export default async function handler() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  const leagueId = process.env.FOOTBALL_LEAGUE_ID || DEFAULT_LEAGUE_ID;
  const season = process.env.FOOTBALL_SEASON || DEFAULT_SEASON;

  if (!apiKey) {
    return scheduleFallback({
      reason: "未配置 FOOTBALL_API_KEY。",
      leagueId,
      season
    });
  }

  try {
    const scheduleUrl = buildScheduleUrl({ leagueId, season });
    const response = await fetch(scheduleUrl, {
      headers: {
        "x-apisports-key": apiKey
      }
    });

    if (!response.ok) {
      return jsonResponse(
        {
          error: "足球数据接口请求失败。",
          status: response.status
        },
        502
      );
    }

    const raw = await response.json();

    if (raw?.errors?.plan) {
      return scheduleFallback({
        reason: `API-Football 当前账号计划无法访问 ${season} 赛季：${raw.errors.plan}`,
        leagueId,
        season
      });
    }

    const normalized = normalizeApiFootballData(raw);

    if (!normalized.matches.length) {
      return scheduleFallback({
        reason: "API-Football 当前未返回 2026 世界杯赛程。",
        leagueId,
        season
      });
    }

    return jsonResponse({
      ...normalized,
      source: "api-football",
      leagueId,
      season,
      polling: {
        mode: "schedule-window",
        liveIntervalSeconds: 300,
        quietIntervalSeconds: 21600
      },
      lastUpdated: new Date().toISOString()
    }, 200, {
      "Cache-Control": "public, max-age=60"
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "服务器处理世界杯数据时发生异常。",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

async function scheduleFallback({ reason, leagueId, season }) {
  const openFootballFallback = await fetchOpenFootballScheduleFallback();
  const openFootballSchedule = openFootballFallback?.data;

  if (openFootballSchedule?.matches?.length) {
    return jsonResponse({
      ...openFootballSchedule,
      source: "openfootball",
      message: `${reason} 已改用 openfootball 免费公开赛程。`,
      leagueId,
      season,
      polling: {
        mode: "openfootball-schedule-fallback",
        quietIntervalSeconds: 21600
      },
      lastUpdated: new Date().toISOString()
    }, 200, {
      "Cache-Control": "public, max-age=21600"
    });
  }

  const openAiFallback = await fetchOpenAIScheduleFallback({ reason, leagueId, season });
  const openAiSchedule = openAiFallback?.data;

  if (openAiSchedule?.matches?.length) {
    return jsonResponse({
      ...openAiSchedule,
      source: "openai-web",
      message: `${reason} openfootball 不可用，已改用 OpenAI Web Search 整理公开赛程。`,
      leagueId,
      season,
      polling: {
        mode: "openai-schedule-fallback",
        quietIntervalSeconds: 21600
      },
      lastUpdated: new Date().toISOString()
    }, 200, {
      "Cache-Control": "public, max-age=21600"
    });
  }

  return jsonResponse({
    ...mockWorldCupData,
    source: "mock",
    message: `${reason} ${openFootballFallback?.error || "openfootball 未返回可用赛程"}；${openAiFallback?.error || "未配置 OPENAI_API_KEY 或 OpenAI 未返回可用赛程"}，暂用模拟数据展示。`,
    leagueId,
    season,
    polling: {
      mode: "api-plan-fallback",
      quietIntervalSeconds: 21600
    },
    lastUpdated: new Date().toISOString()
  }, 200, {
    "Cache-Control": "public, max-age=300"
  });
}

async function fetchOpenFootballScheduleFallback() {
  try {
    const response = await fetch(OPENFOOTBALL_2026_URL);

    if (!response.ok) {
      return {
        data: null,
        error: `openfootball 请求失败：HTTP ${response.status}`
      };
    }

    const raw = await response.json();
    const window = getScheduleWindow();
    const normalized = normalizeOpenFootballData(raw, window);

    return {
      data: normalized.matches.length ? normalized : null,
      error: normalized.matches.length ? "" : "openfootball 当前日期窗口内没有赛程"
    };
  } catch (error) {
    return {
      data: null,
      error: `openfootball 处理失败：${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

async function fetchOpenAIScheduleFallback({ reason, leagueId, season }) {
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!openAiKey) {
    return {
      data: null,
      error: "未配置 OPENAI_API_KEY"
    };
  }

  const from = formatDate(addDays(new Date(), -SCHEDULE_LOOKBACK_DAYS));
  const to = formatDate(addDays(new Date(), SCHEDULE_LOOKAHEAD_DAYS));
  const model = process.env.OPENAI_SCHEDULE_MODEL || DEFAULT_OPENAI_MODEL;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiKey}`,
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
            "Use public web search to find FIFA World Cup 2026 match schedule information.",
            "Prefer official FIFA pages. If official pages do not contain enough detail, use established sports schedule pages.",
            "Do not invent matches. If no reliable matches exist for the requested date range, return an empty matches array."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `API-Football fallback reason: ${reason}`,
            `League id: ${leagueId}. Season: ${season}.`,
            `Return FIFA World Cup 2026 matches from ${from} to ${to}, inclusive.`,
            "Return JSON with this exact shape:",
            "{ \"matches\": [{ \"id\": \"string\", \"status\": \"NS\", \"statusText\": \"Not Started\", \"minute\": null, \"stage\": \"Group Stage\", \"venue\": \"string\", \"kickoffTime\": \"ISO-8601 UTC string\", \"home\": { \"name\": \"string\", \"code\": \"string\", \"iso2\": \"string\", \"score\": null }, \"away\": { \"name\": \"string\", \"code\": \"string\", \"iso2\": \"string\", \"score\": null }, \"events\": [] }], \"knockout\": [] }"
          ].join("\\n")
        }
      ]
    })
  });

  if (!response.ok) {
    const errorPayload = await safeReadJson(response);
    return {
      data: null,
      error: formatOpenAIError(errorPayload, response.status)
    };
  }

  const payload = await response.json();
  const text = extractResponseText(payload);
  const parsed = parseJsonObject(text);

  if (!parsed) {
    return {
      data: null,
      error: "OpenAI 未返回可解析的赛程 JSON"
    };
  }

  const normalized = normalizeOpenAIScheduleData(parsed);
  return {
    data: normalized.matches.length ? normalized : null,
    error: normalized.matches.length ? "" : "OpenAI 未找到当前日期窗口内的可靠公开赛程"
  };
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
    return "OpenAI API 当前额度不足或未开通 billing";
  }

  if (error?.message) {
    return `OpenAI API 请求失败：${error.message}`;
  }

  return `OpenAI API 请求失败：HTTP ${status}`;
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  return (payload?.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\\n")
    .trim();
}

function parseJsonObject(text) {
  if (!text) {
    return null;
  }

  const cleaned = text
    .replace(/^```json\\s*/i, "")
    .replace(/^```\\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\\{[\\s\\S]*\\}/);

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

function buildScheduleUrl({ leagueId, season }) {
  const { from, to } = getScheduleWindow();
  const params = new URLSearchParams({
    league: leagueId,
    season,
    from,
    to
  });

  return `${API_FOOTBALL_BASE_URL}/fixtures?${params.toString()}`;
}

function getScheduleWindow() {
  const now = new Date();

  return {
    from: formatDate(addDays(now, -SCHEDULE_LOOKBACK_DAYS)),
    to: formatDate(addDays(now, SCHEDULE_LOOKAHEAD_DAYS))
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
