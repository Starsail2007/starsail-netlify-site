import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const WIKIDATA_SEARCH_URL = "https://www.wikidata.org/w/api.php";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const args = parseArgs(process.argv.slice(2));
const rosterPath = resolve(projectRoot, args.roster || "src/worldcup/data/squad-roster.json");
const outputPath = resolve(projectRoot, args.output || "src/worldcup/data/player-name-map.json");
const reviewOutputPath = resolve(projectRoot, args.reviewOutput || "src/worldcup/data/player-name-review.csv");
const overridesPath = resolve(projectRoot, args.overrides || "src/worldcup/data/player-name-overrides.json");
const limit = Number(args.limit || 0);
const batchSize = Math.max(10, Number(args.batchSize || 80));
const requestTimeoutMs = Number(args.timeout || 20_000);
const batchDelayMs = Number(args.delay || 180);
const fallbackSearch = Boolean(args.fallbackSearch);
const fallbackLimit = Number(args.fallbackLimit || 0);
const fallbackConcurrency = Math.max(1, Number(args.fallbackConcurrency || 6));
const fallbackMaxCandidates = Number(args.fallbackMaxCandidates || 4);
const fallbackOnly = Boolean(args.fallbackOnly);
const skipSparql = Boolean(args.skipSparql || fallbackOnly);
const reuseExisting = Boolean(args.reuseExisting || fallbackOnly);

const roster = JSON.parse(await readFile(rosterPath, "utf8"));
const existing = await readJson(outputPath);
const overrides = await readJson(overridesPath);
const players = flattenPlayers(roster).slice(0, limit > 0 ? limit : undefined);
const allCandidates = collectCandidates(players);
const batchMatches = skipSparql ? new Map() : await queryWikidataBatches(allCandidates);
const entries = await mapPlayers(players, batchMatches);
const mapped = Object.fromEntries(entries.map(({ player, mapping }) => [player.key, mapping]));
const reviewRows = entries.filter(({ mapping }) => mapping.needsReview);
const confidenceStats = countBy(entries.map(({ mapping }) => mapping.confidence || "none"));

const payload = {
  source: {
    rosterSourceUrl: roster.source?.url || "",
    rosterVersion: roster.source?.version || "",
    wikidataSparql: WIKIDATA_SPARQL_URL,
    wikidataApi: fallbackSearch ? WIKIDATA_SEARCH_URL : "",
    generatedAt: new Date().toISOString(),
    note: "Chinese names are imported from Wikidata zh labels when high-enough identity evidence is available. Missing or low-confidence rows are queued for review."
  },
  stats: {
    totalPlayers: players.length,
    translatedPlayers: entries.filter(({ mapping }) => mapping.zhName).length,
    wikidataMatches: entries.filter(({ mapping }) => mapping.source === "wikidata").length,
    needsReview: reviewRows.length,
    confidence: confidenceStats
  },
  teamStats: buildTeamStats(entries),
  players: mapped
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

if (!args.noReviewCsv) {
  await writeFile(reviewOutputPath, buildReviewCsv(reviewRows), "utf8");
}

console.log(`[worldcup:player-map] Wrote ${outputPath}`);
if (!args.noReviewCsv) {
  console.log(`[worldcup:player-map] Wrote ${reviewOutputPath}`);
}
console.log(`[worldcup:player-map] players=${payload.stats.totalPlayers}, translated=${payload.stats.translatedPlayers}, wikidata=${payload.stats.wikidataMatches}, review=${payload.stats.needsReview}`);

async function mapPlayers(sourcePlayers, matchesByLabel) {
  const results = sourcePlayers.map((player) => {
    const preserved = preserveManualMapping(existing?.players?.[player.key], player);

    if (preserved) {
      return { player, mapping: preserved, canFallback: false };
    }

    const override = buildOverrideMapping(overrides?.players?.[player.key], player);

    if (override) {
      return { player, mapping: override, canFallback: false };
    }

    const reused = reuseExistingMapping(existing?.players?.[player.key], player);

    if (reused) {
      return { player, mapping: reused, canFallback: fallbackSearch && reused.needsReview };
    }

    const selected = selectBestBatchResult(player, matchesByLabel);
    const mapping = buildMapping(player, selected);
    return { player, mapping, canFallback: fallbackSearch && mapping.needsReview };
  });

  if (fallbackSearch) {
    const fallbackJobs = results
      .filter((item) => item.canFallback)
      .slice(0, fallbackLimit > 0 ? fallbackLimit : undefined);
    let fallbackDone = 0;

    await runConcurrent(fallbackJobs, fallbackConcurrency, async (item) => {
      const result = await findChineseNameWithSearchApi(item.player);

      if (result && (result.zhName || !item.mapping.sourceId)) {
        item.mapping = buildMapping(item.player, result);
      }

      fallbackDone += 1;

      if (fallbackDone % 50 === 0 || fallbackDone === fallbackJobs.length) {
        const translated = results.filter((entry) => entry.mapping.zhName).length;
        const review = results.filter((entry) => entry.mapping.needsReview).length;
        console.log(`[worldcup:player-map] fallback ${fallbackDone}/${fallbackJobs.length}. zh=${translated}, review=${review}`);
      }
    });
  }

  const translated = results.filter((item) => item.mapping.zhName).length;
  const review = results.filter((item) => item.mapping.needsReview).length;
  console.log(`[worldcup:player-map] ${sourcePlayers.length}/${sourcePlayers.length} mapped. zh=${translated}, review=${review}`);

  return results.map(({ player, mapping }) => ({ player, mapping }));
}

async function queryWikidataBatches(candidates) {
  const byLabel = new Map();
  const batches = chunk(candidates, batchSize);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const rows = await queryWikidataBatch(batch);

    for (const row of rows) {
      const key = normalizeName(row.enLabel);

      if (!byLabel.has(key)) {
        byLabel.set(key, []);
      }

      byLabel.get(key).push(row);
    }

    console.log(`[worldcup:player-map] Wikidata batch ${index + 1}/${batches.length}: ${batch.length} labels, ${rows.length} rows`);

    if (batchDelayMs > 0 && index + 1 < batches.length) {
      await wait(batchDelayMs);
    }
  }

  return byLabel;
}

