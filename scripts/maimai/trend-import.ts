import { fetchLxnsPlayerByQq, fetchLxnsSongList, fetchLxnsTrend, LxnsError } from "../../src/lib/maimai/lxnsClient";
import { normalizeLxnsRatingTrend } from "../../src/lib/maimai/ratingTrend";
import {
  canUseMaimaiRemoteStorage,
  saveMaimaiHistoricalRatingPoints,
  saveUpdateLog
} from "../../src/lib/maimai/storage";
import { getMaimaiIdentity } from "./env";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readDeveloperToken(): string {
  return process.env.LXNS_DEVELOPER_TOKEN?.trim() || process.env.LXNS_TOKEN?.trim() || "";
}

function getFlagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

function readFriendCode(player: unknown): string {
  if (!isRecord(player)) {
    return "";
  }

  const value = player.friend_code;
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function unwrapItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ["versions", "items", "data", "list"]) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function tagTrendItems(payload: unknown, version: number): unknown[] {
  return unwrapItems(payload).map((item) => {
    if (!isRecord(item)) {
      return item;
    }

    return {
      ...item,
      lxns_version: version
    };
  });
}

async function resolveTrendVersions(args: string[]): Promise<number[]> {
  const explicit = readNumber(getFlagValue(args, "--version"));

  if (explicit) {
    return [explicit];
  }

  try {
    const songList = await fetchLxnsSongList();
    const versions = unwrapItems(songList)
      .map((item) => isRecord(item) ? readNumber(item.version) : null)
      .filter((version): version is number => Boolean(version && version >= 20000))
      .sort((a, b) => a - b);

    return versions.length > 0 ? versions : [25500];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[maimai:trend-import] failed to load Lxns version list, using 25500 only. ${message}`);
    return [25500];
  }
}

async function fetchAllTrendItems(friendCode: string, developerToken: string, args: string[]): Promise<unknown[]> {
  const versions = await resolveTrendVersions(args);
  const items: unknown[] = [];

  for (const version of versions) {
    try {
      const payload = await fetchLxnsTrend(friendCode, developerToken, { version });
      const versionItems = tagTrendItems(payload, version);
      console.log(`[maimai:trend-import] version ${version}: ${versionItems.length} point(s)`);
      items.push(...versionItems);
    } catch (error) {
      if (error instanceof LxnsError && error.status && error.status >= 500) {
        console.warn(`[maimai:trend-import] version ${version}: skipped Lxns ${error.status}`);
        continue;
      }

      throw error;
    }
  }

  return items;
}

async function resolveFriendCode(developerToken: string, args: string[]): Promise<string> {
  const explicit = getFlagValue(args, "--friend-code") ?? process.env.LXNS_FRIEND_CODE?.trim();

  if (explicit) {
    return explicit;
  }

  const identity = getMaimaiIdentity();

  if (!identity.qq) {
    throw new Error("缺少 LXNS_FRIEND_CODE；没有好友码时需要 MAIMAI_QQ 用于 Lxns QQ 查询。");
  }

  const player = await fetchLxnsPlayerByQq(identity.qq, developerToken);
  const friendCode = readFriendCode(player);

  if (!friendCode) {
    throw new Error("Lxns QQ 查询成功，但响应里没有 friend_code。");
  }

  console.log(`[maimai:trend-import] resolved QQ ${identity.qq} -> friendCode ${friendCode}`);
  return friendCode;
}

export async function runTrendImport(args: string[] = []): Promise<void> {
  const developerToken = readDeveloperToken();

  if (!developerToken) {
    throw new Error("缺少 LXNS_DEVELOPER_TOKEN。历史 rating 曲线需要 Lxns 开发者 token 和历史权限。");
  }

  const identity = getMaimaiIdentity();
  const friendCode = await resolveFriendCode(developerToken, args);
  const rawTrend = await fetchAllTrendItems(friendCode, developerToken, args);
  const points = normalizeLxnsRatingTrend(rawTrend, {
    playerKey: identity.playerKey
  });

  console.log(`[maimai:trend-import] fetched ${points.length} rating trend points`);

  if (points.length > 0) {
    const first = points[0];
    const last = points[points.length - 1];
    console.log(`range: ${first.createdAt.slice(0, 10)} ${first.rating} -> ${last.createdAt.slice(0, 10)} ${last.rating}`);
  }

  if (hasFlag(args, "--dry-run")) {
    console.log("supabase: skipped (--dry-run)");
    return;
  }

  if (!canUseMaimaiRemoteStorage()) {
    throw new Error("Supabase 未配置，无法保存历史 rating 曲线。");
  }

  const saved = await saveMaimaiHistoricalRatingPoints(points);

  await saveUpdateLog({
    playerKey: identity.playerKey,
    source: "lxns",
    status: "success",
    message: `Imported ${saved.count} Lxns rating trend points.`,
    ratingBefore: points[0]?.rating ?? null,
    ratingAfter: points[points.length - 1]?.rating ?? null,
    changedItems: saved.count
  });

  console.log(`supabase: saved ${saved.count} trend points`);
}
