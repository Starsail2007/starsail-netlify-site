import { runExport } from "./export";
import { loadDotEnv } from "./env";
import { runHistory } from "./history";
import { runLxnsProbe } from "./lxns-probe";
import { runMusicCache } from "./music-cache";
import { runRecordsProbe } from "./records-probe";
import { runRecordsSave } from "./records-save";
import { runStatus } from "./status";
import { runTrendImport } from "./trend-import";
import { runUpdate } from "./update";

type Command = "update" | "status" | "history" | "music-cache" | "export" | "records-probe" | "records-save" | "lxns-probe" | "trend-import";

function parseNumberOption(args: string[], name: string): number | undefined {
  const index = args.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function printHelp(): void {
  console.log(`Usage: pnpm maimai:<command>

Commands:
  update        Fetch B50 from Diving-Fish and save local snapshot
  status        Show local cache and environment status
  history       Show recent local rating snapshots
  music-cache   Refresh Diving-Fish music_data cache
  export        Export latest local snapshot
  records-probe Probe complete record API shape without saving
  records-save  Fetch complete records and save local/Supabase snapshots
  lxns-probe    Probe Lxns history/trend API shape without saving
  trend-import  Import Lxns rating trend into Supabase

Options:
  history --limit 50
  music-cache --force
  records-probe --source import-token|developer-token|test-data --limit 5
  lxns-probe --mode developer|user --friend-code 123 --skip-history
  trend-import --friend-code 123 --dry-run`);
}

async function main(): Promise<void> {
  await loadDotEnv();

  const [command, ...args] = process.argv.slice(2) as [Command | undefined, ...string[]];

  switch (command) {
    case "update":
      await runUpdate();
      break;
    case "status":
      await runStatus();
      break;
    case "history":
      await runHistory({ limit: parseNumberOption(args, "--limit") });
      break;
    case "music-cache":
      await runMusicCache({ force: hasFlag(args, "--force") });
      break;
    case "export":
      await runExport();
      break;
    case "records-probe":
      await runRecordsProbe(args);
      break;
    case "records-save":
      await runRecordsSave();
      break;
    case "lxns-probe":
      await runLxnsProbe(args);
      break;
    case "trend-import":
      await runTrendImport(args);
      break;
    default:
      printHelp();
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[maimai] failed: ${message}`);
  process.exitCode = 1;
});
