import { getMaimaiIdentityFromEnv } from "../../src/lib/maimai/config";
import { getLatestSnapshot } from "../../src/lib/maimai/localStore";
import { canUseMaimaiRemoteStorage, getLatestMaimaiSnapshot } from "../../src/lib/maimai/storage";

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const identity = getMaimaiIdentityFromEnv();
    let source: "supabase" | "local" = "local";
    let snapshot = null;

    if (canUseMaimaiRemoteStorage()) {
      try {
        snapshot = await getLatestMaimaiSnapshot(identity.playerKey);
        source = "supabase";
      } catch (error) {
        console.warn("[maimai-latest] Supabase read failed, using local fallback.", error);
      }
    }

    if (!snapshot) {
      snapshot = await getLatestSnapshot();
      source = "local";
    }

    if (!snapshot) {
      return jsonResponse({
        ok: false,
        error: "暂时没有读取到 maimai 成绩数据。请先运行 pnpm maimai:update。"
      }, 404);
    }

    return jsonResponse({
      ok: true,
      data: snapshot,
      meta: {
        source,
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
