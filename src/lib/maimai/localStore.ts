import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  MaimaiFullRecordsSnapshot,
  MaimaiLocalStatus,
  MaimaiMusicCacheMeta,
  MaimaiRatingPoint,
  MaimaiSnapshot
} from "./types";

const DEFAULT_CACHE_DIR = "src/data/maimai";
const DEFAULT_EXPORT_DIR = "exports/maimai";

export const MAIMAI_LATEST_FILE = "latest.snapshot.json";
export const MAIMAI_HISTORY_FILE = "history.snapshots.json";
export const MAIMAI_LATEST_FULL_RECORDS_FILE = "latest.full-records.json";
export const MAIMAI_FULL_RECORDS_HISTORY_FILE = "history.full-records.json";
export const MAIMAI_MUSIC_DATA_FILE = "music-data.json";
export const MAIMAI_MUSIC_META_FILE = "music-data.meta.json";

export function getMaimaiLocalCacheDir(): string {
  return path.resolve(process.cwd(), process.env.MAIMAI_LOCAL_CACHE_DIR || DEFAULT_CACHE_DIR);
}

function resolveCacheFile(fileName: string, cacheDir = getMaimaiLocalCacheDir()): string {
  return path.join(cacheDir, fileName);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getLatestSnapshot(cacheDir = getMaimaiLocalCacheDir()): Promise<MaimaiSnapshot | null> {
  return readJsonFile<MaimaiSnapshot>(resolveCacheFile(MAIMAI_LATEST_FILE, cacheDir));
}

export async function getSnapshotHistory(cacheDir = getMaimaiLocalCacheDir()): Promise<MaimaiSnapshot[]> {
  const history = await readJsonFile<MaimaiSnapshot[]>(resolveCacheFile(MAIMAI_HISTORY_FILE, cacheDir));
  return Array.isArray(history) ? history : [];
}

export async function saveMaimaiSnapshotLocal(
  snapshot: MaimaiSnapshot,
  cacheDir = getMaimaiLocalCacheDir()
): Promise<{ latestPath: string; historyPath: string; previous: MaimaiSnapshot | null; historyCount: number }> {
  const latestPath = resolveCacheFile(MAIMAI_LATEST_FILE, cacheDir);
  const historyPath = resolveCacheFile(MAIMAI_HISTORY_FILE, cacheDir);
  const previous = await getLatestSnapshot(cacheDir);
  const history = await getSnapshotHistory(cacheDir);
  const nextHistory = [snapshot, ...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  await writeJsonFile(latestPath, snapshot);
  await writeJsonFile(historyPath, nextHistory);

  return {
    latestPath,
    historyPath,
    previous,
    historyCount: nextHistory.length
  };
}

export async function getLatestFullRecordsSnapshot(
  cacheDir = getMaimaiLocalCacheDir()
): Promise<MaimaiFullRecordsSnapshot | null> {
  return readJsonFile<MaimaiFullRecordsSnapshot>(resolveCacheFile(MAIMAI_LATEST_FULL_RECORDS_FILE, cacheDir));
}

export async function getFullRecordsSnapshotHistory(
  cacheDir = getMaimaiLocalCacheDir()
): Promise<MaimaiFullRecordsSnapshot[]> {
  const history = await readJsonFile<MaimaiFullRecordsSnapshot[]>(
    resolveCacheFile(MAIMAI_FULL_RECORDS_HISTORY_FILE, cacheDir)
  );
  return Array.isArray(history) ? history : [];
}

export async function saveMaimaiFullRecordsSnapshotLocal(
  snapshot: MaimaiFullRecordsSnapshot,
  cacheDir = getMaimaiLocalCacheDir()
): Promise<{ latestPath: string; historyPath: string; previous: MaimaiFullRecordsSnapshot | null; historyCount: number }> {
  const latestPath = resolveCacheFile(MAIMAI_LATEST_FULL_RECORDS_FILE, cacheDir);
  const historyPath = resolveCacheFile(MAIMAI_FULL_RECORDS_HISTORY_FILE, cacheDir);
  const previous = await getLatestFullRecordsSnapshot(cacheDir);
  const history = await getFullRecordsSnapshotHistory(cacheDir);
  const nextHistory = [snapshot, ...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  await writeJsonFile(latestPath, snapshot);
  await writeJsonFile(historyPath, nextHistory);

  return {
    latestPath,
    historyPath,
    previous,
    historyCount: nextHistory.length
  };
}

export async function getRatingHistoryLocal(
  limit = 20,
  cacheDir = getMaimaiLocalCacheDir()
): Promise<MaimaiRatingPoint[]> {
  const history = await getSnapshotHistory(cacheDir);

  return history
    .slice(0, Math.max(1, limit))
    .map((snapshot) => ({
      createdAt: snapshot.createdAt,
      rating: snapshot.rating,
      b35Rating: snapshot.b35Rating,
      b15Rating: snapshot.b15Rating
    }));
}

export async function getMusicDataLocal(cacheDir = getMaimaiLocalCacheDir()): Promise<unknown | null> {
  return readJsonFile<unknown>(resolveCacheFile(MAIMAI_MUSIC_DATA_FILE, cacheDir));
}

export async function getMusicMetaLocal(cacheDir = getMaimaiLocalCacheDir()): Promise<MaimaiMusicCacheMeta | null> {
  return readJsonFile<MaimaiMusicCacheMeta>(resolveCacheFile(MAIMAI_MUSIC_META_FILE, cacheDir));
}

export async function saveMusicDataLocal(
  data: unknown,
  meta: MaimaiMusicCacheMeta,
  cacheDir = getMaimaiLocalCacheDir()
): Promise<{ dataPath: string; metaPath: string }> {
  const dataPath = resolveCacheFile(MAIMAI_MUSIC_DATA_FILE, cacheDir);
  const metaPath = resolveCacheFile(MAIMAI_MUSIC_META_FILE, cacheDir);

  await writeJsonFile(dataPath, data);
  await writeJsonFile(metaPath, meta);

  return { dataPath, metaPath };
}

export async function saveMusicMetaLocal(
  meta: MaimaiMusicCacheMeta,
  cacheDir = getMaimaiLocalCacheDir()
): Promise<string> {
  const metaPath = resolveCacheFile(MAIMAI_MUSIC_META_FILE, cacheDir);
  await writeJsonFile(metaPath, meta);
  return metaPath;
}

export async function getMaimaiLocalStatus(cacheDir = getMaimaiLocalCacheDir()): Promise<MaimaiLocalStatus> {
  const latestPath = resolveCacheFile(MAIMAI_LATEST_FILE, cacheDir);
  const musicPath = resolveCacheFile(MAIMAI_MUSIC_DATA_FILE, cacheDir);
  const [latestSnapshotExists, musicDataExists, latestSnapshot, history, musicDataMeta] = await Promise.all([
    fileExists(latestPath),
    fileExists(musicPath),
    getLatestSnapshot(cacheDir),
    getSnapshotHistory(cacheDir),
    getMusicMetaLocal(cacheDir)
  ]);

  return {
    cacheDir,
    latestSnapshotExists,
    latestSnapshot: latestSnapshot ?? undefined,
    historyCount: history.length,
    musicDataExists,
    musicDataMeta: musicDataMeta ?? undefined
  };
}

export async function exportLatestSnapshotLocal(
  outputDir = path.resolve(process.cwd(), DEFAULT_EXPORT_DIR),
  cacheDir = getMaimaiLocalCacheDir()
): Promise<string> {
  const latest = resolveCacheFile(MAIMAI_LATEST_FILE, cacheDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `maimai-snapshot-${timestamp}.json`);

  await mkdir(outputDir, { recursive: true });
  await copyFile(latest, outputPath);

  return outputPath;
}