async function queryWikidataBatch(candidates) {
  const uniqueCandidates = uniqueStrings(candidates);

  if (uniqueCandidates.length === 0) {
    return [];
  }

  const query = `
SELECT ?item ?enLabel ?itemLabel ?itemDescription ?birthDate ?countryLabel WHERE {
  VALUES ?enLabel { ${uniqueCandidates.map((candidate) => `${sparqlString(candidate)}@en`).join(" ")} }
  ?item rdfs:label ?enLabel.
  ?item wdt:P106/wdt:P279* wd:Q937857.
  OPTIONAL { ?item wdt:P569 ?birthDate. }
  OPTIONAL { ?item wdt:P27 ?country. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-hant,zh,en". }
}
`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(WIKIDATA_SPARQL_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Accept": "application/sparql-results+json",
          "Content-Type": "application/sparql-query; charset=utf-8",
          "User-Agent": "StarsailWorldCupDashboard/0.1 (local data generation)"
        },
        body: query
      });
      clearTimeout(timeout);

      if (!response.ok) {
        await wait(700 + attempt * 1_000);
        continue;
      }

      const data = await response.json();
      return (data.results?.bindings || []).map(normalizeSparqlRow);
    } catch {
      clearTimeout(timeout);
      await wait(700 + attempt * 1_000);
    }
  }

  return [];
}

function normalizeSparqlRow(row) {
  const itemUrl = row.item?.value || "";
  const sourceId = itemUrl.split("/").pop() || "";
  const label = row.itemLabel?.value || "";
  const birthDate = row.birthDate?.value ? row.birthDate.value.slice(0, 10) : "";

  return {
    query: row.enLabel?.value || "",
    enLabel: row.enLabel?.value || "",
    id: sourceId,
    url: itemUrl || (sourceId ? `https://www.wikidata.org/wiki/${sourceId}` : ""),
    label,
    zhName: hasHanScript(label) ? label : "",
    description: row.itemDescription?.value || "",
    birthDate,
    countryLabel: row.countryLabel?.value || ""
  };
}

