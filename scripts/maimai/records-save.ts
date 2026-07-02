import { saveMaimaiFullRecordsSnapshotLocal } from "../../src/lib/maimai/localStore";
import {
  fetchMaimaiFullRecordsSnapshot,
  saveRemoteMaimaiFullRecordsUpdate
} from "../../src/lib/maimai/updateService";
import { canUseMaimaiRemoteStorage } from "../../src/lib/maimai/storage";
import { getMaimaiIdentity } from "./env";

export async function runRecordsSave(): Promise<void> {
  const identity = getMaimaiIdentity();

  console.log(`[maimai:records-save] fetching complete records for ${identity.label}`);
  const snapshot = await fetchMaimaiFullRecordsSnapshot(identity);
  const local = await saveMaimaiFullRecordsSnapshotLocal(snapshot);
  let remoteStatus = "skipped";

  console.log(`nickname: ${snapshot.nickname}`);
  console.log(`username: ${snapshot.username ?? "n/a"}`);
  console.log(`rating: ${snapshot.rating}`);
  console.log(`records: ${snapshot.recordCount}`);
  console.log(`saved latest full records: ${local.latestPath}`);
  console.log(`saved full records history: ${local.historyPath} (${local.historyCount} total)`);

  if (canUseMaimaiRemoteStorage()) {
    try {
      const remote = await saveRemoteMaimaiFullRecordsUpdate(snapshot);
      const changed = remote.changedItems === null ? "n/a" : String(remote.changedItems);
      remoteStatus = `saved (${remote.id}, changed ${changed})`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      remoteStatus = `failed: ${message}`;
      console.warn(`[maimai:records-save] Supabase save failed. ${message}`);
    }
  }

  console.log(`supabase: ${remoteStatus}`);
}
