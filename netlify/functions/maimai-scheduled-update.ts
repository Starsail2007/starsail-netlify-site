import type { Config } from "@netlify/functions";
import { getMaimaiIdentityFromEnv } from "../../src/lib/maimai/config";
import {
  fetchMaimaiFullRecordsSnapshot,
  fetchMaimaiSnapshot,
  saveRemoteMaimaiFullRecordsUpdate,
  saveRemoteMaimaiUpdate
} from "../../src/lib/maimai/updateService";

export default async function handler(request: Request): Promise<Response> {
  let nextRun: string | undefined;

  try {
    const body = await request.json().catch(() => null) as { next_run?: string } | null;
    nextRun = body?.next_run;
    const identity = getMaimaiIdentityFromEnv();
    const { snapshot, musicSource } = await fetchMaimaiSnapshot(identity);
    const saved = await saveRemoteMaimaiUpdate(snapshot);
    const fullRecords = await trySaveFullRecords(identity);

    console.log("[maimai-scheduled-update] saved", {
      id: saved.id,
      rating: snapshot.rating,
      b35: snapshot.b35.length,
      b15: snapshot.b15.length,
      changedItems: saved.changedItems,
      musicSource,
      fullRecords,
      nextRun
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[maimai-scheduled-update] failed", error);
    return new Response(null, { status: 500 });
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

export const config: Config = {
  schedule: "0 */6 * * *"
};
