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
    const { count: approvedCount, error: approvedError } = await supabase
      .from("emma_users")
      .select("*", { count: "exact", head: true })
      .not("approved_at", "is", null)

    if (approvedError) {
      console.error("[v0] Database error fetching approved users:", approvedError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch approved users count",
      })
    }

    const { count: pendingCount, error: pendingError } = await supabase
      .from("emma_users")
      .select("*", { count: "exact", head: true })
      .is("approved_at", null)

    if (pendingError) {
      console.error("[v0] Database error fetching pending users:", pendingError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch pending users count",
      })
    }

    const { count: totalCount, error: totalError } = await supabase
      .from("emma_users")
      .select("*", { count: "exact", head: true })

    if (totalError) {
      console.error("[v0] Database error fetching total users:", totalError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch total users count",
      })
    }

    const { data: userData, error: userError } = await supabase
      .from("emma_users")
      .select("auth0_user, civicrm_user, drupal_user")

    if (userError) {
      console.error("[v0] Database error fetching user auth sources:", userError)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch user authentication sources",
      })
    }

    const authSourceCounts =
      userData?.reduce((acc: Record<string, number>, user: any) => {
        if (user.auth0_user) acc.auth0 = (acc.auth0 || 0) + 1
        if (user.civicrm_user) acc.civicrm = (acc.civicrm || 0) + 1
        if (user.drupal_user) acc.drupal = (acc.drupal || 0) + 1
        return acc
      }, {}) || {}

    return res.json({
      success: true,
      data: {
        approved: approvedCount || 0,
        pending: pendingCount || 0,
        total: totalCount || 0,
        by_auth_source: authSourceCounts,
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