function selectBestBatchResult(player, matchesByLabel) {
  const ranked = player.searchCandidates
    .flatMap((candidate, candidateIndex) => (matchesByLabel.get(normalizeName(candidate)) || [])
      .map((entity) => ({
        ...entity,
        query: candidate,
        candidateIndex,
        score: scoreEntity(player, entity, candidateIndex)
      })))
    .filter((entity) => entity.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedupeEntities(ranked)[0] || null;
}

function scoreEntity(player, entity, candidateIndex) {
  let score = 0;
  const birthDateMatches = entity.birthDate && entity.birthDate === player.dateOfBirthIso;
  const birthDateConflicts = entity.birthDate && player.dateOfBirthIso && entity.birthDate !== player.dateOfBirthIso;
  const candidateMatchesCommonName = normalizeName(entity.enLabel) === normalizeName(player.commonName);

  if (birthDateConflicts) {
    return 0;
  }

  if (birthDateMatches) {
    score += 120;
  } else if (!entity.birthDate) {
    score += 10;
  }

  if (hasHanScript(entity.label)) {
    score += 80;
  }

  if (isFootballDescription(entity.description)) {
    score += 25;
  }

  if (candidateMatchesCommonName) {
    score += 20;
  }

  if (candidateIndex <= 2) {
    score += 15 - candidateIndex * 4;
  }

  return score;
}

async function findChineseNameWithSearchApi(player) {
  const candidates = player.searchCandidates.slice(0, fallbackMaxCandidates > 0 ? fallbackMaxCandidates : undefined);

  for (const query of candidates) {
    const results = await searchWikidata(query);
    const selected = selectSearchApiResult(results);

    if (selected) {
      return {
        query,
        id: selected.id,
        url: `https://www.wikidata.org/wiki/${selected.id}`,
        label: selected.label,
        zhName: hasHanScript(selected.label) ? selected.label : "",
        description: selected.description || "",
        birthDate: "",
        countryLabel: ""
      };
    }
  }

  return null;
}

async function searchWikidata(query) {
  const url = new URL(WIKIDATA_SEARCH_URL);
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("uselang", "zh-hans");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "5");
  url.searchParams.set("search", query);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "StarsailWorldCupDashboard/0.1 (local data generation)"
        }
      });
      clearTimeout(timeout);

      if (!response.ok) {
        await wait(400 + attempt * 500);
        continue;
      }

      const data = await response.json();
      return Array.isArray(data.search) ? data.search : [];
    } catch {
      clearTimeout(timeout);
      await wait(400 + attempt * 500);
    }
  }

  return [];
}

function selectSearchApiResult(results) {
  return results.find((item) => hasHanScript(item.label) && isFootballDescription(item.description))
    || results.find((item) => isFootballDescription(item.description))
    || null;
}

function buildMapping(player, result) {
  const sourceId = result?.id || "";
  const confidence = confidenceForResult(player, result);
  const zhName = confidence === "low" ? "" : (result?.zhName || "");
  const reviewReason = reviewReasonFor(player, result, confidence);

  return {
    teamCode: player.teamCode,
    teamName: player.teamName,
    squadNumber: player.squadNumber,
    position: player.position,
    playerName: player.playerName,
    commonName: player.commonName,
    originalName: player.originalName,
    nameOnShirt: player.nameOnShirt,
    dateOfBirthIso: player.dateOfBirthIso,
    club: player.club,
    aliases: player.searchCandidates,
    zhName,
    displayName: zhName ? `${zhName}（${player.commonName}）` : player.commonName,
    source: sourceId ? "wikidata" : "",
    sourceId,
    sourceUrl: sourceId ? `https://www.wikidata.org/wiki/${sourceId}` : "",
    sourceLabel: result?.label || "",
    sourceDescription: result?.description || "",
    sourceBirthDate: result?.birthDate || "",
    sourceCountryLabel: result?.countryLabel || "",
    searchQuery: result?.query || "",
    confidence,
    needsReview: Boolean(reviewReason),
    reviewReason
  };
}

function confidenceForResult(player, result) {
  if (!result?.id || !result?.zhName) {
    return "none";
  }

  const birthDateMatches = result.birthDate && result.birthDate === player.dateOfBirthIso;
  const exactPrimaryName = normalizeName(result.enLabel || result.query) === normalizeName(player.commonName);

  if (birthDateMatches && exactPrimaryName) {
    return "high";
  }

  if (birthDateMatches || isFootballDescription(result.description)) {
    return "medium";
  }

  return "low";
}

function reviewReasonFor(player, result, confidence) {
  if (!result?.id) {
    return "no-wikidata-match";
  }

  if (!result.zhName) {
    return "wikidata-match-without-zh-label";
  }

  if (result.birthDate && player.dateOfBirthIso && result.birthDate !== player.dateOfBirthIso) {
    return "birth-date-conflict";
  }

  if (confidence === "low") {
    return "low-confidence-auto-match";
  }

  return "";
}

