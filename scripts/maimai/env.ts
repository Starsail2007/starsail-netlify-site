import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadDotEnv(filePath = path.resolve(process.cwd(), ".env")): Promise<void> {
  let content = "";

  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getMaimaiIdentity(): {
  username?: string;
  qq?: string;
  playerKey: string;
  label: string;
} {
  const username = process.env.MAIMAI_USERNAME?.trim();
  const qq = process.env.MAIMAI_QQ?.trim();

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

  throw new Error("缺少 MAIMAI_USERNAME 或 MAIMAI_QQ。请先在 .env 中配置水鱼用户名或 QQ。");
}

export function getEnvPresence(): Array<{ key: string; present: boolean; private: boolean }> {
  return [
    { key: "MAIMAI_SOURCE", present: Boolean(process.env.MAIMAI_SOURCE), private: false },
    { key: "MAIMAI_USERNAME", present: Boolean(process.env.MAIMAI_USERNAME), private: false },
    { key: "MAIMAI_QQ", present: Boolean(process.env.MAIMAI_QQ), private: false },
    { key: "MAIMAI_LOCAL_CACHE_DIR", present: Boolean(process.env.MAIMAI_LOCAL_CACHE_DIR), private: false },
    { key: "MAIMAI_UPDATE_SECRET", present: Boolean(process.env.MAIMAI_UPDATE_SECRET), private: true },
    { key: "DIVING_FISH_IMPORT_TOKEN", present: Boolean(process.env.DIVING_FISH_IMPORT_TOKEN), private: true },
    { key: "DIVING_FISH_DEVELOPER_TOKEN", present: Boolean(process.env.DIVING_FISH_DEVELOPER_TOKEN), private: true },
    { key: "LXNS_DEVELOPER_TOKEN", present: Boolean(process.env.LXNS_DEVELOPER_TOKEN || process.env.LXNS_TOKEN), private: true },
    { key: "LXNS_USER_TOKEN", present: Boolean(process.env.LXNS_USER_TOKEN), private: true },
    { key: "LXNS_FRIEND_CODE", present: Boolean(process.env.LXNS_FRIEND_CODE), private: false },
    { key: "SUPABASE_URL", present: Boolean(process.env.SUPABASE_URL), private: false },
    { key: "SUPABASE_SERVICE_ROLE_KEY", present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), private: true }
  ];
}
