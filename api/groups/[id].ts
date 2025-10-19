import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const PersonSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string(),
  middle_name: z.string().nullable().optional(),
  last_name: z.string(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
})

const UpdateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  url: z.string().url().nullable().optional(),
  members: z.array(PersonSchema).optional(),
  is_accepting_new_members: z.boolean().optional(),
  membership_criteria: z.string().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  genders: z.string().nullable().optional(),
  is_publicly_listed: z.boolean().optional(),
  public_contact_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  established_on: z.string().nullable().optional(),
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

  const { id } = req.query

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      success: false,
      error: "Group ID is required",
    })
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
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
        .eq("id", id)
        .is("deleted_at", null)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Group not found",
          })
        }
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch group",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data,
      })
    } else if (req.method === "PUT") {
      const validation = UpdateGroupSchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        })
      }

      const updateData = validation.data

      const { data, error } = await supabase
        .from("groups")
        .update(updateData)
        .eq("id", id)
        .is("deleted_at", null)
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
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Group not found",
          })
        }
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to update group",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data,
        message: "Group updated successfully",
      })
    } else if (req.method === "DELETE") {
      // Soft delete by setting deleted_at timestamp
      const { data, error } = await supabase
        .from("groups")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id)
        .is("deleted_at", null)
        .select()
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Group not found",
          })
        }
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to delete group",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data,
        message: "Group deleted successfully",
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
