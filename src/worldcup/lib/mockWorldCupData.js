import { flagUrl } from "./flagUrl.js";

const team = (name, code, score, logo) => ({
  name,
  code,
  iso2: logo,
  flagUrl: flagUrl(logo),
  logo: flagUrl(logo),
  score
});

export const mockWorldCupData = {
  source: "mock",
  lastUpdated: "2026-07-01T12:00:00.000Z",
  matches: [
    {
      id: "mock-live-001",
      status: "LIVE",
      statusText: "Live",
      minute: 67,
      stage: "Round of 16",
      venue: "Estadio Horizonte",
      kickoffTime: "2026-07-01T11:00:00.000Z",
      home: team("Brazil", "BRA", 2, "br"),
      away: team("Japan", "JPN", 1, "jp"),
      events: [
        { type: "Goal", minute: 18, team: "Japan", player: "Riku Sato" },
        { type: "Goal", minute: 41, team: "Brazil", player: "Lucas Vieira" },
        { type: "Goal", minute: 64, team: "Brazil", player: "Mateo Rocha" }
      ]
    },
    {
      id: "mock-live-002",
      status: "HT",
      statusText: "Half Time",
      minute: 45,
      stage: "Group Stage",
      venue: "Pacific Arena",
      kickoffTime: "2026-07-01T10:00:00.000Z",
      home: team("France", "FRA", 1, "fr"),
      away: team("Morocco", "MAR", 1, "ma"),
      events: [
        { type: "Goal", minute: 11, team: "France", player: "Noah Laurent" },
        { type: "Goal", minute: 39, team: "Morocco", player: "Yanis Amrani" }
      ]
    },
    {
      id: "mock-finished-001",
      status: "FT",
      statusText: "Full Time",
      minute: 90,
      stage: "Group Stage",
      venue: "Northern Lights Stadium",
      kickoffTime: "2026-07-01T07:00:00.000Z",
      home: team("Argentina", "ARG", 3, "ar"),
      away: team("Canada", "CAN", 0, "ca"),
      events: [
        { type: "Goal", minute: 23, team: "Argentina", player: "Thiago Vega" },
        { type: "Goal", minute: 58, team: "Argentina", player: "Emiliano Cruz" },
        { type: "Goal", minute: 82, team: "Argentina", player: "Santiago Mora" }
      ]
    },
    {
      id: "mock-scheduled-001",
      status: "NS",
      statusText: "Not Started",
      minute: null,
      stage: "Group Stage",
      venue: "Liberty Field",
      kickoffTime: "2026-07-01T15:30:00.000Z",
      home: team("United States", "USA", null, "us"),
      away: team("Mexico", "MEX", null, "mx"),
      events: []
    },
    {
      id: "mock-scheduled-002",
      status: "NS",
      statusText: "Not Started",
      minute: null,
      stage: "Group Stage",
      venue: "Atlantic Dome",
      kickoffTime: "2026-07-01T18:00:00.000Z",
      home: team("Spain", "ESP", null, "es"),
      away: team("Senegal", "SEN", null, "sn"),
      events: []
    }
  ],
  knockout: [
    {
      id: "ko-001",
      round: "Round of 16",
      home: "Brazil",
      away: "Japan",
      homeScore: 2,
      awayScore: 1,
      winner: "Brazil",
      status: "LIVE",
      nextMatchId: "ko-005"
    },
    {
      id: "ko-002",
      round: "Round of 16",
      home: "Argentina",
      away: "Canada",
      homeScore: 3,
      awayScore: 0,
      winner: "Argentina",
      status: "FT",
      nextMatchId: "ko-005"
    },
    {
      id: "ko-003",
      round: "Round of 16",
      home: "France",
      away: "Morocco",
      homeScore: 1,
      awayScore: 1,
      winner: "",
      status: "HT",
      nextMatchId: "ko-006"
    },
    {
      id: "ko-004",
      round: "Round of 16",
      home: "Spain",
      away: "Senegal",
      homeScore: null,
      awayScore: null,
      winner: "",
      status: "NS",
      nextMatchId: "ko-006"
    },
    {
      id: "ko-005",
      round: "Quarterfinal",
      home: "Brazil",
      away: "Argentina",
      homeScore: null,
      awayScore: null,
      winner: "",
      status: "NS",
      nextMatchId: "ko-007"
    },
    {
      id: "ko-006",
      round: "Quarterfinal",
      home: "TBD",
      away: "TBD",
      homeScore: null,
      awayScore: null,
      winner: "",
      status: "NS",
      nextMatchId: "ko-007"
    },
    {
      id: "ko-007",
      round: "Semifinal",
      home: "TBD",
      away: "TBD",
      homeScore: null,
      awayScore: null,
      winner: "",
      status: "NS",
      nextMatchId: "ko-008"
    },
    {
      id: "ko-008",
      round: "Final",
      home: "TBD",
      away: "TBD",
      homeScore: null,
      awayScore: null,
      winner: "",
      status: "NS",
      nextMatchId: ""
    }
  ]
};

export function createMockWorldCupUpdate(previousData, tick = 1) {
  const nextData = structuredClone(previousData || mockWorldCupData);
  const liveMatch = nextData.matches.find((match) => match.id === "mock-live-001");

  nextData.lastUpdated = new Date().toISOString();

  if (!liveMatch) {
    return nextData;
  }

  liveMatch.minute = Math.min(90, Number(liveMatch.minute || 67) + 1);

  if (Number(liveMatch.away.score) === 1) {
    liveMatch.away.score = 2;
    liveMatch.events = [
      ...(liveMatch.events || []),
      { type: "Goal", minute: liveMatch.minute, team: "Japan", player: "Haruto Mori" }
    ];
  }

  return nextData;
}
