import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { Registrant } from "../src/types/person"
import type { EventBasic } from "../src/types/event"

const RegistrantSchema = z.object({
  id: z.string().uuid().optional(), // Now optional for creation, required for updates
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
  // Registrant fields
  log_id: z.string().uuid().optional().nullable(),
  payment_plan: z.string().uuid().optional().nullable(),
  transaction_log: z.string().uuid().optional().nullable(),
  event_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
})

export type RegistrantApiResponse = {
  success: boolean
  data: Registrant<EventBasic> | Registrant<EventBasic>[]
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
        console.log("[v0] GET /api/registrants - Fetching all registrants")

        const { active, event_id } = query
        let dbQuery = supabase.from("registrants").select(`
            id,
            log_id,
            payment_plan,
            transaction_log,
            event_id,
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
            ),
            events!inner (
              id,
              name,
              description,
              is_active,
              created_at,
              updated_at
            )
          `)

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("is_active", isActive)
        }

        if (event_id) {
          dbQuery = dbQuery.eq("event_id", event_id)
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch registrants",
          })
        }

        const transformedData =
          data?.map((registrant: any) => {
            const peopleData = registrant.people as any
            const eventsData = registrant.events as any
            return {
              id: registrant.id,
              log_id: registrant.log_id,
              payment_plan: registrant.payment_plan,
              transaction_log: registrant.transaction_log,
              event_id: registrant.event_id,
              is_active: registrant.is_active,
              created_at: registrant.created_at,
              updated_at: registrant.updated_at,
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
              event: {
                id: registrant.event_id,
                name: eventsData.name,
                description: eventsData.description,
                is_active: eventsData.is_active,
                created_at: eventsData.created_at,
                updated_at: eventsData.updated_at,
              },
            }
          }) || []

        return res.json({
          success: true,
          data: transformedData,
          count: transformedData.length,
        })

      case "POST":
        console.log("[v0] POST /api/registrants - Creating new registrant")

        const validatedData = RegistrantSchema.parse(req.body)

        const { data: eventExists, error: eventError } = await supabase
          .from("events")
          .select("id")
          .eq("id", validatedData.event_id)
          .single()

        if (eventError || !eventExists) {
          return res.status(400).json({
            success: false,
            error: "Event not found",
          })
        }

        const { data: newPerson, error: personError } = await supabase
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
          .select()
          .single()

        if (personError || !newPerson) {
          console.error("[v0] Person creation error:", personError)
          return res.status(500).json({
            success: false,
            error: "Failed to create person",
          })
        }

        const { data: newData, error: createError } = await supabase
          .from("registrants")
          .insert({
            id: newPerson.id, // Use person's id as registrant's id
            log_id: validatedData.log_id || null,
            payment_plan: validatedData.payment_plan || null,
            transaction_log: validatedData.transaction_log || null,
            event_id: validatedData.event_id,
            is_active: validatedData.is_active,
          })
          .select(`
            id,
            log_id,
            payment_plan,
            transaction_log,
            event_id,
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
            ),
            events!inner (
              id,
              name,
              description,
              is_active,
              created_at,
              updated_at
            )
          `)
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          await supabase.from("people").delete().eq("id", newPerson.id)
          return res.status(500).json({
            success: false,
            error: "Failed to create registrant",
          })
        }

        const peopleData = newData.people as any
        const eventsData = newData.events as any
        const transformedNewData = {
          id: newData.id,
          log_id: newData.log_id,
          payment_plan: newData.payment_plan,
          transaction_log: newData.transaction_log,
          event_id: newData.event_id,
          is_active: newData.is_active,
          created_at: newData.created_at,
          updated_at: newData.updated_at,
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
          event: {
            id: newData.event_id,
            name: eventsData.name,
            description: eventsData.description,
            is_active: eventsData.is_active,
            created_at: eventsData.created_at,
            updated_at: eventsData.updated_at,
          },
        }

        return res.status(201).json({
          success: true,
          data: transformedNewData,
          message: "Registrant created successfully",
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
