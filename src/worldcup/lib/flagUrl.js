import { TEAM_ISO2 } from "./teamIsoMap.js";

export function flagUrl(iso2OrTeamName) {
  const iso2 = TEAM_ISO2[iso2OrTeamName] || iso2OrTeamName;

  if (!iso2 || typeof iso2 !== "string") {
    return "";
  }

  return `https://flagcdn.com/${iso2.toLowerCase()}.svg`;
}
