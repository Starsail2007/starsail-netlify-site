import { getRatingHistoryLocal } from "../../src/lib/maimai/localStore";
import { canUseMaimaiRemoteStorage, getMaimaiRatingHistory } from "../../src/lib/maimai/storage";
import { getMaimaiIdentity } from "./env";

export async function runHistory(options: { limit?: number } = {}): Promise<void> {
  const limit = options.limit ?? 20;
  let source = "local";
  let points = [];

  if (canUseMaimaiRemoteStorage()) {
    try {
      const identity = getMaimaiIdentity();
      points = await getMaimaiRatingHistory(identity.playerKey, limit);
      source = "supabase";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[maimai:history] Supabase read failed, using local fallback. ${message}`);
      points = await getRatingHistoryLocal(limit);
    }
  } else {
    points = await getRatingHistoryLocal(limit);
  }

  if (points.length === 0) {
    console.log("暂无本地 Rating 历史。请先运行 pnpm maimai:update。");
    return;
  }

  console.log(`最近 ${points.length} 条 Rating 快照（${source}）：`);

  for (const point of points) {
    const b35 = point.b35Rating ?? 0;
    const b15 = point.b15Rating ?? 0;
    console.log(`${point.createdAt}  rating=${point.rating}  b35=${b35}  b15=${b15}`);
  }
}
