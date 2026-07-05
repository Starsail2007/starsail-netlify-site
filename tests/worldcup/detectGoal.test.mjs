import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectGoal } from "../../src/worldcup/lib/detectGoal.js";

const baseMatch = {
  id: "match-1",
  minute: "58",
  home: { name: "Spain", score: 1 },
  away: { name: "Germany", score: 1 },
  events: []
};

describe("detectGoal", () => {
  it("returns null when previous match data is missing", () => {
    assert.equal(detectGoal(baseMatch, null), null);
  });

  it("detects a home score increase and uses the latest matching goal event", () => {
    const current = {
      ...baseMatch,
      home: { name: "Spain", score: 3 },
      away: { name: "Germany", score: 1 },
      events: [
        { type: "Goal", team: "Spain", player: "Nico Williams", minute: "47" },
        { type: "Yellow Card", team: "Germany", player: "Player B", minute: "50" },
        { type: "Goal", team: "Spain", player: "Lamine Yamal", minute: "58" }
      ]
    };
    const previous = {
      ...baseMatch,
      home: { name: "Spain", score: 2 },
      away: { name: "Germany", score: 1 }
    };

    assert.deepEqual(detectGoal(current, previous), {
      matchId: "match-1",
      team: current.home,
      side: "home",
      player: "Lamine Yamal",
      minute: "58"
    });
  });

  it("detects an away score increase", () => {
    const current = {
      ...baseMatch,
      home: { name: "Spain", score: 1 },
      away: { name: "Germany", score: 2 },
      events: [
        { type: "Goal", team: "Germany", player: "Kai Havertz", minute: "76" }
      ]
    };
    const previous = {
      ...baseMatch,
      home: { name: "Spain", score: 1 },
      away: { name: "Germany", score: 1 }
    };

    assert.deepEqual(detectGoal(current, previous), {
      matchId: "match-1",
      team: current.away,
      side: "away",
      player: "Kai Havertz",
      minute: "76"
    });
  });

  it("returns null when scores do not increase", () => {
    const previous = {
      ...baseMatch,
      home: { name: "Spain", score: 1 },
      away: { name: "Germany", score: 1 }
    };

    assert.equal(detectGoal(baseMatch, previous), null);
  });
});
