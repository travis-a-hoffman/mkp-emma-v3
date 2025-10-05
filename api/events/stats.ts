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
    const { nwta } = req.query

    // Get the list of eventTypes
    let etQuery = supabase.from("event_types").select("*")

    if (!(nwta === "include")) {
      etQuery = etQuery.neq("code", "NWTA")
    }

    const { data: etData, error: etError, count: etCount } = await etQuery

    if (etError) {
      console.error("Database error:", etError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch event type codes",
        details: etError,
      })
    }
    const etIds = etData.map((et: any) => et["id"])

    const totalQuery = supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .in("event_type_id", etIds || [])
    const { count: total, error: totalError } = await totalQuery

    if (totalError) throw totalError

    // Get active count
    const activeQuery = supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .in("event_type_id", etIds || [])
    const { count: active, error: activeError } = await activeQuery

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
    console.error("Error fetching event stats:", error)
    return res.status(500).json({
      success: false,
      error: "Failed to fetch event stats",
    })
  }
}
