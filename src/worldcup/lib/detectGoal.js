export function detectGoal(currentMatch, previousMatch) {
  if (!currentMatch || !previousMatch) {
    return null;
  }

  const currentHomeScore = Number(currentMatch.home?.score ?? 0);
  const previousHomeScore = Number(previousMatch.home?.score ?? 0);
  const currentAwayScore = Number(currentMatch.away?.score ?? 0);
  const previousAwayScore = Number(previousMatch.away?.score ?? 0);

  if (currentHomeScore > previousHomeScore) {
    return buildGoal(currentMatch, currentMatch.home, "home");
  }

  if (currentAwayScore > previousAwayScore) {
    return buildGoal(currentMatch, currentMatch.away, "away");
  }

  return null;
}

function buildGoal(match, team, side) {
  const latestGoal = [...(match.events || [])]
    .reverse()
    .find((event) => event.type === "Goal" && event.team === team.name);

  return {
    matchId: match.id,
    team,
    side,
    player: latestGoal?.player || "",
    minute: latestGoal?.minute || match.minute || ""
  };
}
