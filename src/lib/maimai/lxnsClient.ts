const LXNS_BASE_URL = "https://maimai.lxns.net/api/v0";
const DEFAULT_TIMEOUT_MS = 20_000;

export class LxnsError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LxnsError";
    this.status = status;
  }
}

interface FetchOptions {
  timeoutMs?: number;
}

interface LxnsTrendOptions extends FetchOptions {
  version?: number;
}

function withTimeout(timeoutMs = DEFAULT_TIMEOUT_MS): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapLxnsPayload(payload: unknown): unknown {
  if (!isRecord(payload) || typeof payload.success !== "boolean") {
    return payload;
  }

  if (payload.success) {
    return payload.data ?? null;
  }

  const message = typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : "Lxns request failed.";

  throw new LxnsError(message, typeof payload.code === "number" ? payload.code : undefined);
}

async function fetchLxnsJson(
  path: string,
  headers: Record<string, string>,
  options: FetchOptions = {}
): Promise<unknown> {
  const timeout = withTimeout(options.timeoutMs);

  try {
    const response = await fetch(`${LXNS_BASE_URL}${path}`, {
      headers: {
        "accept": "application/json",
        "user-agent": "starsail-maimai-dashboard/0.1",
        ...headers
      },
      signal: timeout.signal
    });
    const payload = await readResponse(response);

    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : response.statusText || "Lxns request failed.";
      throw new LxnsError(`Lxns returned ${response.status}. ${message}`, response.status);
    }

    return unwrapLxnsPayload(payload);
  } catch (error) {
    if (error instanceof LxnsError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new LxnsError("Lxns 请求超时，请稍后重试。");
    }

    throw new LxnsError(error instanceof Error ? error.message : "Lxns 请求失败。");
  } finally {
    timeout.cancel();
  }
}

export async function fetchLxnsDeveloperJson(
  path: string,
  developerToken: string,
  options?: FetchOptions
): Promise<unknown> {
  const token = developerToken.trim();

  if (!token) {
    throw new LxnsError("LXNS_DEVELOPER_TOKEN 为空，无法访问 Lxns 开发者 API。");
  }

  return fetchLxnsJson(path, { Authorization: token }, options);
}

export async function fetchLxnsPublicJson(path: string, options?: FetchOptions): Promise<unknown> {
  return fetchLxnsJson(path, {}, options);
}

export async function fetchLxnsUserJson(
  path: string,
  userToken: string,
  options?: FetchOptions
): Promise<unknown> {
  const token = userToken.trim();

  if (!token) {
    throw new LxnsError("LXNS_USER_TOKEN 为空，无法访问 Lxns 个人 API。");
  }

  return fetchLxnsJson(path, { "X-User-Token": token }, options);
}

export async function fetchLxnsPlayerByQq(
  qq: string,
  developerToken: string,
  options?: FetchOptions
): Promise<unknown> {
  return fetchLxnsDeveloperJson(`/maimai/player/qq/${encodeURIComponent(qq)}`, developerToken, options);
}

export async function fetchLxnsPlayer(
  friendCode: string,
  developerToken: string,
  options?: FetchOptions
): Promise<unknown> {
  return fetchLxnsDeveloperJson(`/maimai/player/${encodeURIComponent(friendCode)}`, developerToken, options);
}

export async function fetchLxnsScores(
  friendCode: string,
  developerToken: string,
  options?: FetchOptions
): Promise<unknown> {
  return fetchLxnsDeveloperJson(`/maimai/player/${encodeURIComponent(friendCode)}/scores`, developerToken, options);
}

export async function fetchLxnsTrend(
  friendCode: string,
  developerToken: string,
  options?: LxnsTrendOptions
): Promise<unknown> {
  const query = typeof options?.version === "number"
    ? `?version=${encodeURIComponent(String(options.version))}`
    : "";

  return fetchLxnsDeveloperJson(`/maimai/player/${encodeURIComponent(friendCode)}/trend${query}`, developerToken, options);
}

export async function fetchLxnsScoreHistory(
  friendCode: string,
  developerToken: string,
  options?: FetchOptions
): Promise<unknown> {
  return fetchLxnsDeveloperJson(`/maimai/player/${encodeURIComponent(friendCode)}/score/history`, developerToken, options);
}

export async function fetchLxnsUserPlayer(userToken: string, options?: FetchOptions): Promise<unknown> {
  return fetchLxnsUserJson("/user/maimai/player", userToken, options);
}

export async function fetchLxnsUserScores(userToken: string, options?: FetchOptions): Promise<unknown> {
  return fetchLxnsUserJson("/user/maimai/player/scores", userToken, options);
}

export async function fetchLxnsSongList(options?: FetchOptions): Promise<unknown> {
  return fetchLxnsPublicJson("/maimai/song/list", options);
}
