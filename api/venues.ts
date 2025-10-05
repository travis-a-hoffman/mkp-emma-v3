import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

interface Venue {
  id: string
  name: string
  description?: string
  email?: string
  phone?: string
  website?: string
  timezone: string
  mailing_address_id?: string
  physical_address_id?: string
  event_types: any[]
  primary_contact_id?: string
  latitude?: number
  longitude?: number
  area_id?: string
  community_id?: string
  nudity_note?: string
  rejected_note?: string
  is_nudity: boolean
  is_rejected: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  mailing_address?: {
    id: string
    address_1: string
    address_2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  physical_address?: {
    id: string
    address_1: string
    address_2: string
    city: string
    state: string
    postal_code: string
    country: string
  }
}

const VenueSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  timezone: z.string().default("America/New_York"),
  mailing_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  physical_address_id: z.string().uuid().optional().nullable().or(z.literal("")),
  event_types: z.array(z.any()).default([]),
  primary_contact_id: z.string().uuid().optional().nullable().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  area_id: z.string().uuid().optional().nullable().or(z.literal("")),
  community_id: z.string().uuid().optional().nullable().or(z.literal("")),
  nudity_note: z.string().optional().nullable(),
  rejected_note: z.string().optional().nullable(),
  is_nudity: z.boolean().default(false),
  is_rejected: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

export type VenueApiResponse = {
  success: boolean
  data: Venue | Venue[]
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
        // GET /api/venues - Retrieve all venues
        console.log("[v0] GET /api/venues - Fetching all venues")

        const { active, search, rejected } = query
        let dbQuery = supabase.from("venues").select(`
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

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("is_active", isActive)
        }

        if (rejected !== undefined) {
          const isRejected = rejected === "true"
          dbQuery = dbQuery.eq("is_rejected", isRejected)
        }

        if (search && typeof search === "string") {
          dbQuery = dbQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch venues",
          })
        }

        return res.json({
          success: true,
          data: data || [],
          count: data?.length || 0,
        })

      case "POST":
        // POST /api/venues - Create a new venue
        console.log("[v0] POST /api/venues - Creating new venue")

        const validatedData = VenueSchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          .from("venues")
          .insert({
            name: validatedData.name,
            description: validatedData.description || null,
            email: validatedData.email || null,
            phone: validatedData.phone || null,
            website: validatedData.website || null,
            timezone: validatedData.timezone,
            mailing_address_id: validatedData.mailing_address_id || null,
            physical_address_id: validatedData.physical_address_id || null,
            event_types: validatedData.event_types,
            primary_contact_id: validatedData.primary_contact_id || null,
            latitude: validatedData.latitude || null,
            longitude: validatedData.longitude || null,
            area_id: validatedData.area_id || null,
            community_id: validatedData.community_id || null,
            nudity_note: validatedData.nudity_note || null,
            rejected_note: validatedData.rejected_note || null,
            is_nudity: validatedData.is_nudity,
            is_rejected: validatedData.is_rejected,
            is_active: validatedData.is_active,
          })
          .select()
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create venue",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "Venue created successfully",
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
