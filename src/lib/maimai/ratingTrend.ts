import type { MaimaiRatingPoint } from "./types";

export interface MaimaiHistoricalRatingPoint extends MaimaiRatingPoint {
  playerKey: string;
  source: "lxns" | "manual";
  sourcePointId?: string;
  raw: unknown;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function unwrapItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ["records", "trend", "items", "data", "list"]) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function readNumber(record: RecordLike, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return Math.trunc(parsed);
      }
    }
  }

  return undefined;
}

function readString(record: RecordLike, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  const dateOnly = /^\d{4}-\d{1,2}-\d{1,2}$/.test(value) ? value : null;
  return dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`).toISOString() : null;
}

export function normalizeLxnsRatingTrend(
  payload: unknown,
  options: {
    playerKey: string;
  }
): MaimaiHistoricalRatingPoint[] {
  const points: MaimaiHistoricalRatingPoint[] = [];

  unwrapItems(payload).forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const rating = readNumber(item, ["rating", "total", "total_rating", "dx_rating_total"]);
    const createdAt = normalizeDate(readString(item, [
      "date",
      "created_at",
      "createdAt",
      "upload_time",
      "uploadTime",
      "play_time",
      "playTime"
    ]));

    if (rating === undefined || !createdAt) {
      return;
    }

    const standardRating = readNumber(item, ["standard_rating", "standard_total", "standard", "sd", "b35_rating"]);
    const dxRating = readNumber(item, ["dx_rating", "dx_total", "dx", "b15_rating"]);
    const version = readString(item, ["lxns_version", "version"]);
    const sourcePointId = readString(item, ["id", "uuid"]) ?? `${version ?? "unknown"}:${createdAt}:${index}`;

    points.push({
      playerKey: options.playerKey,
      source: "lxns",
      sourcePointId,
      createdAt,
      rating,
      standardRating,
      dxRating,
      raw: item
    });
  });

  return points.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
