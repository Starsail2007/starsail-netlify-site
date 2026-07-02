import { exportLatestSnapshotLocal } from "../../src/lib/maimai/localStore";

export async function runExport(): Promise<void> {
  let outputPath = "";

  try {
    outputPath = await exportLatestSnapshotLocal();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("暂无 latest snapshot 可导出。请先运行 pnpm maimai:update。");
    }

    throw error;
  }

  console.log(`exported: ${outputPath}`);
}
