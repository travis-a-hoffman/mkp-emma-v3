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
    // Get total count
    const { count: total, error: totalError } = await supabase
      .from("prospects")
      .select("*", { count: "exact", head: true })

    if (totalError) throw totalError

    // Get active count
    const { count: active, error: activeError } = await supabase
      .from("prospects")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

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
    console.error("Error fetching prospects stats:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch prospects stats",
    })
  }
}
