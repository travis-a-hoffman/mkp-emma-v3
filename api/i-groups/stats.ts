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
    console.log("[v0] GET /api/i-groups/stats - Fetching integration group statistics")

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
