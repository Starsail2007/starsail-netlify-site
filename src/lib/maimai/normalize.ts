import { DEFAULT_COVER_URL, getCoverUrl } from "./covers";
import type { MaimaiB50Item, MaimaiChartGroup, MaimaiDifficulty, MaimaiSnapshot } from "./types";

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

function getPath(source: unknown, path: string[]): unknown {
  let current = source;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function firstPresent(source: RecordLike, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return undefined;
}

function normalizeSongId(value: unknown): string {
  const raw = asString(value);
  return raw.trim();
}

function buildMusicIndex(musicData: unknown): Map<string, RecordLike> {
  const index = new Map<string, RecordLike>();

  for (const item of asArray(musicData)) {
    if (!isRecord(item)) {
      continue;
    }

    const id = normalizeSongId(item.id);

    if (id) {
      index.set(id, item);
    }
  }

  return index;
}

function getDifficultyName(index: number): string {
  return DIFFICULTIES[index] ?? `Difficulty ${index}`;
}

function getIndexedString(value: unknown, index: number, fallback = ""): string {
  const items = asArray(value);
  return asString(items[index], fallback);
}

function getIndexedNumber(value: unknown, index: number, fallback = 0): number {
  const items = asArray(value);
  return asNumber(items[index], fallback);
}

function getBasicInfo(music: RecordLike | undefined): RecordLike {
  const basicInfo = music?.basic_info;
  return isRecord(basicInfo) ? basicInfo : {};
}

function getCharts(raw: unknown): RecordLike {
  const charts = getPath(raw, ["charts"]);
  return isRecord(charts) ? charts : {};
}

function getPlayerRating(raw: unknown): number {
  if (!isRecord(raw)) {
    return 0;
  }

  return asNumber(firstPresent(raw, ["rating", "ra"]), 0);
}

function normalizeItem(
  rawItem: unknown,
  group: MaimaiChartGroup,
  rankIndex: number,
  musicIndex: Map<string, RecordLike>
): MaimaiB50Item | null {
  if (!isRecord(rawItem)) {
    return null;
  }

  const songId = normalizeSongId(firstPresent(rawItem, ["song_id", "songId", "id"]));
  const music = songId ? musicIndex.get(songId) : undefined;
  const basicInfo = getBasicInfo(music);
  const difficultyIndex = Math.trunc(asNumber(firstPresent(rawItem, ["level_index", "levelIndex", "difficultyIndex"]), 0));
  const ds = asNumber(firstPresent(rawItem, ["ds", "constant"]), getIndexedNumber(music?.ds, difficultyIndex, 0));
  const rawTitle = asString(firstPresent(rawItem, ["title", "song_name", "songName"]));
  const musicTitle = asString(music?.title);
  const title = rawTitle || musicTitle || "Unknown title";
  const type = asString(firstPresent(rawItem, ["type", "chart_type", "chartType"]), asString(music?.type, "DX"));
  const level = asString(firstPresent(rawItem, ["level", "level_label", "levelLabel"]), getIndexedString(music?.level, difficultyIndex, ""));
  const achievements = asNumber(firstPresent(rawItem, ["achievements", "achievement", "achieve"]), 0);
  const ra = Math.trunc(asNumber(firstPresent(rawItem, ["ra", "rating"]), 0));
  const normalizedSongId = songId || asString(firstPresent(rawItem, ["title", "song_name", "songName"]), `unknown-${rankIndex}`);

  return {
    id: `${group}-${rankIndex}-${normalizedSongId}-${difficultyIndex}`,
    songId: normalizedSongId,
    title,
    artist: asString(basicInfo.artist) || undefined,
    type,
    difficultyIndex,
    difficulty: getDifficultyName(difficultyIndex),
    level,
    ds,
    achievements,
    rate: asString(firstPresent(rawItem, ["rate", "rank"])) || undefined,
    fc: asString(firstPresent(rawItem, ["fc", "combo"])) || undefined,
    fs: asString(firstPresent(rawItem, ["fs", "sync"])) || undefined,
    dxScore: asOptionalNumber(firstPresent(rawItem, ["dxScore", "dx_score", "dxscore"])),
    ra,
    group,
    coverUrl: songId ? getCoverUrl(songId) : DEFAULT_COVER_URL,
    version: asString(firstPresent(rawItem, ["version", "from"]), asString(basicInfo.from)) || undefined,
    isNew: typeof basicInfo.is_new === "boolean" ? basicInfo.is_new : undefined,
    rankIndex,
    raw: rawItem
  };
}

function normalizeGroup(
  sourceItems: unknown,
  group: MaimaiChartGroup,
  musicIndex: Map<string, RecordLike>
): MaimaiB50Item[] {
  return asArray(sourceItems)
    .map((item, index) => normalizeItem(item, group, index + 1, musicIndex))
    .filter((item): item is MaimaiB50Item => Boolean(item));
}

export function normalizeDivingFishB50(
  raw: unknown,
  musicData: unknown,
  options: { playerKey: string; createdAt?: string }
): MaimaiSnapshot {
  const musicIndex = buildMusicIndex(musicData);
  const charts = getCharts(raw);
  const b35 = normalizeGroup(charts.sd, "b35", musicIndex);
  const b15 = normalizeGroup(charts.dx, "b15", musicIndex);
  const b35Rating = b35.reduce((sum, item) => sum + item.ra, 0);
  const b15Rating = b15.reduce((sum, item) => sum + item.ra, 0);
  const rawRecord = isRecord(raw) ? raw : {};
  const rating = getPlayerRating(raw) || b35Rating + b15Rating;

  return {
    playerKey: options.playerKey,
    source: "diving_fish",
    nickname: asString(firstPresent(rawRecord, ["nickname", "username", "name"]), options.playerKey),
    rating,
    b35Rating,
    b15Rating,
    b35,
    b15,
    createdAt: options.createdAt ?? new Date().toISOString(),
    raw
  };
}
