import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"
import { EventType } from "../../src/types/event"

const EventTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type EventTypeApiResponse = {
  success: boolean
  data: EventType | EventType[]
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
      error: "Event type ID is required",
    })
  }

  if (!z.string().uuid().safeParse(id).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid event type ID format",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/event-types/[id] - Retrieve a specific event type
        console.log(`[v0] GET /api/event-types/${id} - Fetching event type`)

        const { data: singleData, error: singleError } = await supabase
          .from("event_types")
          .select("*")
          .eq("id", id)
          .single()

        if (singleError) {
          if (singleError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Event type not found, id: ${id}`,
            })
          }
          console.error("[v0] Database error:", singleError)
          return res.status(500).json({
            success: false,
            error: `Failed to fetch event type, id: ${id}`,
          })
        }

        return res.json({
          success: true,
          data: singleData,
        })

      case "PUT":
        // PUT /api/event-types/[id] - Update an existing event type
        console.log(`[v0] PUT /api/event-types/${id} - Updating event type`)

        const updateData = EventTypeSchema.parse(req.body)

        const { data: updatedData, error: updateError } = await supabase
          .from("event_types")
          .update({
            name: updateData.name,
            code: updateData.code || null,
            description: updateData.description || null,
            color: updateData.color || "#6B7280",
            icon: updateData.icon || null,
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
              error: `Event type not found, update data: ${JSON.stringify(updateData)}`,
            })
          }
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update event type",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "Event type updated successfully",
        })

      case "DELETE":
        // DELETE /api/event-types/[id] - Delete an event type
        console.log(`[v0] DELETE /api/event-types/${id} - Deleting event type`)

        const { data: deletedData, error: deleteError } = await supabase
          .from("event_types")
          .delete()
          .eq("id", id)
          .select()
          .single()

        if (deleteError) {
          if (deleteError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Event type not found",
            })
          }
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete event type",
          })
        }

        return res.json({
          success: true,
          data: deletedData,
          message: "Event type deleted successfully",
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
