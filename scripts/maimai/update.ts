import { fetchDivingFishB50 } from "../../src/lib/maimai/divingFishClient";
import { getMusicDataLocal, saveMaimaiSnapshotLocal } from "../../src/lib/maimai/localStore";
import { refreshDivingFishMusicCache } from "../../src/lib/maimai/musicCache";
import { normalizeDivingFishB50 } from "../../src/lib/maimai/normalize";
import {
  canUseMaimaiRemoteStorage,
  saveMaimaiSnapshot,
  saveUpdateLog
} from "../../src/lib/maimai/storage";
import type { MaimaiSnapshot } from "../../src/lib/maimai/types";
import { getMaimaiIdentity } from "./env";

function ratingDelta(snapshot: MaimaiSnapshot, previous: MaimaiSnapshot | null): string {
  if (!previous) {
    return "n/a";
  }

  const delta = snapshot.rating - previous.rating;
  return delta >= 0 ? `+${delta}` : String(delta);
}

function countChangedItems(snapshot: MaimaiSnapshot, previous: MaimaiSnapshot | null): number | null {
  if (!previous) {
    return null;
  }

  const previousIds = new Set([...previous.b35, ...previous.b15].map((item) => item.id));
  return [...snapshot.b35, ...snapshot.b15].filter((item) => !previousIds.has(item.id)).length;
}

async function getMusicDataForUpdate(): Promise<{ data: unknown; cacheStatus: "updated" | "not-modified" | "cached" }> {
  try {
    const result = await refreshDivingFishMusicCache();
    return { data: result.data, cacheStatus: result.status };
  } catch (error) {
    const cached = await getMusicDataLocal();

    if (cached) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[maimai:update] music-cache refresh failed, using local cache. ${message}`);
      return { data: cached, cacheStatus: "cached" };
    }

    throw error;
  }
}

export async function runUpdate(): Promise<void> {
  const identity = getMaimaiIdentity();

  console.log(`[maimai:update] fetching B50 for ${identity.label}`);
  const [rawB50, music] = await Promise.all([
    fetchDivingFishB50({ username: identity.username, qq: identity.qq }),
    getMusicDataForUpdate()
  ]);

  const snapshot = normalizeDivingFishB50(rawB50, music.data, {
    playerKey: identity.playerKey
  });
  const saved = await saveMaimaiSnapshotLocal(snapshot);
  const changedItems = countChangedItems(snapshot, saved.previous);
  let remoteStatus = "skipped";

  console.log(`nickname: ${snapshot.nickname}`);
  console.log(`rating: ${snapshot.rating} (${ratingDelta(snapshot, saved.previous)})`);
  console.log(`b35: ${snapshot.b35.length} items, rating ${snapshot.b35Rating}`);
  console.log(`b15: ${snapshot.b15.length} items, rating ${snapshot.b15Rating}`);
  console.log(`music cache: ${music.cacheStatus}`);
  console.log(`saved latest snapshot: ${saved.latestPath}`);
  console.log(`saved history snapshots: ${saved.historyPath} (${saved.historyCount} total)`);

  if (canUseMaimaiRemoteStorage()) {
    try {
      const remote = await saveMaimaiSnapshot(snapshot);
      await saveUpdateLog({
        playerKey: snapshot.playerKey,
        source: snapshot.source,
        status: "success",
        message: "CLI update completed.",
        ratingBefore: saved.previous?.rating ?? null,
        ratingAfter: snapshot.rating,
        changedItems
      });
      remoteStatus = `saved (${remote.id})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      remoteStatus = `failed: ${message}`;
      console.warn(`[maimai:update] Supabase save failed. ${message}`);
    }
  }

  console.log(`supabase: ${remoteStatus}`);
}
