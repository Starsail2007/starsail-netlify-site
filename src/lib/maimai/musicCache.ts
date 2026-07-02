import { fetchDivingFishMusicData } from "./divingFishClient";
import {
  getMusicDataLocal,
  getMusicMetaLocal,
  saveMusicDataLocal,
  saveMusicMetaLocal
} from "./localStore";
import type { MaimaiMusicCacheMeta } from "./types";

function countMusicItems(data: unknown): number {
  return Array.isArray(data) ? data.length : 0;
}

export async function refreshDivingFishMusicCache(options: {
  force?: boolean;
  cacheDir?: string;
} = {}): Promise<{
  status: "updated" | "not-modified";
  data: unknown;
  meta: MaimaiMusicCacheMeta;
  dataPath?: string;
  metaPath?: string;
}> {
  const currentMeta = await getMusicMetaLocal(options.cacheDir);
  const response = await fetchDivingFishMusicData({
    etag: options.force ? undefined : currentMeta?.etag
  });

  if (response.status === 304) {
    const currentData = await getMusicDataLocal(options.cacheDir);

    if (!currentData) {
      return refreshDivingFishMusicCache({ ...options, force: true });
    }

    const meta: MaimaiMusicCacheMeta = {
      source: "diving_fish",
      itemCount: countMusicItems(currentData),
      etag: response.etag ?? currentMeta?.etag,
      updatedAt: currentMeta?.updatedAt ?? new Date().toISOString()
    };

    const metaPath = await saveMusicMetaLocal(meta, options.cacheDir);
    return { status: "not-modified", data: currentData, meta, metaPath };
  }

  const data = response.data;
  const meta: MaimaiMusicCacheMeta = {
    source: "diving_fish",
    itemCount: countMusicItems(data),
    etag: response.etag,
    updatedAt: new Date().toISOString()
  };
  const paths = await saveMusicDataLocal(data, meta, options.cacheDir);

  return {
    status: "updated",
    data,
    meta,
    dataPath: paths.dataPath,
    metaPath: paths.metaPath
  };
}
