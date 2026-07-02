export const DEFAULT_COVER_URL = "/assets/maimai/default-cover.png";

export function getCoverId(songId: number | string): string {
  let id = Number(songId);

  if (!Number.isFinite(id) || id <= 0) {
    return "00000";
  }

  if (id > 10000 && id <= 11000) {
    id -= 10000;
  }

  return String(Math.trunc(id)).padStart(5, "0");
}

export function getCoverUrl(songId: number | string): string {
  const coverId = getCoverId(songId);

  if (coverId === "00000") {
    return DEFAULT_COVER_URL;
  }

  return `https://www.diving-fish.com/covers/${coverId}.png`;
}
