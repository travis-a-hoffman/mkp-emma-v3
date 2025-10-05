import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

interface Address {
  id: string
  address_1: string
  address_2?: string | null
  city: string
  state: string
  postal_code: string
  country: string
  created_at: string
  updated_at: string
}

const AddressSchema = z.object({
  id: z.string().uuid().optional(),
  address_1: z.string().min(1, "Address line 1 is required"),
  address_2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State/Province is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
})

export type AddressApiResponse = {
  success: boolean
  data: Address | Address[]
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
      error: "Address ID is required",
    })
  }

  if (!z.string().uuid().safeParse(id).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid address ID format",
    })
  }

  try {
    switch (method) {
      case "GET":
        // GET /api/addresses/[id] - Retrieve a specific address
        console.log(`[v0] GET /api/addresses/${id} - Fetching address`)

        const { data: singleData, error: singleError } = await supabase
          .from("addresses")
          .select("*")
          .eq("id", id)
          .single()

        if (singleError) {
          if (singleError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Address not found, id: ${id}`,
            })
          }
          console.error("[v0] Database error:", singleError)
          return res.status(500).json({
            success: false,
            error: `Failed to fetch address, id: ${id}`,
          })
        }

        return res.json({
          success: true,
          data: singleData,
        })

      case "PUT":
        // PUT /api/addresses/[id] - Update an existing address
        console.log(`[v0] PUT /api/addresses/${id} - Updating address`)

        const updateData = AddressSchema.parse(req.body)

        const { data: updatedData, error: updateError } = await supabase
          .from("addresses")
          .update({
            address_1: updateData.address_1,
            address_2: updateData.address_2 || null,
            city: updateData.city,
            state: updateData.state,
            postal_code: updateData.postal_code,
            country: updateData.country,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single()

        if (updateError) {
          if (updateError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `Address not found, update data: ${JSON.stringify(updateData)}`,
            })
          }
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update address",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "Address updated successfully",
        })

      case "DELETE":
        // DELETE /api/addresses/[id] - Delete an address
        console.log(`[v0] DELETE /api/addresses/${id} - Deleting address`)

        const { data: deletedData, error: deleteError } = await supabase
          .from("addresses")
          .delete()
          .eq("id", id)
          .select()
          .single()

        if (deleteError) {
          if (deleteError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "Address not found",
            })
          }
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete address",
          })
        }

        return res.json({
          success: true,
          data: deletedData,
          message: "Address deleted successfully",
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
