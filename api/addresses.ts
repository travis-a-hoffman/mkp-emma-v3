import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

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

  try {
    switch (method) {
      case "GET":
        // GET /api/addresses - Retrieve all addresses
        console.log("[v0] GET /api/addresses - Fetching all addresses")

        const { search } = query
        let dbQuery = supabase.from("addresses").select("*")

        if (search && typeof search === "string") {
          const searchTerm = `%${search}%`
          dbQuery = dbQuery.or(
            `address_1.ilike.${searchTerm},address_2.ilike.${searchTerm},city.ilike.${searchTerm},state.ilike.${searchTerm},postal_code.ilike.${searchTerm},country.ilike.${searchTerm}`,
          )
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch addresses",
          })
        }

        return res.json({
          success: true,
          data: data || [],
          count: data?.length || 0,
        })

      case "POST":
        // POST /api/addresses - Create a new address
        console.log("[v0] POST /api/addresses - Creating new address")

        const validatedData = AddressSchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          .from("addresses")
          .insert({
            address_1: validatedData.address_1,
            address_2: validatedData.address_2 || null,
            city: validatedData.city,
            state: validatedData.state,
            postal_code: validatedData.postal_code,
            country: validatedData.country,
          })
          .select()
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create address",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "Address created successfully",
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
