import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"
import type { Community } from "../../src/types/community"

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
  const id = query.id as string

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Community ID is required",
    })
  }

  if (!z.string().uuid().safeParse(id).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid community ID format",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/communities/[id] - Retrieve a specific community
        console.log(`[v0] GET /api/communities/${id} - Fetching community`)

        const { data: singleData, error: singleError } = await supabase
          .from("communities")
          .select("*")
          .eq("id", id)
          .single()

        if (singleError) {
          if (singleError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Community not found, id: ${id}`,
            })
          }
          console.error("[v0] Database error:", singleError)
          return res.status(500).json({
            success: false,
            error: `Failed to fetch community, id: ${id}`,
          })
        }

        return res.json({
          success: true,
          data: singleData,
        })

      case "PUT":
        // PUT /api/communities/[id] - Update an existing community
        console.log(`[v0] PUT /api/communities/${id} - Updating community`)

        const updateData = CommunitySchema.parse(req.body)

        const { data: updatedData, error: updateError } = await supabase
          .from("communities")
          .update({
            name: updateData.name,
            code: updateData.code,
            description: updateData.description || null,
            area_id: updateData.area_id || null,
            coordinator_id: updateData.coordinator_id || null,
            geo_json: updateData.geo_json || null,
            image_url: updateData.image_url || null,
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
              error: `Community not found, update data: ${JSON.stringify(updateData)}`,
            })
          }
          if (updateError.code === "23505") {
            return res.status(400).json({
              success: false,
              error: "Community code must be unique",
            })
          }
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update community",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "Community updated successfully",
        })

      case "DELETE":
        // DELETE /api/communities/[id] - Archive a community (set is_active to false)
        console.log(`[v0] DELETE /api/communities/${id} - Archiving community`)

        const { data: archivedData, error: archiveError } = await supabase
          .from("communities")
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
              error: "Community not found",
            })
          }
          console.error("[v0] Database error:", archiveError)
          return res.status(500).json({
            success: false,
            error: "Failed to archive community",
          })
        }

        return res.json({
          success: true,
          data: archivedData,
          message: "Community archived successfully",
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
