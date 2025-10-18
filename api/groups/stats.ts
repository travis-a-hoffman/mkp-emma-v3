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

    // Get overall stats (excluding soft-deleted records)
    const { count: total } = await supabase
      .from("groups")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
    const { count: active } = await supabase
      .from("groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .is("deleted_at", null)

    const inactive = (total || 0) - (active || 0)

    // Find area containing the point using PostGIS
    const { data: areas, error: areaError } = await supabase.rpc("find_area_by_point", {
      point_lon: longitude,
      point_lat: latitude,
    })

    let areaStats = null
    if (!areaError && areas && areas.length > 0) {
      const areaId = areas[0].id

      // Note: groups table doesn't have area_id, so area stats are not available for general groups
      // This would apply to i_groups or f_groups which have area_id
      areaStats = {
        id: areas[0].id,
        name: areas[0].name,
        code: areas[0].code,
        active: 0,
        inactive: 0,
        total: 0,
        accepting_initiated_visitors: 0,
        accepting_uninitiated_visitors: 0,
        note: "Area association not available for general groups table",
      }
    }

    // Find community containing the point using PostGIS
    const { data: communities, error: communityError } = await supabase.rpc("find_community_by_point", {
      point_lon: longitude,
      point_lat: latitude,
    })

    let communityStats = null
    if (!communityError && communities && communities.length > 0) {
      communityStats = {
        id: communities[0].id,
        name: communities[0].name,
        code: communities[0].code,
        active: 0,
        inactive: 0,
        total: 0,
        accepting_initiated_visitors: 0,
        accepting_uninitiated_visitors: 0,
        note: "Community association not available for general groups table",
      }
    }

    // Find nearby groups within radius using PostGIS
    const { data: nearbyGroups, error: nearbyError } = await supabase.rpc("find_groups_within_radius", {
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
      const activeNearby = nearbyGroups.filter((g: any) => g.is_active === true && !g.deleted_at)
      nearbyStats.active = activeNearby.length
      nearbyStats.total = nearbyGroups.filter((g: any) => !g.deleted_at).length
      nearbyStats.inactive = nearbyStats.total - nearbyStats.active
      // General groups don't have visitor acceptance fields
      nearbyStats.accepting_initiated_visitors = 0
      nearbyStats.accepting_uninitiated_visitors = 0
    }

    return res.json({
      success: true,
      data: {
        active: active || 0,
        inactive: inactive || 0,
        total: total || 0,
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
    // Parse geolocation parameters (flexible parameter names)
    const { lat, latitude, lon, longitude, rad, radius } = req.query
    const latParam = lat || latitude
    const lonParam = lon || longitude
    const radParam = rad || radius

    const hasGeolocation = latParam && lonParam

    if (hasGeolocation) {
      const latitude = parseFloat(Array.isArray(latParam) ? latParam[0] : (latParam as string))
      const longitude = parseFloat(Array.isArray(lonParam) ? lonParam[0] : (lonParam as string))
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

    // Default behavior: return overall statistics (excluding soft-deleted records)
    const { count: total, error: totalError } = await supabase
      .from("groups")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)

    if (totalError) throw totalError

    // Get active count (excluding soft-deleted records)
    const { count: active, error: activeError } = await supabase
      .from("groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .is("deleted_at", null)

    if (activeError) throw activeError

    const inactive = (total || 0) - (active || 0)

    return res.status(200).json({
      success: true,
      data: {
        active: active || 0,
        inactive: inactive || 0,
        total: total || 0,
      },
    })
  } catch (error) {
    console.error("Error fetching group stats:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch group stats",
    })
  }
}
