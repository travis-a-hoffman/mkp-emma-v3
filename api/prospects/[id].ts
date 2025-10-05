import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const ProspectUpdateSchema = z.object({
  log_id: z.string().uuid().optional().nullable(),
  balked_events: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional(),
  // Person fields
  first_name: z.string().min(1).optional(),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  billing_address_id: z.string().uuid().optional().nullable(),
  mailing_address_id: z.string().uuid().optional().nullable(),
  physical_address_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
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
      error: "Prospect ID is required",
    })
  }

  try {
    switch (method) {
      case "GET":
        console.log(`[v0] GET /api/prospects/${id} - Fetching prospect`)

        const { data, error } = await supabase
          .from("prospects")
          .select(`
            id,
            log_id,
            balked_events,
            is_active,
            created_at,
            updated_at,
            people!inner (
              first_name,
              middle_name,
              last_name,
              email,
              phone,
              billing_address_id,
              mailing_address_id,
              physical_address_id,
              notes,
              photo_url,
              is_active,
              created_at,
              updated_at
            )
          `)
          .eq("id", id)
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(404).json({
            success: false,
            error: "Prospect not found",
          })
        }

        const peopleData = data.people as any
        const transformedData = {
          id: data.id,
          log_id: data.log_id,
          balked_events: data.balked_events || [],
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          first_name: peopleData.first_name,
          middle_name: peopleData.middle_name,
          last_name: peopleData.last_name,
          email: peopleData.email,
          phone: peopleData.phone,
          billing_address_id: peopleData.billing_address_id,
          mailing_address_id: peopleData.mailing_address_id,
          physical_address_id: peopleData.physical_address_id,
          notes: peopleData.notes,
          photo_url: peopleData.photo_url,
        }

        return res.json({
          success: true,
          data: transformedData,
        })

      case "PUT":
        console.log(`[v0] PUT /api/prospects/${id} - Updating prospect`)

        const validatedData = ProspectUpdateSchema.parse(req.body)

        const prospectFields: any = {}
        const personFields: any = {}

        if (validatedData.log_id !== undefined) prospectFields.log_id = validatedData.log_id
        if (validatedData.balked_events !== undefined) prospectFields.balked_events = validatedData.balked_events
        if (validatedData.is_active !== undefined) {
          prospectFields.is_active = validatedData.is_active
          personFields.is_active = validatedData.is_active
        }

        if (validatedData.first_name !== undefined) personFields.first_name = validatedData.first_name
        if (validatedData.middle_name !== undefined) personFields.middle_name = validatedData.middle_name
        if (validatedData.last_name !== undefined) personFields.last_name = validatedData.last_name
        if (validatedData.email !== undefined) personFields.email = validatedData.email
        if (validatedData.phone !== undefined) personFields.phone = validatedData.phone
        if (validatedData.billing_address_id !== undefined)
          personFields.billing_address_id = validatedData.billing_address_id
        if (validatedData.mailing_address_id !== undefined)
          personFields.mailing_address_id = validatedData.mailing_address_id
        if (validatedData.physical_address_id !== undefined)
          personFields.physical_address_id = validatedData.physical_address_id
        if (validatedData.notes !== undefined) personFields.notes = validatedData.notes
        if (validatedData.photo_url !== undefined) personFields.photo_url = validatedData.photo_url

        if (Object.keys(personFields).length > 0) {
          const { error: personUpdateError } = await supabase.from("people").update(personFields).eq("id", id)

          if (personUpdateError) {
            console.error("[v0] Person update error:", personUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update person data",
            })
          }
        }

        if (Object.keys(prospectFields).length > 0) {
          prospectFields.updated_at = new Date().toISOString()

          const { error: prospectUpdateError } = await supabase.from("prospects").update(prospectFields).eq("id", id)

          if (prospectUpdateError) {
            console.error("[v0] Prospect update error:", prospectUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update prospect data",
            })
          }
        }

        const { data: updatedData, error: fetchError } = await supabase
          .from("prospects")
          .select(`
            id,
            log_id,
            balked_events,
            is_active,
            created_at,
            updated_at,
            people!inner (
              first_name,
              middle_name,
              last_name,
              email,
              phone,
              billing_address_id,
              mailing_address_id,
              physical_address_id,
              notes,
              photo_url,
              is_active,
              created_at,
              updated_at
            )
          `)
          .eq("id", id)
          .single()

        if (fetchError) {
          console.error("[v0] Fetch error:", fetchError)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch updated prospect",
          })
        }

        const updatedPeopleData = updatedData.people as any
        const transformedUpdatedData = {
          id: updatedData.id,
          log_id: updatedData.log_id,
          balked_events: updatedData.balked_events || [],
          is_active: updatedData.is_active,
          created_at: updatedData.created_at,
          updated_at: updatedData.updated_at,
          first_name: updatedPeopleData.first_name,
          middle_name: updatedPeopleData.middle_name,
          last_name: updatedPeopleData.last_name,
          email: updatedPeopleData.email,
          phone: updatedPeopleData.phone,
          billing_address_id: updatedPeopleData.billing_address_id,
          mailing_address_id: updatedPeopleData.mailing_address_id,
          physical_address_id: updatedPeopleData.physical_address_id,
          notes: updatedPeopleData.notes,
          photo_url: updatedPeopleData.photo_url,
        }

        return res.json({
          success: true,
          data: transformedUpdatedData,
          message: "Prospect updated successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/prospects/${id} - Deleting prospect`)

        const { error: deleteError } = await supabase.from("prospects").delete().eq("id", id)

        if (deleteError) {
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete prospect",
          })
        }

        return res.json({
          success: true,
          message: "Prospect deleted successfully",
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
