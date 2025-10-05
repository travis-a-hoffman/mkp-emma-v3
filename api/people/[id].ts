import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

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
  middle_name: z.string().nullable().optional(),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  billing_address_id: z.string().uuid().nullable().optional().or(z.literal("")),
  mailing_address_id: z.string().uuid().nullable().optional().or(z.literal("")),
  physical_address_id: z.string().uuid().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional(),
  photo_url: z.string().url().nullable().optional().or(z.literal("")),
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
  const id = query.id as string

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Person ID is required",
    })
  }

  if (!z.string().uuid().safeParse(id).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid person ID format",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/people/[id] - Retrieve a specific person
        console.log(`[v0] GET /api/people/${id} - Fetching person`)

        const { data: singleData, error: singleError } = await supabase.from("people").select("*").eq("id", id).single()

        if (singleError) {
          if (singleError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Person not found, id: ${id}`,
            })
          }
          console.error("[v0] Database error:", singleError)
          return res.status(500).json({
            success: false,
            error: `Failed to fetch person, id: ${id}`,
          })
        }

        return res.json({
          success: true,
          data: singleData,
        })

      case "PUT":
        // PUT /api/people/[id] - Update an existing person
        console.log(`[v0] PUT /api/people/${id} - Updating person`)
        //console.error(JSON.stringify(req.body))

        const updateData = PersonSchema.parse(req.body)
        const { data: updatedData, error: updateError } = await supabase
          .from("people")
          .update({
            first_name: updateData.first_name,
            middle_name: updateData.middle_name || null,
            last_name: updateData.last_name,
            email: updateData.email || null,
            phone: updateData.phone || null,
            billing_address_id: updateData.billing_address_id || null,
            mailing_address_id: updateData.mailing_address_id || null,
            physical_address_id: updateData.physical_address_id || null,
            notes: updateData.notes || null,
            photo_url: updateData.photo_url || null,
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
              error: `Person not found, update data: ${JSON.stringify(updateData)}`,
            })
          }
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update person",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "Person updated successfully",
        })

      case "DELETE":
        // DELETE /api/people/[id] - Delete a person
        console.log(`[v0] DELETE /api/people/${id} - Deleting person`)

        const { data: deletedData, error: deleteError } = await supabase
          .from("people")
          .delete()
          .eq("id", id)
          .select()
          .single()

        if (deleteError) {
          if (deleteError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Person not found",
            })
          }
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete person",
          })
        }

        return res.json({
          success: true,
          data: deletedData,
          message: "Person deleted successfully",
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
      //console.error("[v0] Validation error:", error, ", details: ", error.errors.join(", "))
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
