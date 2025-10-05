import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

const PersonSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string(),
  middle_name: z.string().nullable().optional(),
  last_name: z.string(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
})

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  url: z.string().url().nullable().optional(),
  members: z.array(PersonSchema).default([]),
  is_accepting_new_members: z.boolean().default(false),
  membership_criteria: z.string().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  genders: z.string().nullable().optional(),
  is_publicly_listed: z.boolean().default(false),
  public_contact_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().default(true),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

  try {
    if (req.method === "GET") {
      const { active, search, publicly_listed } = req.query
      console.log("[v0] GET /api/groups — req.query: ", JSON.stringify(req.query))

      let query = supabase
        .from("groups")
        .select(`
          *,
          venue:venues(
            id,
            name,
            phone,
            email,
            website,
            timezone,
            physical_address:addresses!physical_address_id(
              id,
              address_1,
              address_2,
              city,
              state,
              postal_code,
              country
            )
          ),
          public_contact:people!public_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url),
          primary_contact:people!primary_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      // Filter by active status
      if (active === "true") {
        query = query.eq("is_active", true)
      } else if (active === "false") {
        query = query.eq("is_active", false)
      }

      // Filter by publicly listed status
      if (publicly_listed === "true") {
        query = query.eq("is_publicly_listed", true)
      } else if (publicly_listed === "false") {
        query = query.eq("is_publicly_listed", false)
      }

      // Search functionality
      if (search && typeof search === "string") {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch groups",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        count: count || 0,
      })
    } else if (req.method === "POST") {
      const validation = CreateGroupSchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        })
      }

      const groupData = validation.data

      const { data, error } = await supabase
        .from("groups")
        .insert([groupData])
        .select(`
          *,
          venue:venues(
            id,
            name,
            phone,
            email,
            website,
            timezone,
            physical_address:addresses!physical_address_id(
              id,
              address_1,
              address_2,
              city,
              state,
              postal_code,
              country
            )
          ),
          public_contact:people!public_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url),
          primary_contact:people!primary_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url)
        `)
        .single()

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to create group",
          details: error,
        })
      }

      return res.status(201).json({
        success: true,
        data,
        message: "Group created successfully",
      })
    } else {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      })
    }
  } catch (error) {
    console.error("API error:", error)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
