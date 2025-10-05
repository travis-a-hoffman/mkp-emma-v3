import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../../_lib/supabase.js"

const AdminSchema = z.object({
  person_id: z.string().uuid("Invalid person ID"),
})

const AdminsArraySchema = z.object({
  admin_ids: z.array(z.string().uuid("Invalid person ID")),
})

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
  const areaId = query.id as string

  if (!areaId) {
    return res.status(400).json({
      success: false,
      error: "Area ID is required",
    })
  }

  if (!z.string().uuid().safeParse(areaId).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid area ID format",
    })
  }

  try {
    switch (method) {
      case "POST":
        // POST /api/areas/[id]/admins - Add an admin to an area
        console.log(`[v0] POST /api/areas/${areaId}/admins - Adding admin`)

        const { person_id } = AdminSchema.parse(req.body)

        const { data: newAdmin, error: addError } = await supabase
          .from("area_admins")
          .insert({
            area_id: areaId,
            person_id: person_id,
          })
          .select(`
            *,
            people(
              id,
              first_name,
              middle_name,
              last_name,
              email,
              photo_url
            )
          `)
          .single()

        if (addError) {
          if (addError.code === "23505") {
            return res.status(400).json({
              success: false,
              error: "Person is already an admin for this area",
            })
          }
          if (addError.code === "23503") {
            return res.status(400).json({
              success: false,
              error: "Invalid area or person ID",
            })
          }
          console.error("[v0] Database error:", addError)
          return res.status(500).json({
            success: false,
            error: "Failed to add admin",
          })
        }

        return res.status(201).json({
          success: true,
          data: newAdmin.people,
          message: "Admin added successfully",
        })

      case "PUT":
        // PUT /api/areas/[id]/admins - Replace all admins for an area
        console.log(`[v0] PUT /api/areas/${areaId}/admins - Replacing all admins`)

        const { admin_ids } = AdminsArraySchema.parse(req.body)

        // Start a transaction by deleting existing admins and adding new ones
        const { error: deleteError } = await supabase.from("area_admins").delete().eq("area_id", areaId)

        if (deleteError) {
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to update admins",
          })
        }

        if (admin_ids.length > 0) {
          const adminInserts = admin_ids.map((person_id) => ({
            area_id: areaId,
            person_id: person_id,
          }))

          const { error: insertError } = await supabase.from("area_admins").insert(adminInserts)

          if (insertError) {
            console.error("[v0] Database error:", insertError)
            return res.status(500).json({
              success: false,
              error: "Failed to update admins",
            })
          }
        }

        // Fetch the updated list of admins
        const { data: updatedAdmins, error: fetchError } = await supabase
          .from("area_admins")
          .select(`
            people(
              id,
              first_name,
              middle_name,
              last_name,
              email,
              photo_url
            )
          `)
          .eq("area_id", areaId)

        if (fetchError) {
          console.error("[v0] Database error:", fetchError)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch updated admins",
          })
        }

        return res.json({
          success: true,
          data: updatedAdmins?.map((admin: any) => admin.people) || [],
          message: "Admins updated successfully",
        })

      case "DELETE":
        // DELETE /api/areas/[id]/admins?person_id=xxx - Remove a specific admin
        console.log(`[v0] DELETE /api/areas/${areaId}/admins - Removing admin`)

        const personId = query.person_id as string
        if (!personId) {
          return res.status(400).json({
            success: false,
            error: "Person ID is required",
          })
        }

        const { error: removeError } = await supabase
          .from("area_admins")
          .delete()
          .eq("area_id", areaId)
          .eq("person_id", personId)

        if (removeError) {
          console.error("[v0] Database error:", removeError)
          return res.status(500).json({
            success: false,
            error: "Failed to remove admin",
          })
        }

        return res.json({
          success: true,
          message: "Admin removed successfully",
        })

      default:
        res.setHeader("Allow", ["POST", "PUT", "DELETE"])
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
