import type { MaimaiB50Item, MaimaiSnapshot } from "./types";

const RANK_LINES = [100.5, 100, 99.5, 99];

export function getNearRankUpItems(snapshot: MaimaiSnapshot, limit = 6): MaimaiB50Item[] {
  return allItems(snapshot)
    .map((item) => {
      const nextLine = RANK_LINES.find((line) => item.achievements < line);
      return {
        item,
        gap: nextLine === undefined ? Number.POSITIVE_INFINITY : nextLine - item.achievements
      };
    })
    .filter(({ gap }) => gap > 0 && gap <= 0.35)
    .sort((a, b) => a.gap - b.gap || b.item.ra - a.item.ra)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getBorderItems(snapshot: MaimaiSnapshot, limit = 10): MaimaiB50Item[] {
  return [
    ...snapshot.b35.slice(-Math.ceil(limit / 2)),
    ...snapshot.b15.slice(-Math.floor(limit / 2))
  ].sort((a, b) => a.ra - b.ra);
}

export function getHighValuePracticeItems(snapshot: MaimaiSnapshot, limit = 6): MaimaiB50Item[] {
  const items = allItems(snapshot);
  const averageAchievement = items.reduce((sum, item) => sum + item.achievements, 0) / Math.max(1, items.length);

  return items
    .filter((item) => item.ds >= 12 && item.achievements < averageAchievement - 0.45)
    .sort((a, b) => b.ds - a.ds || a.achievements - b.achievements)
    .slice(0, limit);
}

function allItems(snapshot: MaimaiSnapshot): MaimaiB50Item[] {
  return [...snapshot.b35, ...snapshot.b15];
}