function preserveManualMapping(existingMapping, player) {
  if (!existingMapping?.locked && existingMapping?.source !== "manual") {
    return null;
  }

  return {
    ...buildMapping(player, null),
    ...existingMapping,
    aliases: uniqueStrings([...(existingMapping.aliases || []), ...player.searchCandidates]),
    displayName: existingMapping.zhName ? `${existingMapping.zhName}（${player.commonName}）` : player.commonName,
    confidence: existingMapping.confidence || "manual",
    needsReview: !existingMapping.zhName
  };
}

function buildOverrideMapping(override, player) {
  if (!override?.zhName) {
    return null;
  }

  const sourceId = override.sourceId || "";

  return {
    ...buildMapping(player, null),
    zhName: override.zhName,
    displayName: `${override.zhName}（${player.commonName}）`,
    source: override.source || "manual",
    sourceId,
    sourceUrl: override.sourceUrl || (sourceId ? `https://www.wikidata.org/wiki/${sourceId}` : ""),
    sourceLabel: override.sourceLabel || override.zhName,
    sourceDescription: override.sourceDescription || "",
    sourceBirthDate: override.sourceBirthDate || "",
    sourceCountryLabel: override.sourceCountryLabel || "",
    searchQuery: override.searchQuery || "",
    confidence: override.confidence || "manual",
    needsReview: false,
    reviewReason: "",
    locked: true,
    note: override.note || ""
  };
}

function reuseExistingMapping(existingMapping, player) {
  if (!reuseExisting || !existingMapping || existingMapping.playerName !== player.playerName) {
    return null;
  }

  if (existingMapping.confidence === "low" || existingMapping.reviewReason === "low-confidence-auto-match") {
    return null;
  }

  return {
    ...buildMapping(player, null),
    ...existingMapping,
    teamCode: player.teamCode,
    teamName: player.teamName,
    squadNumber: player.squadNumber,
    position: player.position,
    playerName: player.playerName,
    commonName: player.commonName,
    originalName: player.originalName,
    nameOnShirt: player.nameOnShirt,
    dateOfBirthIso: player.dateOfBirthIso,
    club: player.club,
    aliases: uniqueStrings([...(existingMapping.aliases || []), ...player.searchCandidates]),
    displayName: existingMapping.zhName ? `${existingMapping.zhName}（${player.commonName}）` : player.commonName,
    needsReview: Boolean(existingMapping.reviewReason || !existingMapping.zhName)
  };
}

function flattenPlayers(roster) {
  return (roster.teams || []).flatMap((team) => (team.players || []).map((player) => ({
    ...player,
    teamName: team.teamName,
    teamCode: team.teamCode,
    searchCandidates: buildSearchCandidates(player)
  })));
}

function buildSearchCandidates(player) {
  const firstNames = titleCaseName(player.firstNames);
  const lastNames = titleCaseName(player.lastNames);
  const shirtName = titleCaseName(cleanShirtName(player.nameOnShirt));
  const firstToken = firstNames.split(/\s+/)[0] || "";
  const eastAsianOrderName = [lastNames, hyphenateGivenName(firstNames)].filter(Boolean).join(" ");
  const firstWithShirtName = [firstToken, shirtName].filter(Boolean).join(" ");
  const candidates = uniqueStrings([
    knownCommonName(player),
    player.commonName,
    player.originalName,
    [firstNames, lastNames].filter(Boolean).join(" "),
    eastAsianOrderName,
    firstWithShirtName,
    shirtName,
    reversePdfPlayerName(player.playerName),
    player.playerName
  ].filter(Boolean));

  return uniqueStrings(candidates.flatMap((candidate) => [
    candidate,
    stripDiacritics(candidate)
  ]));
}

function knownCommonName(player) {
  const shirt = normalizeName(player.nameOnShirt);
  const first = normalizeName(player.firstNames);

  if (shirt === "vini jr") {
    return "Vinicius Junior";
  }

  if (shirt === "cristiano ronaldo" || (shirt === "ronaldo" && first.startsWith("cristiano"))) {
    return "Cristiano Ronaldo";
  }

  if (shirt === "lamine yamal") {
    return "Lamine Yamal";
  }

  return "";
}

function cleanShirtName(value) {
  return String(value || "")
    .replace(/\bJR\.\b/gi, "JR")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hyphenateGivenName(value) {
  const parts = titleCaseName(value).split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return parts.join(" ");
  }

  return `${parts[0]}-${parts.slice(1).join("-").toLocaleLowerCase("en-US")}`;
}

