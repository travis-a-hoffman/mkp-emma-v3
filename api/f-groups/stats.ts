import type { VercelRequest, VercelResponse } from "@vercel/node"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

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
    // Get active count
    const { count: activeCount, error: activeError } = await supabase
      .from("f_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    if (activeError) {
      console.error("[v0] Database error fetching active facilitation groups:", activeError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch active facilitation groups count",
      })
    }

    // Get inactive count
    const { count: inactiveCount, error: inactiveError } = await supabase
      .from("f_groups")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)

    if (inactiveError) {
      console.error("[v0] Database error fetching inactive facilitation groups:", inactiveError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch inactive facilitation groups count",
      })
    }

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from("f_groups")
      .select("*", { count: "exact", head: true })

    if (totalError) {
      console.error("[v0] Database error fetching total facilitation groups:", totalError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch total facilitation groups count",
      })
    }

    // Get counts by group type
    const { data: groupTypeData, error: groupTypeError } = await supabase
      .from("f_groups")
      .select("group_type")
      .eq("is_active", true)

    if (groupTypeError) {
      console.error("[v0] Database error fetching group type counts:", groupTypeError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch group type counts",
      })
    }

    // Count facilitation groups by type
    const groupTypeCounts =
      groupTypeData?.reduce((acc: Record<string, number>, fGroup: any) => {
        acc[fGroup.group_type] = (acc[fGroup.group_type] || 0) + 1
        return acc
      }, {}) || {}

    return res.json({
      success: true,
      data: {
        active: activeCount || 0,
        inactive: inactiveCount || 0,
        total: totalCount || 0,
        by_group_type: groupTypeCounts,
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
