import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

interface Person {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  email?: string
  phone?: string
  billing_address_id?: string
  mailing_address_id?: string
  physical_address_id?: string
  notes?: string
  photo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const PersonSchema = z.object({
  id: z.string().uuid().optional(),
  first_name: z.string().min(1, "First name is required"),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  billing_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  mailing_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  physical_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable().or(z.literal("")),
  is_active: z.boolean().default(true),
})

export type PersonApiResponse = {
  success: boolean
  data: Person | Person[]
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
        // GET /api/people - Retrieve all people
        console.log("[v0] GET /api/people - Fetching all people")

        const { active } = query
        let dbQuery = supabase.from("people").select("*")

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("is_active", isActive)
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch people",
          })
        }

        return res.json({
          success: true,
          data: data || [],
          count: data?.length || 0,
        })

      case "POST":
        // POST /api/people - Create a new person
        console.log("[v0] POST /api/people - Creating new person")

        const validatedData = PersonSchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          .from("people")
          .insert({
            first_name: validatedData.first_name,
            middle_name: validatedData.middle_name || null,
            last_name: validatedData.last_name,
            email: validatedData.email || null,
            phone: validatedData.phone || null,
            billing_address_id: validatedData.billing_address_id || null,
            mailing_address_id: validatedData.mailing_address_id || null,
            physical_address_id: validatedData.physical_address_id || null,
            notes: validatedData.notes || null,
            photo_url: validatedData.photo_url || null,
            is_active: validatedData.is_active,
          })
          .select()
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create person",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "Person created successfully",
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
