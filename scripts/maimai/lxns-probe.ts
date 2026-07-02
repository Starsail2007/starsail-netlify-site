import {
  fetchLxnsPlayer,
  fetchLxnsPlayerByQq,
  fetchLxnsScoreHistory,
  fetchLxnsScores,
  fetchLxnsTrend,
  fetchLxnsUserPlayer,
  fetchLxnsUserScores
} from "../../src/lib/maimai/lxnsClient";
import { getMaimaiIdentity } from "./env";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function readDeveloperToken(): string {
  return process.env.LXNS_DEVELOPER_TOKEN?.trim() || process.env.LXNS_TOKEN?.trim() || "";
}

function getFriendCodeFromPlayer(player: unknown): string {
  if (!isRecord(player)) {
    return "";
  }

  return asString(player.friend_code);
}

function getPlayerLabel(player: unknown): string {
  if (!isRecord(player)) {
    return "unknown";
  }

  const name = asString(player.name, "unknown");
  const rating = asString(player.rating, "n/a");
  const friendCode = asString(player.friend_code, "n/a");
  const uploadTime = asString(player.upload_time, "n/a");

  return `${name}, rating ${rating}, friendCode ${friendCode}, upload ${uploadTime}`;
}

function countPlayTimeItems(items: unknown[]): number {
  return items.filter((item) => isRecord(item) && typeof item.play_time === "string" && item.play_time).length;
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
  const friendCode = getFriendCodeFromPlayer(player);

  if (!friendCode) {
    throw new Error("Lxns QQ 查询成功，但响应里没有 friend_code。");
  }

  console.log(`[maimai:lxns-probe] resolved QQ ${identity.qq} -> friendCode ${friendCode}`);
  return friendCode;
}

async function runDeveloperProbe(args: string[]): Promise<void> {
  const developerToken = readDeveloperToken();

  if (!developerToken) {
    throw new Error("缺少 LXNS_DEVELOPER_TOKEN。若只想查个人 API，请配置 LXNS_USER_TOKEN 并使用 --mode user。");
  }

  const friendCode = await resolveFriendCode(developerToken, args);
  const [player, scores, trend, history] = await Promise.all([
    fetchLxnsPlayer(friendCode, developerToken),
    fetchLxnsScores(friendCode, developerToken),
    fetchLxnsTrend(friendCode, developerToken),
    hasFlag(args, "--skip-history") ? Promise.resolve([]) : fetchLxnsScoreHistory(friendCode, developerToken)
  ]);
  const scoreItems = asArray(scores);
  const trendItems = asArray(trend);
  const historyItems = asArray(history);

  console.log("[maimai:lxns-probe] developer API probe");
  console.log(`player: ${getPlayerLabel(player)}`);
  console.log(`scores: ${scoreItems.length}`);
  console.log(`trend points: ${trendItems.length}`);
  console.log(`history records: ${historyItems.length}`);
  console.log(`history records with play_time: ${countPlayTimeItems(historyItems)}`);

  const firstTrend = trendItems[0];
  const lastTrend = trendItems[trendItems.length - 1];

  if (firstTrend || lastTrend) {
    console.log(`trend range: ${JSON.stringify(firstTrend)} -> ${JSON.stringify(lastTrend)}`);
  }
}

async function runUserProbe(): Promise<void> {
  const userToken = process.env.LXNS_USER_TOKEN?.trim();

  if (!userToken) {
    throw new Error("缺少 LXNS_USER_TOKEN。");
  }

  const [player, scores] = await Promise.all([
    fetchLxnsUserPlayer(userToken),
    fetchLxnsUserScores(userToken)
  ]);
  const scoreItems = asArray(scores);

  console.log("[maimai:lxns-probe] personal API probe");
  console.log(`player: ${getPlayerLabel(player)}`);
  console.log(`scores: ${scoreItems.length}`);
  console.log(`scores with play_time: ${countPlayTimeItems(scoreItems)}`);
}

export async function runLxnsProbe(args: string[] = []): Promise<void> {
  const mode = getFlagValue(args, "--mode") ?? (process.env.LXNS_USER_TOKEN?.trim() ? "user" : "developer");

  if (mode === "user") {
    await runUserProbe();
    return;
  }

  if (mode === "developer") {
    await runDeveloperProbe(args);
    return;
  }

  throw new Error("未知 Lxns probe mode。可用值：developer 或 user。");
}
