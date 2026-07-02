export type MaimaiDifficulty = "Basic" | "Advanced" | "Expert" | "Master" | "Re:Master";

export type MaimaiChartGroup = "b35" | "b15";

export interface MaimaiB50Item {
  id: string;
  songId: string;
  title: string;
  artist?: string;
  type: "DX" | "SD" | string;
  difficultyIndex: number;
  difficulty: MaimaiDifficulty | string;
  level: string;
  ds: number;
  achievements: number;
  rate?: string;
  fc?: string;
  fs?: string;
  dxScore?: number;
  ra: number;
  group: MaimaiChartGroup;
  coverUrl: string;
  version?: string;
  isNew?: boolean;
  rankIndex: number;
  raw: unknown;
}

export interface MaimaiSnapshot {
  id?: string;
  playerKey: string;
  source: "diving_fish" | "lxns" | "local";
  nickname: string;
  rating: number;
  b35Rating: number;
  b15Rating: number;
  b35: MaimaiB50Item[];
  b15: MaimaiB50Item[];
  createdAt: string;
  raw: unknown;
}

export interface MaimaiFullRecordItem {
  id: string;
  songId: string;
  title: string;
  type: "DX" | "SD" | string;
  difficultyIndex: number;
  difficulty: MaimaiDifficulty | string;
  level: string;
  ds: number;
  achievements: number;
  rate?: string;
  fc?: string;
  fs?: string;
  dxScore?: number;
  ra: number;
  coverUrl: string;
  raw: unknown;
}

export interface MaimaiFullRecordsSnapshot {
  id?: string;
  playerKey: string;
  source: "diving_fish" | "lxns" | "local";
  nickname: string;
  username?: string;
  rating: number;
  plate?: string;
  additionalRating?: number;
  recordCount: number;
  records: MaimaiFullRecordItem[];
  createdAt: string;
  raw: unknown;
}

export interface MaimaiRatingPoint {
  createdAt: string;
  rating: number;
  b35Rating?: number;
  b15Rating?: number;
}

export interface MaimaiMusicCacheMeta {
  etag?: string;
  updatedAt?: string;
  source: "diving_fish";
  itemCount: number;
}

export interface MaimaiLocalStatus {
  cacheDir: string;
  latestSnapshotExists: boolean;
  latestSnapshot?: MaimaiSnapshot;
  historyCount: number;
  musicDataExists: boolean;
  musicDataMeta?: MaimaiMusicCacheMeta;
}
