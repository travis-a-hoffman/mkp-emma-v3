import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { EventType } from "../src/types/event"

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

  try {
    switch (method) {
      case "GET":
        // GET /api/event-types - Retrieve all event types
        console.log("[v0] GET /api/event-types - Fetching all event types")

        const { active } = query
        let dbQuery = supabase?.from("event_types").select("*")

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("is_active", isActive)
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch event types, db query: " + dbQuery.toString(),
          })
        }

        return res.json({
          success: true,
          data: data || [],
          count: data?.length || 0,
        })

      case "POST":
        // POST /api/event-types - Create a new event type
        console.log("[v0] POST /api/event-types - Creating new event type")

        const validatedData = EventTypeSchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          ?.from("event_types")
          .insert({
            name: validatedData.name,
            code: validatedData.code || null,
            description: validatedData.description || null,
            color: validatedData.color || "#6B7280",
            icon: validatedData.icon || null,
            is_active: validatedData.is_active,
          })
          .select()
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create event type",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "Event type created successfully",
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
