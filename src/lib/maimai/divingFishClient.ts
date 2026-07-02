const DIVING_FISH_BASE_URL = "https://www.diving-fish.com/api/maimaidxprober";
const DEFAULT_TIMEOUT_MS = 20_000;

export class DivingFishError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DivingFishError";
    this.status = status;
  }
}

interface FetchOptions {
  timeoutMs?: number;
}

function withTimeout(timeoutMs = DEFAULT_TIMEOUT_MS): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout)
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");

  if (!text) {
    return response.statusText || "Unknown error";
  }

  try {
    const json = JSON.parse(text) as { message?: unknown; detail?: unknown; error?: unknown };
    const message = json.message ?? json.detail ?? json.error;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  } catch {
    // Plain-text API errors are common enough here; fall through to the raw text.
  }

  return text.slice(0, 400);
}

function explainStatus(status: number, message: string): string {
  if (status === 400) {
    return `Diving-Fish returned 400. 用户不存在、查询参数错误，或水鱼暂时没有该玩家数据。${message ? ` Detail: ${message}` : ""}`;
  }

  if (status === 403) {
    return `Diving-Fish returned 403. 可能是用户设置了隐私或未同意水鱼协议。${message ? ` Detail: ${message}` : ""}`;
  }

  if (status >= 500) {
    return `Diving-Fish returned ${status}. 第三方服务暂时不可用。${message ? ` Detail: ${message}` : ""}`;
  }

  return `Diving-Fish returned ${status}. ${message}`;
}

export async function fetchDivingFishB50(
  params: { username?: string; qq?: string },
  options: FetchOptions = {}
): Promise<unknown> {
  const username = params.username?.trim();
  const qq = params.qq?.trim();

  if (!username && !qq) {
    throw new DivingFishError("MAIMAI_USERNAME 或 MAIMAI_QQ 至少需要配置一个。");
  }

  const body: Record<string, string> = { b50: "1" };

  if (qq) {
    body.qq = qq;
  } else if (username) {
    body.username = username;
  }

  const timeout = withTimeout(options.timeoutMs);

  try {
    const response = await fetch(`${DIVING_FISH_BASE_URL}/query/player`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "starsail-maimai-dashboard/0.1"
      },
      body: JSON.stringify(body),
      signal: timeout.signal
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new DivingFishError(explainStatus(response.status, message), response.status);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DivingFishError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DivingFishError("Diving-Fish 请求超时，请稍后重试。");
    }

    throw new DivingFishError(error instanceof Error ? error.message : "Diving-Fish 请求失败。");
  } finally {
    timeout.cancel();
  }
}

export async function fetchDivingFishFullRecordsWithImportToken(
  importToken: string,
  options: FetchOptions = {}
): Promise<unknown> {
  const token = importToken.trim();

  if (!token) {
    throw new DivingFishError("DIVING_FISH_IMPORT_TOKEN 为空，无法获取完整成绩。");
  }

  return fetchDivingFishGetJson("/player/records", {
    "Import-Token": token
  }, options);
}

export async function fetchDivingFishFullRecordsWithDeveloperToken(
  params: { developerToken: string; username?: string; qq?: string },
  options: FetchOptions = {}
): Promise<unknown> {
  const token = params.developerToken.trim();
  const username = params.username?.trim();
  const qq = params.qq?.trim();

  if (!token) {
    throw new DivingFishError("DIVING_FISH_DEVELOPER_TOKEN 为空，无法获取完整成绩。");
  }

  if (!username && !qq) {
    throw new DivingFishError("Developer-Token 查询需要 MAIMAI_USERNAME 或 MAIMAI_QQ。");
  }

  const search = new URLSearchParams();

  if (qq) {
    search.set("qq", qq);
  } else if (username) {
    search.set("username", username);
  }

  return fetchDivingFishGetJson(`/dev/player/records?${search.toString()}`, {
    "Developer-Token": token
  }, options);
}

export async function fetchDivingFishTestRecords(options: FetchOptions = {}): Promise<unknown> {
  return fetchDivingFishGetJson("/player/test_data", {}, options);
}

export async function fetchDivingFishMusicData(
  options: { etag?: string; timeoutMs?: number } = {}
): Promise<{ status: 200 | 304; etag?: string; data?: unknown }> {
  const timeout = withTimeout(options.timeoutMs);
  const headers: Record<string, string> = {
    "user-agent": "starsail-maimai-dashboard/0.1"
  };

  if (options.etag) {
    headers["if-none-match"] = options.etag;
  }

  try {
    const response = await fetch(`${DIVING_FISH_BASE_URL}/music_data`, {
      headers,
      signal: timeout.signal
    });

    const etag = response.headers.get("etag") ?? undefined;

    if (response.status === 304) {
      return { status: 304, etag };
    }

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new DivingFishError(explainStatus(response.status, message), response.status);
    }

    return {
      status: 200,
      etag,
      data: await response.json()
    };
  } catch (error) {
    if (error instanceof DivingFishError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DivingFishError("Diving-Fish 曲库请求超时，请稍后重试。");
    }

    throw new DivingFishError(error instanceof Error ? error.message : "Diving-Fish 曲库请求失败。");
  } finally {
    timeout.cancel();
  }
}

async function fetchDivingFishGetJson(
  path: string,
  extraHeaders: Record<string, string>,
  options: FetchOptions = {}
): Promise<unknown> {
  const timeout = withTimeout(options.timeoutMs);

  try {
    const response = await fetch(`${DIVING_FISH_BASE_URL}${path}`, {
      headers: {
        "user-agent": "starsail-maimai-dashboard/0.1",
        ...extraHeaders
      },
      signal: timeout.signal
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new DivingFishError(explainStatus(response.status, message), response.status);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DivingFishError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DivingFishError("Diving-Fish 完整成绩请求超时，请稍后重试。");
    }

    throw new DivingFishError(error instanceof Error ? error.message : "Diving-Fish 完整成绩请求失败。");
  } finally {
    timeout.cancel();
  }
}
