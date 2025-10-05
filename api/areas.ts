import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { Area } from "../src/types/area"

const AreaSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(6, "Code must be 6 characters or less"),
  description: z.string().optional().nullable(),
  steward_id: z.string().uuid().optional().nullable(),
  finance_coordinator_id: z.string().uuid().optional().nullable(),
  geo_polygon: z.any().optional().nullable(),
  color: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

export type AreaApiResponse = {
  success: boolean
  data: Area | Area[]
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
        // GET /api/areas - Retrieve all areas
        console.log("[v0] GET /api/areas - Fetching all areas")

        const { active, search } = query

        let dbQuery = supabase.from("areas").select(`
            *,
            area_admins(
              people(
                id,
                first_name,
                middle_name,
                last_name,
                email,
                photo_url
              )
            )
          `)

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
            error: "Failed to fetch areas",
          })
        }

        const transformedData =
          data?.map((area: any) => ({
            ...area,
            admins: area.area_admins?.map((admin: any) => admin.people).filter(Boolean) || [],
          })) || []

        // Remove the area_admins property as it's now flattened to admins
        transformedData.forEach((area: any) => {
          delete area.area_admins
        })

        return res.json({
          success: true,
          data: transformedData,
          count: transformedData.length,
        })

      case "POST":
        // POST /api/areas - Create a new area
        console.log("[v0] POST /api/areas - Creating new area")

        const validatedData = AreaSchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          .from("areas")
          .insert({
            name: validatedData.name,
            code: validatedData.code,
            description: validatedData.description || null,
            steward_id: validatedData.steward_id || null,
            finance_coordinator_id: validatedData.finance_coordinator_id || null,
            geo_polygon: validatedData.geo_polygon || null,
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
              error: "Area code must be unique",
            })
          }
          return res.status(500).json({
            success: false,
            error: "Failed to create area",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "Area created successfully",
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
