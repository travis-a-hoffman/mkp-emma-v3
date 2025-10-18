import type { GroupStatsData } from "../hooks/useGroupStats"

/**
 * Formats group statistics into a natural language message
 * @param stats - Group statistics data from the API
 * @param isAuthenticated - Whether the user is authenticated (affects terminology)
 * @returns Natural language description of group statistics
 */
export function formatGroupsMessage(stats: GroupStatsData | null, isAuthenticated: boolean): string {
  if (!stats) {
    return "Loading group statistics..."
  }

  const groupType = isAuthenticated ? "I-Groups" : "groups"
  const groupTypeCapitalized = isAuthenticated ? "I-Groups" : "Groups"
  const initiatedType = isAuthenticated ? "initiated" : "uninitiated"

  const parts: string[] = []

  // Handle nearby stats if available
  if (stats.nearby && stats.nearby.total > 0) {
    const nearbyAccepting = (isAuthenticated ? stats.nearby.accepting_initiated_visitors: stats.nearby.accepting_uninitiated_visitors) || 0
    const nearbyActive = stats.nearby.active
    const radiusMiles = stats.nearby.radius_miles

    if (nearbyActive > 0) {
      parts.push(
        `There are many ${groupType} near you! Within ${radiusMiles} miles of you, there are ${nearbyActive} active ${groupType}.`,
      )
    } else {
      parts.push(`Unfortunately, there are no active ${groupType} within ${radiusMiles} miles of you.`)
    }

    if (nearbyAccepting > 0) {
      parts.push(`${nearbyAccepting} ${groupType} near you are accepting ${initiatedType} visitors.`)
    }

  } else if (stats.nearby && stats.nearby.total === 0) {
    const radiusMiles = stats.nearby.radius_miles
    parts.push(`Unfortunately, there are no ${groupType} within ${radiusMiles} miles of you.`)
  }

  // Handle community stats if available
  if (stats.community && stats.community.total > 0) {
    const communityAccepting = (isAuthenticated ? stats.community.accepting_initiated_visitors: stats.community.accepting_uninitiated_visitors) || 0
    const communityName = stats.community.name
    const communityActive = stats.community.active
    parts.push(`In the ${communityName} Community, there are ${communityActive} active ${groupType}.`)
    if (communityAccepting > 0) {
      parts.push(`${communityAccepting} ${groupType} are accepting ${initiatedType} visitors.`)
    }
  }

  // Handle area stats if available
  if (stats.area && stats.area.total > 0 && !("note" in stats.area)) {
    const areadAccepting = (isAuthenticated ? stats.area.accepting_initiated_visitors: stats.area.accepting_uninitiated_visitors) || 0
    const areaName = stats.area.name
    const areaActive = stats.area.active
    parts.push(`In the ${areaName} Area, there are ${areaActive} active ${groupType}.`)
    if (areadAccepting > 0) {
      const acceptingInitiated = stats.area.accepting_initiated_visitors
      parts.push(`${acceptingInitiated} ${groupType} are accepting ${initiatedType} visitors.`)
    }
  }

  // Always include national stats
  const nationalAccepting = (isAuthenticated ? stats.accepting_initiated_visitors: stats.accepting_uninitiated_visitors) || 0
  const nationalTotal = stats.total
  parts.push(`Nationally, there are a total of ${nationalTotal} ${groupType}.`)

  // Add visitor acceptance stats for i-groups
  if (nationalAccepting > 0) {
    const acceptingInitiated = stats.accepting_initiated_visitors
    parts.push(`Of those, ${acceptingInitiated} ${groupType} are accepting ${initiatedType} visitors.`)
  }

  return parts.join(" ")
}
