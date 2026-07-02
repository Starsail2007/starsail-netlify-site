export interface MaimaiIdentity {
  username?: string;
  qq?: string;
  playerKey: string;
  label: string;
}

export function getMaimaiIdentityFromEnv(env: NodeJS.ProcessEnv = process.env): MaimaiIdentity {
  const username = env.MAIMAI_USERNAME?.trim();
  const qq = env.MAIMAI_QQ?.trim();

  if (qq) {
    return {
      username,
      qq,
      playerKey: `qq:${qq}`,
      label: `QQ ${qq}`
    };
  }

  if (username) {
    return {
      username,
      playerKey: username,
      label: username
    };
  }

  throw new Error("缺少 MAIMAI_USERNAME 或 MAIMAI_QQ。");
}

export function readPositiveLimit(value: string | null | undefined, fallback = 20, max = 500): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, Math.trunc(parsed));
}
