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
      .from("warriors")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    if (activeError) {
      console.error("[v0] Database error fetching active warriors:", activeError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch active warriors count",
      })
    }

    // Get inactive count
    const { count: inactiveCount, error: inactiveError } = await supabase
      .from("warriors")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)

    if (inactiveError) {
      console.error("[v0] Database error fetching inactive warriors:", inactiveError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch inactive warriors count",
      })
    }

    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from("warriors")
      .select("*", { count: "exact", head: true })

    if (totalError) {
      console.error("[v0] Database error fetching total warriors:", totalError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch total warriors count",
      })
    }

    // Get counts by status
    const { data: statusData, error: statusError } = await supabase
      .from("warriors")
      .select("status")
      .eq("is_active", true)

    if (statusError) {
      console.error("[v0] Database error fetching warrior status counts:", statusError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch warrior status counts",
      })
    }

    // Count warriors by status
    const statusCounts =
      statusData?.reduce((acc: Record<string, number>, warrior: any) => {
        acc[warrior.status] = (acc[warrior.status] || 0) + 1
        return acc
      }, {}) || {}

    return res.json({
      success: true,
      data: {
        active: activeCount || 0,
        inactive: inactiveCount || 0,
        total: totalCount || 0,
        by_status: statusCounts,
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
