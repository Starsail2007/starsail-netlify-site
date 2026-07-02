import {
  fetchDivingFishB50,
  fetchDivingFishFullRecordsWithImportToken,
  fetchDivingFishMusicData
} from "./divingFishClient";
import { normalizeDivingFishFullRecords } from "./fullRecords";
import { getMusicDataLocal } from "./localStore";
import { normalizeDivingFishB50 } from "./normalize";
import {
  canUseMaimaiRemoteStorage,
  getLatestMaimaiFullRecordsSnapshot,
  getLatestMaimaiSnapshot,
  saveMaimaiFullRecordsSnapshot,
  saveMaimaiSnapshot,
  saveUpdateLog
} from "./storage";
import type { MaimaiB50Item, MaimaiFullRecordItem, MaimaiFullRecordsSnapshot, MaimaiSnapshot } from "./types";
import type { MaimaiIdentity } from "./config";

function itemSignature(item: MaimaiB50Item): string {
  return [
    item.group,
    item.songId,
    item.difficultyIndex,
    item.ra,
    item.achievements,
    item.rate ?? "",
    item.fc ?? "",
    item.fs ?? ""
  ].join(":");
}

export function countChangedB50Items(snapshot: MaimaiSnapshot, previous: MaimaiSnapshot | null): number | null {
  if (!previous) {
    return null;
  }

  const previousItems = new Set([...previous.b35, ...previous.b15].map(itemSignature));
  return [...snapshot.b35, ...snapshot.b15].filter((item) => !previousItems.has(itemSignature(item))).length;
}

function fullRecordSignature(item: MaimaiFullRecordItem): string {
  return [
    item.songId,
    item.difficultyIndex,
    item.ra,
    item.achievements,
    item.rate ?? "",
    item.fc ?? "",
    item.fs ?? "",
    item.dxScore ?? ""
  ].join(":");
}

export function countChangedFullRecordItems(
  snapshot: MaimaiFullRecordsSnapshot,
  previous: MaimaiFullRecordsSnapshot | null
): number | null {
  if (!previous) {
    return null;
  }

  const previousItems = new Set(previous.records.map(fullRecordSignature));
  return snapshot.records.filter((item) => !previousItems.has(fullRecordSignature(item))).length;
}

export async function getMusicDataForServerUpdate(): Promise<{ data: unknown; source: "diving_fish" | "local-fallback" }> {
  try {
    const response = await fetchDivingFishMusicData();

    if (response.status === 200 && response.data) {
      return { data: response.data, source: "diving_fish" };
    }
  } catch (error) {
    const cached = await getMusicDataLocal();

    if (cached) {
      return { data: cached, source: "local-fallback" };
    }

    throw error;
  }

  const cached = await getMusicDataLocal();

  if (!cached) {
    throw new Error("曲库数据不可用，且没有本地 fallback。");
  }

  return { data: cached, source: "local-fallback" };
}

export async function fetchMaimaiSnapshot(identity: MaimaiIdentity): Promise<{
  snapshot: MaimaiSnapshot;
  musicSource: "diving_fish" | "local-fallback";
}> {
  const [rawB50, music] = await Promise.all([
    fetchDivingFishB50({ username: identity.username, qq: identity.qq }),
    getMusicDataForServerUpdate()
  ]);
  const snapshot = normalizeDivingFishB50(rawB50, music.data, {
    playerKey: identity.playerKey
  });

  return {
    snapshot,
    musicSource: music.source
  };
}

export async function fetchMaimaiFullRecordsSnapshot(
  identity: MaimaiIdentity,
  importToken = process.env.DIVING_FISH_IMPORT_TOKEN
): Promise<MaimaiFullRecordsSnapshot> {
  const raw = await fetchDivingFishFullRecordsWithImportToken(importToken ?? "");

  return normalizeDivingFishFullRecords(raw, {
    playerKey: identity.playerKey
  });
}

export async function saveRemoteMaimaiUpdate(snapshot: MaimaiSnapshot): Promise<{
  id: string;
  payloadHash: string;
  ratingBefore: number | null;
  changedItems: number | null;
}> {
  if (!canUseMaimaiRemoteStorage()) {
    throw new Error("Supabase 未配置，无法保存远端快照。");
  }

  const previous = await getLatestMaimaiSnapshot(snapshot.playerKey);
  const changedItems = countChangedB50Items(snapshot, previous);
  const saved = await saveMaimaiSnapshot(snapshot);

  await saveUpdateLog({
    playerKey: snapshot.playerKey,
    source: snapshot.source,
    status: "success",
    message: "Netlify function update completed.",
    ratingBefore: previous?.rating ?? null,
    ratingAfter: snapshot.rating,
    changedItems
  });

  return {
    id: saved.id,
    payloadHash: saved.payloadHash,
    ratingBefore: previous?.rating ?? null,
    changedItems
  };
}

export async function saveRemoteMaimaiFullRecordsUpdate(snapshot: MaimaiFullRecordsSnapshot): Promise<{
  id: string;
  payloadHash: string;
  previousRecordCount: number | null;
  changedItems: number | null;
}> {
  if (!canUseMaimaiRemoteStorage()) {
    throw new Error("Supabase 未配置，无法保存远端完整成绩快照。");
  }

  const previous = await getLatestMaimaiFullRecordsSnapshot(snapshot.playerKey);
  const changedItems = countChangedFullRecordItems(snapshot, previous);
  const saved = await saveMaimaiFullRecordsSnapshot(snapshot);

  await saveUpdateLog({
    playerKey: snapshot.playerKey,
    source: snapshot.source,
    status: "success",
    message: "Full records update completed.",
    ratingBefore: previous?.rating ?? null,
    ratingAfter: snapshot.rating,
    changedItems
  });

  return {
    id: saved.id,
    payloadHash: saved.payloadHash,
    previousRecordCount: previous?.recordCount ?? null,
    changedItems
  };
}
