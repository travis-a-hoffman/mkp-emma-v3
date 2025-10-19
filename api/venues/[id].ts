import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const VenueUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  timezone: z.string().optional(), // Added timezone field for proper datetime handling
  mailing_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  physical_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  event_types: z.array(z.any()).optional(),
  primary_contact_id: z.string().uuid().optional().nullable().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  area_id: z.string().uuid().optional().nullable().or(z.literal("")),
  community_id: z.string().uuid().optional().nullable().or(z.literal("")),
  nudity_note: z.string().optional().nullable(),
  rejected_note: z.string().optional().nullable(),
  is_nudity: z.boolean().optional(),
  is_rejected: z.boolean().optional(),
  is_private_residence: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS")
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
  const { id } = query

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      success: false,
      error: "Venue ID is required",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/venues/[id] - Retrieve a specific venue
        console.log(`[v0] GET /api/venues/${id} - Fetching venue`)

        const { data, error } = await supabase
          .from("venues")
          .select(`
            *,
            mailing_address:addresses!mailing_address_id(
              id,
              address_1,
              address_2,
              city,
              state,
              postal_code,
              country
            ),
            physical_address:addresses!physical_address_id(
              id,
              address_1,
              address_2,
              city,
              state,
              postal_code,
              country
            )
          `)
          .eq("id", id)
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          if (error.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Venue not found",
            })
          }
          return res.status(500).json({
            success: false,
            error: "Failed to fetch venue",
          })
        }

        return res.json({
          success: true,
          data,
        })

      case "PUT":
        // PUT /api/venues/[id] - Update a venue
        console.log(`[v0] PUT /api/venues/${id} - Updating venue`)

        const validatedData = VenueUpdateSchema.parse(req.body)

        const updateData: any = {}
        Object.keys(validatedData).forEach((key) => {
          const value = (validatedData as any)[key]
          if (value !== undefined) {
            updateData[key] = value === "" ? null : value
          }
        })

        const { data: updatedData, error: updateError } = await supabase
          .from("venues")
          .update(updateData)
          .eq("id", id)
          .select(`
            *,
            mailing_address:addresses!mailing_address_id(
              id,
              address_1,
              address_2,
              city,
              state,
              postal_code,
              country
            ),
            physical_address:addresses!physical_address_id(
              id,
              address_1,
              address_2,
              city,
              state,
              postal_code,
              country
            )
          `)
          .single()

        if (updateError) {
          console.error("[v0] Database error:", updateError)
          if (updateError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Venue not found",
            })
          }
          return res.status(500).json({
            success: false,
            error: "Failed to update venue",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "Venue updated successfully",
        })

      case "DELETE":
        // DELETE /api/venues/[id] - Delete a venue (soft delete)
        console.log(`[v0] DELETE /api/venues/${id} - Soft deleting venue`)

        const { data: deletedData, error: deleteError } = await supabase
          .from("venues")
          .update({ is_active: false })
          .eq("id", id)
          .select()
          .single()

        if (deleteError) {
          console.error("[v0] Database error:", deleteError)
          if (deleteError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Venue not found",
            })
          }
          return res.status(500).json({
            success: false,
            error: "Failed to delete venue",
          })
        }

        return res.json({
          success: true,
          data: deletedData,
          message: "Venue deleted successfully",
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
