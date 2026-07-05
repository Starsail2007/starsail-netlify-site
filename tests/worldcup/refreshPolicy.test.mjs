import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WORLD_CUP_REFRESH_INTERVALS,
  computeWorldCupRefreshPolicy
} from "../../src/worldcup/lib/refreshPolicy.js";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function match(overrides = {}) {
  return {
    id: "m1",
    stage: "Group Stage",
    kickoffTime: "2026-06-01T18:00:00.000Z",
    home: { name: "Spain" },
    away: { name: "Germany" },
    status: "NS",
    ...overrides
  };
}

describe("computeWorldCupRefreshPolicy", () => {
  it("uses live mode for live statuses", () => {
    const policy = computeWorldCupRefreshPolicy([
      match({ status: "1H", kickoffTime: "2026-06-01T11:30:00.000Z" })
    ], { now: NOW, lastUpdated: "2026-06-01T11:59:00.000Z" });

    assert.equal(policy.mode, "live");
    assert.equal(policy.intervalSeconds, WORLD_CUP_REFRESH_INTERVALS.live / 1_000);
    assert.equal(policy.nextMatch.id, "m1");
  });

  it("uses match-window mode shortly before kickoff", () => {
    const policy = computeWorldCupRefreshPolicy([
      match({ kickoffTime: "2026-06-01T12:20:00.000Z" })
    ], { now: NOW, lastUpdated: "2026-06-01T11:58:00.000Z" });

    assert.equal(policy.mode, "match-window");
    assert.equal(policy.nextMatch.home, "Spain");
  });

  it("uses near-match mode within 24 hours but outside the active window", () => {
    const policy = computeWorldCupRefreshPolicy([
      match({ kickoffTime: "2026-06-01T18:00:00.000Z" })
    ], { now: NOW, lastUpdated: "2026-06-01T11:00:00.000Z" });

    assert.equal(policy.mode, "near-match");
    assert.equal(policy.intervalSeconds, WORLD_CUP_REFRESH_INTERVALS.nearMatch / 1_000);
  });

  it("uses quiet mode when the next match is more than 24 hours away", () => {
    const policy = computeWorldCupRefreshPolicy([
      match({ kickoffTime: "2026-06-03T12:00:00.000Z" })
    ], { now: NOW, lastUpdated: "2026-06-01T08:00:00.000Z" });

    assert.equal(policy.mode, "quiet");
    assert.equal(policy.intervalSeconds, WORLD_CUP_REFRESH_INTERVALS.quiet / 1_000);
  });

  it("uses complete mode when there is no future match", () => {
    const policy = computeWorldCupRefreshPolicy([
      match({ kickoffTime: "2026-05-20T12:00:00.000Z", status: "FT" })
    ], { now: NOW, lastUpdated: "2026-06-01T08:00:00.000Z" });

    assert.equal(policy.mode, "complete");
    assert.equal(policy.nextMatch, null);
  });
});
