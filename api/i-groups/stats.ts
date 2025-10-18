import type { VercelRequest, VercelResponse } from "@vercel/node"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

/**
 * Parse radius parameter which may have "mi" suffix (e.g., "25mi", "25.00mi")
 * Returns radius in miles as a number, or null if invalid
 */
function parseRadius(radiusParam: string | string[] | undefined): number | null {
  if (!radiusParam) return null
  const radiusStr = Array.isArray(radiusParam) ? radiusParam[0] : radiusParam
  // Remove "mi" suffix if present
  const cleanRadius = radiusStr.replace(/mi$/i, "").trim()
  const radius = parseFloat(cleanRadius)
  return isNaN(radius) ? null : radius
}

/**
 * Handle geolocation-based statistics
 * Returns stats for overall, area, community, and nearby groups
 */
async function handleGeolocationStats(
  res: VercelResponse,
  latitude: number,
  longitude: number,
  radiusMiles: number,
) {
  try {
    const radiusMeters = radiusMiles * 1609.34 // Convert miles to meters

    // Get overall stats first
    const { count: totalCount } = await supabase.from("i_groups").select("*", { count: "exact", head: true })
    const { count: activeCount } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
    const { count: inactiveCount } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)
    const { count: acceptingInitiatedCount } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_accepting_initiated_visitors", true)
      .eq("is_active", true)
    const { count: acceptingUninitiatedCount } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_accepting_uninitiated_visitors", true)
      .eq("is_active", true)

    // Find area containing the point using PostGIS
    const { data: areas, error: areaError } = await supabase.rpc("find_area_by_point", {
      point_lon: longitude,
      point_lat: latitude,
    })

    let areaStats = null
    if (!areaError && areas && areas.length > 0) {
      const areaId = areas[0].id

      // Get group counts for this area
      const { count: areaActive } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("area_id", areaId)
        .eq("is_active", true)
      const { count: areaTotal } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("area_id", areaId)
      const { count: areaAcceptingInitiated } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("area_id", areaId)
        .eq("is_active", true)
        .eq("is_accepting_initiated_visitors", true)
      const { count: areaAcceptingUninitiated } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("area_id", areaId)
        .eq("is_active", true)
        .eq("is_accepting_uninitiated_visitors", true)

      areaStats = {
        id: areas[0].id,
        name: areas[0].name,
        code: areas[0].code,
        active: areaActive || 0,
        inactive: (areaTotal || 0) - (areaActive || 0),
        total: areaTotal || 0,
        accepting_initiated_visitors: areaAcceptingInitiated || 0,
        accepting_uninitiated_visitors: areaAcceptingUninitiated || 0,
      }
    }

    // Find community containing the point using PostGIS
    const { data: communities, error: communityError } = await supabase.rpc("find_community_by_point", {
      point_lon: longitude,
      point_lat: latitude,
    })

    let communityStats = null
    if (!communityError && communities && communities.length > 0) {
      const communityId = communities[0].id

      // Get group counts for this community
      const { count: communityActive } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("is_active", true)
      const { count: communityTotal } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
      const { count: communityAcceptingInitiated } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("is_active", true)
        .eq("is_accepting_initiated_visitors", true)
      const { count: communityAcceptingUninitiated } = await supabase
        .from("i_groups")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("is_active", true)
        .eq("is_accepting_uninitiated_visitors", true)

      communityStats = {
        id: communities[0].id,
        name: communities[0].name,
        code: communities[0].code,
        active: communityActive || 0,
        inactive: (communityTotal || 0) - (communityActive || 0),
        total: communityTotal || 0,
        accepting_initiated_visitors: communityAcceptingInitiated || 0,
        accepting_uninitiated_visitors: communityAcceptingUninitiated || 0,
      }
    }

    // Find nearby groups within radius using PostGIS
    const { data: nearbyGroups, error: nearbyError } = await supabase.rpc("find_igroups_within_radius", {
      point_lon: longitude,
      point_lat: latitude,
      radius_meters: radiusMeters,
    })

    const nearbyStats = {
      radius_miles: radiusMiles,
      latitude,
      longitude,
      active: 0,
      inactive: 0,
      total: 0,
      accepting_initiated_visitors: 0,
      accepting_uninitiated_visitors: 0,
    }

    if (!nearbyError && nearbyGroups) {
      const activeNearby = nearbyGroups.filter((g: any) => g.is_active === true)
      const acceptingInitiated = nearbyGroups.filter(
        (g: any) => g.is_active === true && g.is_accepting_initiated_visitors === true,
      )
      const acceptingUninitiated = nearbyGroups.filter(
        (g: any) => g.is_active === true && g.is_accepting_uninitiated_visitors === true,
      )
      nearbyStats.active = activeNearby.length
      nearbyStats.total = nearbyGroups.length
      nearbyStats.inactive = nearbyStats.total - nearbyStats.active
      nearbyStats.accepting_initiated_visitors = acceptingInitiated.length
      nearbyStats.accepting_uninitiated_visitors = acceptingUninitiated.length
    }

    return res.json({
      success: true,
      data: {
        total: totalCount || 0,
        active: activeCount || 0,
        inactive: inactiveCount || 0,
        accepting_initiated_visitors: acceptingInitiatedCount || 0,
        accepting_uninitiated_visitors: acceptingUninitiatedCount || 0,
        area: areaStats,
        community: communityStats,
        nearby: nearbyStats,
      },
    })
  } catch (error) {
    console.error("[v0] Geolocation stats error:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch geolocation statistics",
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({
      success: false,
      error: "Database not configured",
    })
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
    })
  }

  try {
    console.log("[v0] GET /api/i-groups/stats - Fetching integration group statistics")

    // Parse geolocation parameters (flexible parameter names)
    const { lat, latitude, lon, longitude, rad, radius } = req.query
    const latParam = lat || latitude
    const lonParam = lon || longitude
    const radParam = rad || radius

    const hasGeolocation = latParam && lonParam

    if (hasGeolocation) {
      const latitude = parseFloat(Array.isArray(latParam) ? latParam[0] : latParam as string)
      const longitude = parseFloat(Array.isArray(lonParam) ? lonParam[0] : lonParam as string)
      const radiusMiles = parseRadius(radParam) || 50 // Default to 50 miles

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          error: "Invalid latitude or longitude parameters",
        })
      }

      console.log(`[v0] Geolocation stats requested: lat=${latitude}, lon=${longitude}, radius=${radiusMiles}mi`)

      // Fetch geolocation-based statistics
      return await handleGeolocationStats(res, latitude, longitude, radiusMiles)
    }

    // Default behavior: return overall statistics
    console.log("[v0] Returning overall statistics (no geolocation)")

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })

    if (totalError) {
      console.error("[v0] Total count error:", totalError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch total count",
      })
    }

    // Get active count
    const { count: activeCount, error: activeError } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    if (activeError) {
      console.error("[v0] Active count error:", activeError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch active count",
      })
    }

    // Get inactive count
    const { count: inactiveCount, error: inactiveError } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)

    if (inactiveError) {
      console.error("[v0] Inactive count error:", inactiveError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch inactive count",
      })
    }

    // Get accepting initiated visitors count
    const { count: acceptingInitiatedCount, error: acceptingInitiatedError } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_accepting_initiated_visitors", true)
      .eq("is_active", true)

    if (acceptingInitiatedError) {
      console.error("[v0] Accepting initiated visitors count error:", acceptingInitiatedError)
    }

    // Get accepting uninitiated visitors count
    const { count: acceptingUninitiatedCount, error: acceptingUninitiatedError } = await supabase
      .from("i_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_accepting_uninitiated_visitors", true)
      .eq("is_active", true)

    if (acceptingUninitiatedError) {
      console.error("[v0] Accepting uninitiated visitors count error:", acceptingUninitiatedError)
    }

    return res.json({
      success: true,
      data: {
        total: totalCount || 0,
        active: activeCount || 0,
        inactive: inactiveCount || 0,
        accepting_initiated_visitors: acceptingInitiatedCount || 0,
        accepting_uninitiated_visitors: acceptingUninitiatedCount || 0,
      },
    })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
