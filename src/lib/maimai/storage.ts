import { createHash } from "node:crypto";
import type { MaimaiHistoricalRatingPoint } from "./ratingTrend";
import { getSupabaseServerClient, hasSupabaseServerConfig } from "./supabaseServer";
import type { MaimaiFullRecordsSnapshot, MaimaiRatingPoint, MaimaiSnapshot } from "./types";

export interface UpdateLogInput {
  playerKey: string;
  source?: MaimaiSnapshot["source"];
  status: "success" | "failed" | "skipped" | string;
  message?: string;
  ratingBefore?: number | null;
  ratingAfter?: number | null;
  changedItems?: number | null;
}

interface SnapshotRow {
  id: string;
  player_key: string;
  source: MaimaiSnapshot["source"];
  nickname: string | null;
  rating: number | null;
  b35_rating: number | null;
  b15_rating: number | null;
  payload: MaimaiSnapshot;
  payload_hash: string | null;
  created_at: string;
}

interface FullRecordsSnapshotRow {
  id: string;
  player_key: string;
  source: MaimaiFullRecordsSnapshot["source"];
  nickname: string | null;
  username: string | null;
  rating: number | null;
  record_count: number | null;
  payload: MaimaiFullRecordsSnapshot;
  payload_hash: string | null;
  created_at: string;
}

interface HistoricalRatingPointRow {
  id: string;
  player_key: string;
  source: "lxns" | "manual";
  source_point_id: string | null;
  point_date: string;
  rating: number | null;
  standard_rating: number | null;
  dx_rating: number | null;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function rowToSnapshot(row: SnapshotRow): MaimaiSnapshot {
  return {
    ...row.payload,
    id: row.id,
    playerKey: row.player_key,
    source: row.source,
    nickname: row.nickname ?? row.payload.nickname,
    rating: row.rating ?? row.payload.rating,
    b35Rating: row.b35_rating ?? row.payload.b35Rating,
    b15Rating: row.b15_rating ?? row.payload.b15Rating,
    createdAt: row.created_at
  };
}

function rowToFullRecordsSnapshot(row: FullRecordsSnapshotRow): MaimaiFullRecordsSnapshot {
  return {
    ...row.payload,
    id: row.id,
    playerKey: row.player_key,
    source: row.source,
    nickname: row.nickname ?? row.payload.nickname,
    username: row.username ?? row.payload.username,
    rating: row.rating ?? row.payload.rating,
    recordCount: row.record_count ?? row.payload.recordCount,
    createdAt: row.created_at
  };
}

function rowToHistoricalRatingPoint(row: HistoricalRatingPointRow): MaimaiRatingPoint {
  return {
    createdAt: row.point_date,
    rating: Number(row.rating ?? 0),
    source: row.source,
    standardRating: row.standard_rating === null ? undefined : Number(row.standard_rating),
    dxRating: row.dx_rating === null ? undefined : Number(row.dx_rating)
  };
}

function pointDateKey(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export async function saveMaimaiSnapshot(snapshot: MaimaiSnapshot): Promise<{ id: string; payloadHash: string }> {
  const supabase = getSupabaseServerClient();
  const payloadHash = hashPayload(snapshot);
  const { data, error } = await supabase
    .from("maimai_snapshots")
    .insert({
      player_key: snapshot.playerKey,
      source: snapshot.source,
      nickname: snapshot.nickname,
      rating: snapshot.rating,
      b35_rating: snapshot.b35Rating,
      b15_rating: snapshot.b15Rating,
      payload: snapshot,
      payload_hash: payloadHash,
      created_at: snapshot.createdAt
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`保存 Supabase snapshot 失败：${error.message}`);
  }

  return {
    id: String(data.id),
    payloadHash
  };
}

export async function getLatestMaimaiSnapshot(playerKey: string): Promise<MaimaiSnapshot | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("maimai_snapshots")
    .select("*")
    .eq("player_key", playerKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SnapshotRow>();

  if (error) {
    throw new Error(`读取 Supabase latest snapshot 失败：${error.message}`);
  }

  return data ? rowToSnapshot(data) : null;
}

export async function getMaimaiRatingHistory(
  playerKey: string,
  limit = 20
): Promise<MaimaiRatingPoint[]> {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const { data, error } = await supabase
    .from("maimai_snapshots")
    .select("created_at,rating,b35_rating,b15_rating")
    .eq("player_key", playerKey)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`读取 Supabase Rating history 失败：${error.message}`);
  }

