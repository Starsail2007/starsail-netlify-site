import { getMaimaiIdentityFromEnv } from "../../src/lib/maimai/config";
import {
  fetchMaimaiFullRecordsSnapshot,
  fetchMaimaiSnapshot,
  saveRemoteMaimaiFullRecordsUpdate,
  saveRemoteMaimaiUpdate
} from "../../src/lib/maimai/updateService";

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  const expectedSecret = process.env.MAIMAI_UPDATE_SECRET;

  if (!expectedSecret) {
    return jsonResponse({
      ok: false,
      error: "MAIMAI_UPDATE_SECRET 未配置，手动公网更新入口已禁用。"
    }, 503);
  }

  if (request.headers.get("x-update-secret") !== expectedSecret) {
    return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const identity = getMaimaiIdentityFromEnv();
    const { snapshot, musicSource } = await fetchMaimaiSnapshot(identity);
    const saved = await saveRemoteMaimaiUpdate(snapshot);
    const fullRecords = await trySaveFullRecords(identity);

    return jsonResponse({
      ok: true,
      data: {
        id: saved.id,
        nickname: snapshot.nickname,
        rating: snapshot.rating,
        b35: snapshot.b35.length,
        b15: snapshot.b15.length,
        ratingBefore: saved.ratingBefore,
        changedItems: saved.changedItems,
        createdAt: snapshot.createdAt,
        musicSource,
        fullRecords
      }
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

async function trySaveFullRecords(identity: ReturnType<typeof getMaimaiIdentityFromEnv>): Promise<
  | { ok: true; id: string; recordCount: number; changedItems: number | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string }
> {
  if (!process.env.DIVING_FISH_IMPORT_TOKEN?.trim()) {
    return { ok: false, skipped: true, reason: "DIVING_FISH_IMPORT_TOKEN not configured." };
  }

  try {
    const snapshot = await fetchMaimaiFullRecordsSnapshot(identity);
    const saved = await saveRemoteMaimaiFullRecordsUpdate(snapshot);

    return {
      ok: true,
      id: saved.id,
      recordCount: snapshot.recordCount,
      changedItems: saved.changedItems
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

function emptyResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-update-secret"
  };
}
