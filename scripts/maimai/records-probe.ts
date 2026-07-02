import {
  fetchDivingFishFullRecordsWithDeveloperToken,
  fetchDivingFishFullRecordsWithImportToken,
  fetchDivingFishTestRecords
} from "../../src/lib/maimai/divingFishClient";
import { normalizeDivingFishFullRecords } from "../../src/lib/maimai/fullRecords";
import type { MaimaiFullRecordItem } from "../../src/lib/maimai/types";
import { getMaimaiIdentity } from "./env";

type ProbeSource = "import-token" | "developer-token" | "test-data";

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

function readLimit(args: string[]): number {
  const parsed = Number(getFlagValue(args, "--limit"));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(20, Math.trunc(parsed)) : 5;
}

function pickSource(args: string[]): ProbeSource {
  const explicitSource = getFlagValue(args, "--source");

  if (explicitSource === "import-token" || explicitSource === "developer-token" || explicitSource === "test-data") {
    return explicitSource;
  }

  if (hasFlag(args, "--test-data")) {
    return "test-data";
  }

  if (process.env.DIVING_FISH_IMPORT_TOKEN?.trim()) {
    return "import-token";
  }

  if (process.env.DIVING_FISH_DEVELOPER_TOKEN?.trim()) {
    return "developer-token";
  }

  return "test-data";
}

async function fetchRawRecords(source: ProbeSource): Promise<{ raw: unknown; playerKey: string; sourceLabel: string; usingRealPlayer: boolean }> {
  if (source === "import-token") {
    const raw = await fetchDivingFishFullRecordsWithImportToken(process.env.DIVING_FISH_IMPORT_TOKEN ?? "");
    const identity = getMaimaiIdentity();

    return {
      raw,
      playerKey: identity.playerKey,
      sourceLabel: "Diving-Fish Import-Token",
      usingRealPlayer: true
    };
  }

  if (source === "developer-token") {
    const identity = getMaimaiIdentity();
    const raw = await fetchDivingFishFullRecordsWithDeveloperToken({
      developerToken: process.env.DIVING_FISH_DEVELOPER_TOKEN ?? "",
      username: identity.username,
      qq: identity.qq
    });

    return {
      raw,
      playerKey: identity.playerKey,
      sourceLabel: "Diving-Fish Developer-Token",
      usingRealPlayer: true
    };
  }

  return {
    raw: await fetchDivingFishTestRecords(),
    playerKey: "diving-fish:test-data",
    sourceLabel: "Diving-Fish public test_data",
    usingRealPlayer: false
  };
}

function countBy(records: MaimaiFullRecordItem[], getKey: (record: MaimaiFullRecordItem) => string): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const record of records) {
    const key = getKey(record) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatCounts(counts: Array<[string, number]>): string {
  return counts.map(([key, count]) => `${key}:${count}`).join(", ");
}

function printTopRecords(records: MaimaiFullRecordItem[], limit: number): void {
  const top = [...records]
    .sort((a, b) => b.ra - a.ra || b.achievements - a.achievements)
    .slice(0, limit);

  for (const [index, record] of top.entries()) {
    console.log(
      `${index + 1}. ${record.title} [${record.type} ${record.difficulty}] ` +
      `${record.achievements.toFixed(4)}% ra ${record.ra} ds ${record.ds}`
    );
  }
}

export async function runRecordsProbe(args: string[] = []): Promise<void> {
  const source = pickSource(args);
  const limit = readLimit(args);
  const { raw, playerKey, sourceLabel, usingRealPlayer } = await fetchRawRecords(source);
  const snapshot = normalizeDivingFishFullRecords(raw, { playerKey });

  console.log("[maimai:records-probe] complete records probe");
  console.log(`source: ${sourceLabel}`);
  console.log(`mode: ${usingRealPlayer ? "real player data" : "public test data; set DIVING_FISH_IMPORT_TOKEN for your records"}`);
  console.log(`playerKey: ${snapshot.playerKey}`);
  console.log(`nickname: ${snapshot.nickname}`);
  console.log(`username: ${snapshot.username ?? "n/a"}`);
  console.log(`rating: ${snapshot.rating}`);
  console.log(`plate: ${snapshot.plate ?? "n/a"}`);
  console.log(`records: ${snapshot.recordCount}`);
  console.log(`types: ${formatCounts(countBy(snapshot.records, (record) => record.type))}`);
  console.log(`difficulties: ${formatCounts(countBy(snapshot.records, (record) => record.difficulty))}`);
  console.log("\n[maimai:records-probe] top records");
  printTopRecords(snapshot.records, limit);
}
