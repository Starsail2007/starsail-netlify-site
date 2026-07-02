import { DEFAULT_COVER_URL, getCoverUrl } from "./covers";
import type { MaimaiDifficulty, MaimaiFullRecordItem, MaimaiFullRecordsSnapshot } from "./types";

const DIFFICULTIES: MaimaiDifficulty[] = ["Basic", "Advanced", "Expert", "Master", "Re:Master"];

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstPresent(source: RecordLike, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return undefined;
}

function getDifficultyName(raw: RecordLike, difficultyIndex: number): string {
  return asString(firstPresent(raw, ["level_label", "levelLabel"]), DIFFICULTIES[difficultyIndex] ?? `Difficulty ${difficultyIndex}`);
}

function normalizeFullRecordItem(rawItem: unknown, index: number): MaimaiFullRecordItem | null {
  if (!isRecord(rawItem)) {
    return null;
  }

  const songId = asString(firstPresent(rawItem, ["song_id", "songId", "id"])).trim();
  const difficultyIndex = Math.trunc(asNumber(firstPresent(rawItem, ["level_index", "levelIndex", "difficultyIndex"]), 0));
  const fallbackId = `${asString(firstPresent(rawItem, ["title", "song_name", "songName"]), "unknown")}-${difficultyIndex}`;
  const normalizedSongId = songId || fallbackId;

  return {
    id: `record-${index + 1}-${normalizedSongId}-${difficultyIndex}`,
    songId: normalizedSongId,
    title: asString(firstPresent(rawItem, ["title", "song_name", "songName"]), "Unknown title"),
    type: asString(firstPresent(rawItem, ["type", "chart_type", "chartType"]), "DX"),
    difficultyIndex,
    difficulty: getDifficultyName(rawItem, difficultyIndex),
    level: asString(firstPresent(rawItem, ["level", "level_label", "levelLabel"])),
    ds: asNumber(firstPresent(rawItem, ["ds", "constant"]), 0),
    achievements: asNumber(firstPresent(rawItem, ["achievements", "achievement", "achieve"]), 0),
    rate: asString(firstPresent(rawItem, ["rate", "rank"])) || undefined,
    fc: asString(firstPresent(rawItem, ["fc", "combo"])) || undefined,
    fs: asString(firstPresent(rawItem, ["fs", "sync"])) || undefined,
    dxScore: asOptionalNumber(firstPresent(rawItem, ["dxScore", "dx_score", "dxscore"])),
    ra: Math.trunc(asNumber(firstPresent(rawItem, ["ra", "rating"]), 0)),
    coverUrl: songId ? getCoverUrl(songId) : DEFAULT_COVER_URL,
    raw: rawItem
  };
}

export function normalizeDivingFishFullRecords(
  raw: unknown,
  options: { playerKey: string; createdAt?: string }
): MaimaiFullRecordsSnapshot {
  const rawRecord = isRecord(raw) ? raw : {};
  const records = asArray(rawRecord.records)
    .map((item, index) => normalizeFullRecordItem(item, index))
    .filter((item): item is MaimaiFullRecordItem => Boolean(item));

  return {
    playerKey: options.playerKey,
    source: "diving_fish",
    nickname: asString(firstPresent(rawRecord, ["nickname", "username", "name"]), options.playerKey),
    username: asString(rawRecord.username) || undefined,
    rating: asNumber(rawRecord.rating, 0),
    plate: asString(rawRecord.plate) || undefined,
    additionalRating: asOptionalNumber(rawRecord.additional_rating),
    recordCount: records.length,
    records,
    createdAt: options.createdAt ?? new Date().toISOString(),
    raw
  };
}
