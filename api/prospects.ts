import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { Prospect } from "../src/types/person"

const ProspectSchema = z.object({
  id: z.string().uuid().optional(),
  log_id: z.string().uuid().optional().nullable(),
  balked_events: z.array(z.string().uuid()).default([]),
  is_active: z.boolean().default(true),
  // Person fields
  first_name: z.string().min(1),
  middle_name: z.string().optional().nullable(),
  last_name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  billing_address_id: z.string().uuid().optional().nullable(),
  mailing_address_id: z.string().uuid().optional().nullable(),
  physical_address_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
})

export type ProspectApiResponse = {
  success: boolean
  data: Prospect | Prospect[]
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
        console.log("[v0] GET /api/prospects - Fetching all prospects")

        const { active } = query
        let dbQuery = supabase.from("prospects").select(`
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

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("is_active", isActive)
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch prospects",
          })
        }

        const transformedData =
          data?.map((prospect: any) => {
            const peopleData = prospect.people as any
            return {
              id: prospect.id,
              log_id: prospect.log_id,
              balked_events: prospect.balked_events || [],
              is_active: prospect.is_active,
              created_at: prospect.created_at,
              updated_at: prospect.updated_at,
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
          }) || []

        return res.json({
          success: true,
          data: transformedData,
          count: transformedData.length,
        })

      case "POST":
        console.log("[v0] POST /api/prospects - Creating new prospect")

        const validatedData = ProspectSchema.parse(req.body)

        const { data: personData, error: personError } = await supabase
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
          .select("id")
          .single()

        if (personError) {
          console.error("[v0] Person creation error:", personError)
          return res.status(500).json({
            success: false,
            error: "Failed to create person",
          })
        }

        const { data: prospectData, error: prospectError } = await supabase
          .from("prospects")
          .insert({
            id: personData.id,
            log_id: validatedData.log_id || null,
            balked_events: validatedData.balked_events,
            is_active: validatedData.is_active,
          })
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
          .single()

        if (prospectError) {
          console.error("[v0] Prospect creation error:", prospectError)
          await supabase.from("people").delete().eq("id", personData.id)
          return res.status(500).json({
            success: false,
            error: "Failed to create prospect",
          })
        }

        const peopleData = prospectData.people as any
        const transformedNewData = {
          id: prospectData.id,
          log_id: prospectData.log_id,
          balked_events: prospectData.balked_events || [],
          is_active: prospectData.is_active,
          created_at: prospectData.created_at,
          updated_at: prospectData.updated_at,
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

        return res.status(201).json({
          success: true,
          data: transformedNewData,
          message: "Prospect created successfully",
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
