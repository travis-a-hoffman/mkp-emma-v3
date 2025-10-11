import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { Community } from "../src/types/community"

const CommunitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(6, "Code must be 6 characters or less"),
  description: z.string().optional().nullable(),
  area_id: z.string().uuid().optional().nullable(),
  coordinator_id: z.string().uuid().optional().nullable(),
  geo_json: z.any().optional().nullable(),
  image_url: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

export type CommunityApiResponse = {
  success: boolean
  data: Community | Community[]
  count: number
  error?: string
  message?: string
  details?: z.ZodError[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
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

  const { method, query } = req

  try {
    switch (method) {
      case "GET":
        // GET /api/communities - Retrieve all communities
        console.log("[v0] GET /api/communities - Fetching all communities")

        const { active, search } = query

        let dbQuery = supabase.from("communities").select("*")

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("is_active", isActive)
        }

        if (search && typeof search === "string") {
          dbQuery = dbQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch communities",
          })
        }

        return res.json({
          success: true,
          data: data || [],
          count: data?.length || 0,
        })

      case "POST":
        // POST /api/communities - Create a new community
        console.log("[v0] POST /api/communities - Creating new community")

        const validatedData = CommunitySchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          .from("communities")
          .insert({
            name: validatedData.name,
            code: validatedData.code,
            description: validatedData.description || null,
            area_id: validatedData.area_id || null,
            coordinator_id: validatedData.coordinator_id || null,
            geo_json: validatedData.geo_json || null,
            image_url: validatedData.image_url || null,
            color: validatedData.color || null,
            is_active: validatedData.is_active,
          })
          .select()
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          if (createError.code === "23505") {
            return res.status(400).json({
              success: false,
              error: "Community code must be unique",
            })
          }
          return res.status(500).json({
            success: false,
            error: "Failed to create community",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "Community created successfully",
        })

      default:
        res.setHeader("Allow", ["GET", "POST"])
        return res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`,
        })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      })
    }

    console.error("[v0] Server error:", error)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