  return (data ?? []).map((row) => ({
    createdAt: String(row.created_at),
    rating: Number(row.rating ?? 0),
    b35Rating: row.b35_rating === null ? undefined : Number(row.b35_rating),
    b15Rating: row.b15_rating === null ? undefined : Number(row.b15_rating),
    source: "snapshot"
  }));
}

export async function saveMaimaiHistoricalRatingPoints(
  points: MaimaiHistoricalRatingPoint[]
): Promise<{ count: number }> {
  if (points.length === 0) {
    return { count: 0 };
  }

  const supabase = getSupabaseServerClient();
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("maimai_rating_trend_points")
    .upsert(points.map((point) => ({
      player_key: point.playerKey,
      source: point.source,
      source_point_id: point.sourcePointId ?? null,
      point_date: pointDateKey(point.createdAt),
      rating: point.rating,
      standard_rating: point.standardRating ?? null,
      dx_rating: point.dxRating ?? null,
      payload: point.raw,
      updated_at: updatedAt
    })), {
      onConflict: "player_key,source,point_date"
    })
    .select("id");

  if (error) {
    throw new Error(`保存 Supabase historical rating trend 失败：${error.message}`);
  }

  return { count: data?.length ?? points.length };
}

export async function getMaimaiHistoricalRatingHistory(
  playerKey: string,
  limit = 500
): Promise<MaimaiRatingPoint[]> {
  const supabase = getSupabaseServerClient();
  const safeLimit = Math.max(1, Math.min(2000, Math.trunc(limit)));
  const { data, error } = await supabase
    .from("maimai_rating_trend_points")
    .select("*")
    .eq("player_key", playerKey)
    .order("point_date", { ascending: false })
    .limit(safeLimit)
    .returns<HistoricalRatingPointRow[]>();

  if (error) {
    throw new Error(`读取 Supabase historical rating trend 失败：${error.message}`);
  }

  return (data ?? []).map(rowToHistoricalRatingPoint);
}

export async function saveMaimaiFullRecordsSnapshot(
  snapshot: MaimaiFullRecordsSnapshot
): Promise<{ id: string; payloadHash: string }> {
  const supabase = getSupabaseServerClient();
  const payloadHash = hashPayload(snapshot);
  const { data, error } = await supabase
    .from("maimai_full_record_snapshots")
    .insert({
      player_key: snapshot.playerKey,
      source: snapshot.source,
      nickname: snapshot.nickname,
      username: snapshot.username ?? null,
      rating: snapshot.rating,
      record_count: snapshot.recordCount,
      payload: snapshot,
      payload_hash: payloadHash,
      created_at: snapshot.createdAt
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`保存 Supabase full records snapshot 失败：${error.message}`);
  }

  return {
    id: String(data.id),
    payloadHash
  };
}

export async function getLatestMaimaiFullRecordsSnapshot(
  playerKey: string
): Promise<MaimaiFullRecordsSnapshot | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("maimai_full_record_snapshots")
    .select("*")
    .eq("player_key", playerKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<FullRecordsSnapshotRow>();

  if (error) {
    throw new Error(`读取 Supabase latest full records snapshot 失败：${error.message}`);
  }

  return data ? rowToFullRecordsSnapshot(data) : null;
}

export async function saveUpdateLog(input: UpdateLogInput): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("maimai_update_logs").insert({
    player_key: input.playerKey,
    source: input.source ?? "diving_fish",
    status: input.status,
    message: input.message,
    rating_before: input.ratingBefore ?? null,
    rating_after: input.ratingAfter ?? null,
    changed_items: input.changedItems ?? null
  });

  if (error) {
    throw new Error(`保存 Supabase update log 失败：${error.message}`);
  }
}

export function canUseMaimaiRemoteStorage(): boolean {
  return hasSupabaseServerConfig();
}
