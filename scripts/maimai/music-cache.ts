import { refreshDivingFishMusicCache } from "../../src/lib/maimai/musicCache";

export async function runMusicCache(options: { force?: boolean } = {}): Promise<void> {
  const result = await refreshDivingFishMusicCache({ force: options.force });

  if (result.status === "not-modified") {
    console.log("曲库缓存已是最新。");
  } else {
    console.log("曲库缓存已更新。");
  }

  console.log(`items: ${result.meta.itemCount}`);
  console.log(`etag: ${result.meta.etag ?? "n/a"}`);
  console.log(`updatedAt: ${result.meta.updatedAt ?? "n/a"}`);

  if (result.dataPath) {
    console.log(`data: ${result.dataPath}`);
  }

  if (result.metaPath) {
    console.log(`meta: ${result.metaPath}`);
  }
}
