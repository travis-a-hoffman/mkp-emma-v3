import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"
import type { Area } from "../../src/types/area"

const AreaSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(6, "Code must be 6 characters or less"),
  description: z.string().optional().nullable(),
  steward_id: z.string().uuid().optional().nullable(),
  finance_coordinator_id: z.string().uuid().optional().nullable(),
  geo_json: z.any().optional().nullable(),
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
  const id = query.id as string

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Area ID is required",
    })
  }

  if (!z.string().uuid().safeParse(id).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid area ID format",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/areas/[id] - Retrieve a specific area
        console.log(`[v0] GET /api/areas/${id} - Fetching area`)

        const { data: singleData, error: singleError } = await supabase
          .from("areas")
          .select(`
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
          .eq("id", id)
          .single()

        if (singleError) {
          if (singleError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Area not found, id: ${id}`,
            })
          }
          console.error("[v0] Database error:", singleError)
          return res.status(500).json({
            success: false,
            error: `Failed to fetch area, id: ${id}`,
          })
        }

        const transformedSingleData = {
          ...singleData,
          admins: singleData.area_admins?.map((admin: any) => admin.people) || [],
        }
        delete transformedSingleData.area_admins

        return res.json({
          success: true,
          data: transformedSingleData,
        })

      case "PUT":
        // PUT /api/areas/[id] - Update an existing area
        console.log(`[v0] PUT /api/areas/${id} - Updating area`)

        const updateData = AreaSchema.parse(req.body)

        const { data: updatedData, error: updateError } = await supabase
          .from("areas")
          .update({
            name: updateData.name,
            code: updateData.code,
            description: updateData.description || null,
            steward_id: updateData.steward_id || null,
            finance_coordinator_id: updateData.finance_coordinator_id || null,
            geo_json: updateData.geo_json || null,
            color: updateData.color || null,
            is_active: updateData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single()

        if (updateError) {
          if (updateError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Area not found, update data: ${JSON.stringify(updateData)}`,
            })
          }
          if (updateError.code === "23505") {
            return res.status(400).json({
              success: false,
              error: "Area code must be unique",
            })
          }
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update area",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "Area updated successfully",
        })

      case "DELETE":
        // DELETE /api/areas/[id] - Archive an area (set is_active to false)
        console.log(`[v0] DELETE /api/areas/${id} - Archiving area`)

        const { data: archivedData, error: archiveError } = await supabase
          .from("areas")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single()

        if (archiveError) {
          if (archiveError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Area not found",
            })
          }
          console.error("[v0] Database error:", archiveError)
          return res.status(500).json({
            success: false,
            error: "Failed to archive area",
          })
        }

        return res.json({
          success: true,
          data: archivedData,
          message: "Area archived successfully",
        })

      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"])
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
