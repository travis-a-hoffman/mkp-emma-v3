import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const RegistrantUpdateSchema = z.object({
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
  // Registrant fields
  log_id: z.string().uuid().optional().nullable(),
  payment_plan: z.string().uuid().optional().nullable(),
  transaction_log: z.string().uuid().optional().nullable(),
  event_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
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
      error: "Registrant ID is required",
    })
  }

  try {
    switch (method) {
      case "GET":
        console.log(`[v0] GET /api/registrants/${id} - Fetching registrant`)

        const { data, error } = await supabase
          .from("registrants")
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
              name,
              description,
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
            error: "Registrant not found",
          })
        }

        const peopleData = data.people as any
        const eventsData = data.events as any
        const transformedData = {
          id: data.id,
          log_id: data.log_id,
          payment_plan: data.payment_plan,
          transaction_log: data.transaction_log,
          event_id: data.event_id,
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
          event_name: eventsData.name,
          event_description: eventsData.description,
          event_is_active: eventsData.is_active,
          event_created_at: eventsData.created_at,
          event_updated_at: eventsData.updated_at,
        }

        return res.json({
          success: true,
          data: transformedData,
        })

      case "PUT":
        console.log(`[v0] PUT /api/registrants/${id} - Updating registrant`)

        const validatedData = RegistrantUpdateSchema.parse(req.body)

        if (validatedData.event_id) {
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
        }

        const personFields = {
          first_name: validatedData.first_name,
          middle_name: validatedData.middle_name,
          last_name: validatedData.last_name,
          email: validatedData.email,
          phone: validatedData.phone,
          billing_address_id: validatedData.billing_address_id,
          mailing_address_id: validatedData.mailing_address_id,
          physical_address_id: validatedData.physical_address_id,
          notes: validatedData.notes,
          photo_url: validatedData.photo_url,
        }

        const registrantFields = {
          log_id: validatedData.log_id,
          payment_plan: validatedData.payment_plan,
          transaction_log: validatedData.transaction_log,
          event_id: validatedData.event_id,
          is_active: validatedData.is_active,
        }

        const filteredPersonFields = Object.fromEntries(
          Object.entries(personFields).filter(([_, value]) => value !== undefined),
        )
        const filteredRegistrantFields = Object.fromEntries(
          Object.entries(registrantFields).filter(([_, value]) => value !== undefined),
        )

        if (Object.keys(filteredPersonFields).length > 0) {
          const { error: personUpdateError } = await supabase
            .from("people")
            .update({
              ...filteredPersonFields,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)

          if (personUpdateError) {
            console.error("[v0] Person update error:", personUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update person data",
            })
          }
        }

        if (Object.keys(filteredRegistrantFields).length > 0) {
          const { error: registrantUpdateError } = await supabase
            .from("registrants")
            .update({
              ...filteredRegistrantFields,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)

          if (registrantUpdateError) {
            console.error("[v0] Registrant update error:", registrantUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update registrant data",
            })
          }
        }

        const { data: updatedData, error: fetchError } = await supabase
          .from("registrants")
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
              name,
              description,
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
            error: "Failed to fetch updated registrant",
          })
        }

        const updatedPeopleData = updatedData.people as any
        const updatedEventsData = updatedData.events as any
        const transformedUpdatedData = {
          id: updatedData.id,
          log_id: updatedData.log_id,
          payment_plan: updatedData.payment_plan,
          transaction_log: updatedData.transaction_log,
          event_id: updatedData.event_id,
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
          event_name: updatedEventsData.name,
          event_description: updatedEventsData.description,
          event_is_active: updatedEventsData.is_active,
          event_created_at: updatedEventsData.created_at,
          event_updated_at: updatedEventsData.updated_at,
        }

        return res.json({
          success: true,
          data: transformedUpdatedData,
          message: "Registrant updated successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/registrants/${id} - Deleting registrant`)

        const { error: deleteError } = await supabase.from("people").delete().eq("id", id)

        if (deleteError) {
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete registrant",
          })
        }

        return res.json({
          success: true,
          message: "Registrant deleted successfully",
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
