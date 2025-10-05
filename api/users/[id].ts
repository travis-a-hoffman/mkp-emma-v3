import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const UserUpdateSchema = z.object({
  auth0_user: z.any().optional().nullable(),
  civicrm_user: z.any().optional().nullable(),
  drupal_user: z.any().optional().nullable(),
  other_auth0_users: z.array(z.any()).optional(),
  other_civicrm_users: z.array(z.any()).optional(),
  other_drupal_users: z.array(z.any()).optional(),
  approved_at: z.string().optional().nullable(),
  synchronized_at: z.string().optional().nullable(),
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
      error: "User ID is required",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/users/[id] - Retrieve a specific user
        console.log(`[v0] GET /api/users/${id} - Fetching user`)

        const { data, error } = await supabase.from("emma_users").select("*").eq("id", id).single()

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(404).json({
            success: false,
            error: "User not found",
          })
        }

        return res.json({
          success: true,
          data: data,
        })

      case "PUT":
        // PUT /api/users/[id] - Update a specific user
        console.log(`[v0] PUT /api/users/${id} - Updating user`)

        const validatedData = UserUpdateSchema.parse(req.body)

        const updateFields = Object.fromEntries(
          Object.entries(validatedData).filter(([_, value]) => value !== undefined),
        )

        const { data: updatedData, error: updateError } = await supabase
          .from("emma_users")
          .update({
            ...updateFields,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single()

        if (updateError) {
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update user",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "User updated successfully",
        })

      case "DELETE":
        // DELETE /api/users/[id] - Delete a specific user
        console.log(`[v0] DELETE /api/users/${id} - Deleting user`)

        const { error: deleteError } = await supabase.from("emma_users").delete().eq("id", id)

        if (deleteError) {
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete user",
          })
        }

        return res.json({
          success: true,
          message: "User deleted successfully",
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