function reversePdfPlayerName(value) {
  const parts = String(value || "").trim().split(/\s+/);

  if (parts.length < 2) {
    return value;
  }

  const last = parts[0];
  const first = parts.slice(1).join(" ");
  return `${first} ${titleCaseName(last)}`;
}

function titleCaseName(value) {
  return String(value || "")
    .split(/\s+/)
    .map((token) => token
      .split("-")
      .map((part) => part ? `${part[0].toLocaleUpperCase("en-US")}${part.slice(1).toLocaleLowerCase("en-US")}` : part)
      .join("-"))
    .join(" ");
}

function collectCandidates(sourcePlayers) {
  return uniqueStrings(sourcePlayers.flatMap((player) => player.searchCandidates))
    .filter((candidate) => candidate.length > 2);
}

function buildTeamStats(entries) {
  return Object.fromEntries(Object.entries(groupBy(entries, ({ player }) => player.teamCode))
    .map(([teamCode, items]) => {
      const teamName = items[0]?.player.teamName || "";
      return [teamCode, {
        teamName,
        totalPlayers: items.length,
        translatedPlayers: items.filter(({ mapping }) => mapping.zhName).length,
        needsReview: items.filter(({ mapping }) => mapping.needsReview).length
      }];
    }));
}

function buildReviewCsv(reviewRows) {
  const header = [
    "teamCode",
    "teamName",
    "squadNumber",
    "position",
    "commonName",
    "originalName",
    "dateOfBirthIso",
    "club",
    "zhName",
    "sourceId",
    "sourceLabel",
    "sourceDescription",
    "searchQuery",
    "confidence",
    "reviewReason"
  ];

  const rows = reviewRows.map(({ mapping }) => header.map((key) => csvCell(mapping[key] || "")).join(","));
  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function groupBy(values, keyFn) {
  return values.reduce((groups, value) => {
    const key = keyFn(value);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(value);
    return groups;
  }, {});
}

function dedupeEntities(values) {
  const seen = new Set();
  const deduped = [];

  for (const value of values) {
    if (seen.has(value.id)) {
      continue;
    }

    seen.add(value.id);
    deduped.push(value);
  }

  return deduped;
}

function isFootballDescription(value) {
  const text = String(value || "").toLocaleLowerCase("en-US");
  return text.includes("football")
    || text.includes("soccer")
    || text.includes("足球")
    || text.includes("futbol")
    || text.includes("fútbol");
}

function hasHanScript(value) {
  return /\p{Script=Han}/u.test(String(value || ""));
}

function stripDiacritics(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeName(value) {
  return stripDiacritics(value)
    .toLocaleLowerCase("en-US")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const unique = [];

  for (const value of values) {
    const clean = String(value || "").replace(/\s+/g, " ").trim();
    const key = normalizeName(clean);

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(clean);
  }

  return unique;
}

function sparqlString(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function csvCell(value) {
  const text = String(value || "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function runConcurrent(values, concurrency, handler) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await handler(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--roster") {
      parsed.roster = values[index + 1];
      index += 1;
    } else if (value === "--output") {
      parsed.output = values[index + 1];
      index += 1;
    } else if (value === "--review-output") {
      parsed.reviewOutput = values[index + 1];
      index += 1;
    } else if (value === "--overrides") {
      parsed.overrides = values[index + 1];
      index += 1;
    } else if (value === "--limit") {
      parsed.limit = values[index + 1];
      index += 1;
    } else if (value === "--batch-size") {
      parsed.batchSize = values[index + 1];
      index += 1;
    } else if (value === "--delay") {
      parsed.delay = values[index + 1];
      index += 1;
    } else if (value === "--timeout") {
      parsed.timeout = values[index + 1];
      index += 1;
    } else if (value === "--fallback-search") {
      parsed.fallbackSearch = true;
    } else if (value === "--fallback-limit") {
      parsed.fallbackLimit = values[index + 1];
      index += 1;
    } else if (value === "--fallback-concurrency") {
      parsed.fallbackConcurrency = values[index + 1];
      index += 1;
    } else if (value === "--fallback-max-candidates") {
      parsed.fallbackMaxCandidates = values[index + 1];
      index += 1;
    } else if (value === "--fallback-only") {
      parsed.fallbackOnly = true;
    } else if (value === "--skip-sparql") {
      parsed.skipSparql = true;
    } else if (value === "--reuse-existing") {
      parsed.reuseExisting = true;
    } else if (value === "--no-review-csv") {
      parsed.noReviewCsv = true;
    }
  }

  return parsed;
}
