import { getMaimaiIdentityFromEnv, readPositiveLimit } from "../../src/lib/maimai/config";
import { getRatingHistoryLocal } from "../../src/lib/maimai/localStore";
import { canUseMaimaiRemoteStorage, getMaimaiRatingHistory } from "../../src/lib/maimai/storage";

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const url = new URL(request.url);
    const limit = readPositiveLimit(url.searchParams.get("limit"), 100);
    const identity = getMaimaiIdentityFromEnv();
    let source: "supabase" | "local" = "local";
    let history = [];

    if (canUseMaimaiRemoteStorage()) {
      try {
        history = await getMaimaiRatingHistory(identity.playerKey, limit);
        source = "supabase";
      } catch (error) {
        console.warn("[maimai-history] Supabase read failed, using local fallback.", error);
      }
    }

    if (history.length === 0) {
      history = await getRatingHistoryLocal(limit);
      source = "local";
    }

    return jsonResponse({
      ok: true,
      data: history,
      meta: {
        source,
        limit,
        playerKey: identity.playerKey
      }
    }, 200, {
      "Cache-Control": "public, max-age=60"
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

function emptyResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...headers
    }
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
