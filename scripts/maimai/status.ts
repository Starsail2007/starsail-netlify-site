import { getMaimaiLocalStatus } from "../../src/lib/maimai/localStore";
import { canUseMaimaiRemoteStorage, getLatestMaimaiSnapshot } from "../../src/lib/maimai/storage";
import { getEnvPresence } from "./env";
import { getMaimaiIdentity } from "./env";

export async function runStatus(): Promise<void> {
  const status = await getMaimaiLocalStatus();

  console.log("[maimai:status] environment");
  for (const item of getEnvPresence()) {
    const privateLabel = item.private ? " (private)" : "";
    console.log(`- ${item.key}${privateLabel}: ${item.present ? "set" : "missing"}`);
  }

  console.log("\n[maimai:status] local cache");
  console.log(`cacheDir: ${status.cacheDir}`);
  console.log(`latest snapshot: ${status.latestSnapshotExists ? "exists" : "missing"}`);
  console.log(`history snapshots: ${status.historyCount}`);
  console.log(`music data: ${status.musicDataExists ? "exists" : "missing"}`);

  if (status.latestSnapshot) {
    console.log("\n[maimai:status] latest snapshot");
    console.log(`nickname: ${status.latestSnapshot.nickname}`);
    console.log(`rating: ${status.latestSnapshot.rating}`);
    console.log(`b35: ${status.latestSnapshot.b35.length} items, rating ${status.latestSnapshot.b35Rating}`);
    console.log(`b15: ${status.latestSnapshot.b15.length} items, rating ${status.latestSnapshot.b15Rating}`);
    console.log(`createdAt: ${status.latestSnapshot.createdAt}`);
  }

  if (status.musicDataMeta) {
    console.log("\n[maimai:status] music cache");
    console.log(`items: ${status.musicDataMeta.itemCount}`);
    console.log(`etag: ${status.musicDataMeta.etag ?? "n/a"}`);
    console.log(`updatedAt: ${status.musicDataMeta.updatedAt ?? "n/a"}`);
  }

  console.log("\n[maimai:status] supabase");

  if (!canUseMaimaiRemoteStorage()) {
    console.log("remote storage: not configured");
    return;
  }

  try {
    const identity = getMaimaiIdentity();
    const latest = await getLatestMaimaiSnapshot(identity.playerKey);

    if (!latest) {
      console.log("remote latest snapshot: missing");
      return;
    }

    console.log("remote storage: configured");
    console.log(`remote latest: ${latest.createdAt}`);
    console.log(`remote rating: ${latest.rating}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`remote storage: failed (${message})`);
  }
}
