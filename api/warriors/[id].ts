import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const WarriorUpdateSchema = z.object({
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
  log_id: z.string().uuid().optional().nullable(),
  initiation_id: z.string().uuid().optional().nullable(),
  initiation_on: z.string().optional().nullable(),
  initiation_text: z.string().optional().nullable(),
  status: z.string().optional(),
  training_events: z.array(z.string().uuid()).optional(),
  staffed_events: z.array(z.string().uuid()).optional(),
  lead_events: z.array(z.string().uuid()).optional(),
  mos_events: z.array(z.string().uuid()).optional(),
  area_id: z.string().uuid().optional().nullable(),
  community_id: z.string().uuid().optional().nullable(),
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
      error: "Warrior ID is required",
    })
  }

  try {
    switch (method) {
      case "GET":
        console.log(`[v0] GET /api/warriors/${id} - Fetching warrior`)

        const { data, error } = await supabase
          .from("warriors")
          .select(`
            id,
            log_id,
            initiation_id,
            initiation_on,
            initiation_text,
            status,
            training_events,
            staffed_events,
            lead_events,
            mos_events,
            area_id,
            community_id,
            area:areas!area_id(id, name, code, color, is_active),
            community:communities!community_id(id, name, code, color, is_active),
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
            initiation_event:events (
              id,
              name,
              description,
              event_type_id,
              area_id,
              community_id,
              venue_id,
              start_at,
              end_at,
              transaction_log_id,
              staff_cost,
              staff_capacity,
              potential_staff,
              committed_staff,
              alternate_staff,
              participant_cost,
              participant_capacity,
              potential_participants,
              committed_participants,
              waitlist_participants,
              primary_leader_id,
              leaders,
              participant_schedule,
              staff_schedule,
              participant_published_time,
              staff_published_time,
              is_published,
              is_active,
              created_at,
              updated_at,
              event_type:event_types(id, name, code, color, is_active),
              area:areas(id, name, code, color, is_active),
              community:communities(id, name, code, color, is_active),
              venue:venues(
                id,
                name,
                phone,
                email,
                timezone,
                website,
                physical_address:addresses!venues_physical_address_id_fkey(
                  id,
                  address_1,
                  address_2,
                  city,
                  state,
                  postal_code,
                  country
                )
              ),
              primary_leader:people(id, first_name, last_name)
            )
          `)
          .eq("id", id)
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(404).json({
            success: false,
            error: "Warrior not found",
          })
        }

        const peopleData = data.people as any
        const initiationEventData = data.initiation_event as any
        const transformedData = {
          id: data.id,
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
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          log_id: data.log_id,
          initiation_id: data.initiation_id,
          initiation_on: data.initiation_on,
          initiation_text: data.initiation_text,
          status: data.status,
          training_events: data.training_events,
          staffed_events: data.staffed_events,
          lead_events: data.lead_events,
          mos_events: data.mos_events,
          area_id: data.area_id,
          community_id: data.community_id,
          initiation_event: initiationEventData
            ? {
                id: initiationEventData.id,
                name: initiationEventData.name,
                description: initiationEventData.description,
                event_type_id: initiationEventData.event_type_id,
                area_id: initiationEventData.area_id,
                community_id: initiationEventData.community_id,
                venue_id: initiationEventData.venue_id,
                start_at: initiationEventData.start_at,
                end_at: initiationEventData.end_at,
                transaction_log_id: initiationEventData.transaction_log_id,
                staff_cost: initiationEventData.staff_cost,
                staff_capacity: initiationEventData.staff_capacity,
                potential_staff: initiationEventData.potential_staff,
                committed_staff: initiationEventData.committed_staff,
                alternate_staff: initiationEventData.alternate_staff,
                participant_cost: initiationEventData.participant_cost,
                participant_capacity: initiationEventData.participant_capacity,
                potential_participants: initiationEventData.potential_participants,
                committed_participants: initiationEventData.committed_participants,
                waitlist_participants: initiationEventData.waitlist_participants,
                primary_leader_id: initiationEventData.primary_leader_id,
                leaders: initiationEventData.leaders,
                participant_schedule: initiationEventData.participant_schedule,
                staff_schedule: initiationEventData.staff_schedule,
                participant_published_time: initiationEventData.participant_published_time,
                staff_published_time: initiationEventData.staff_published_time,
                is_published: initiationEventData.is_published,
                is_active: initiationEventData.is_active,
                created_at: initiationEventData.created_at,
                updated_at: initiationEventData.updated_at,
                event_type: initiationEventData.event_type,
                area: initiationEventData.area,
                community: initiationEventData.community,
                venue: initiationEventData.venue
                  ? {
                      ...initiationEventData.venue,
                      physical_address: initiationEventData.venue.physical_address,
                    }
                  : undefined,
                primary_leader: initiationEventData.primary_leader,
                transactions: [],
              }
            : undefined,
        }

        return res.json({
          success: true,
          data: transformedData,
        })

      case "PUT":
        console.log(`[v0] PUT /api/warriors/${id} - Updating warrior`)

        const validatedData = WarriorUpdateSchema.parse(req.body)

        if (validatedData.initiation_id) {
          const { data: eventExists, error: eventError } = await supabase
            .from("events")
            .select("id")
            .eq("id", validatedData.initiation_id)
            .single()

          if (eventError || !eventExists) {
            return res.status(400).json({
              success: false,
              error: "Initiation event not found",
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
          is_active: validatedData.is_active,
        }

        const hasPersonUpdates = Object.values(personFields).some((value) => value !== undefined)

        if (hasPersonUpdates) {
          const personUpdateData = Object.fromEntries(
            Object.entries(personFields).filter(([_, value]) => value !== undefined),
          )

          const { error: personUpdateError } = await supabase
            .from("people")
            .update({
              ...personUpdateData,
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

        const warriorFields = {
          log_id: validatedData.log_id,
          initiation_id: validatedData.initiation_id,
          initiation_on: validatedData.initiation_on,
          initiation_text: validatedData.initiation_text,
          status: validatedData.status,
          training_events: validatedData.training_events,
          staffed_events: validatedData.staffed_events,
          lead_events: validatedData.lead_events,
          mos_events: validatedData.mos_events,
          area_id: validatedData.area_id,
          community_id: validatedData.community_id,
          is_active: validatedData.is_active,
        }

        const hasWarriorUpdates = Object.values(warriorFields).some((value) => value !== undefined)

        if (hasWarriorUpdates) {
          const warriorUpdateData = Object.fromEntries(
            Object.entries(warriorFields).filter(([_, value]) => value !== undefined),
          )

          const { error: warriorUpdateError } = await supabase
            .from("warriors")
            .update({
              ...warriorUpdateData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)

          if (warriorUpdateError) {
            console.error("[v0] Warrior update error:", warriorUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update warrior data",
            })
          }
        }

        const { data: updatedData, error: fetchError } = await supabase
          .from("warriors")
          .select(`
            id,
            log_id,
            initiation_id,
            initiation_on,
            initiation_text,
            status,
            training_events,
            staffed_events,
            lead_events,
            mos_events,
            area_id,
            community_id,
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
            initiation_event:events (
              id,
              name,
              description,
              event_type_id,
              area_id,
              community_id,
              venue_id,
              start_at,
              end_at,
              transaction_log_id,
              staff_cost,
              staff_capacity,
              potential_staff,
              committed_staff,
              alternate_staff,
              participant_cost,
              participant_capacity,
              potential_participants,
              committed_participants,
              waitlist_participants,
              primary_leader_id,
              leaders,
              participant_schedule,
              staff_schedule,
              participant_published_time,
              staff_published_time,
              is_published,
              is_active,
              created_at,
              updated_at,
              event_type:event_types(id, name, code, color),
              area:areas(id, name, code, color),
              community:communities(id, name, code, color),
              venue:venues(
                id,
                name,
                phone,
                email,
                timezone,
                website,
                physical_address:addresses!venues_physical_address_id_fkey(
                  id,
                  address_1,
                  address_2,
                  city,
                  state,
                  postal_code,
                  country
                )
              ),
              primary_leader:people(id, first_name, last_name)
            )
          `)
          .eq("id", id)
          .single()

        if (fetchError) {
          console.error("[v0] Fetch error:", fetchError)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch updated warrior",
          })
        }

        const updatedPeopleData = updatedData.people as any
        const updatedInitiationEventData = updatedData.initiation_event as any
        const transformedUpdatedData = {
          id: updatedData.id,
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
          is_active: updatedData.is_active,
          created_at: updatedData.created_at,
          updated_at: updatedData.updated_at,
          log_id: updatedData.log_id,
          initiation_id: updatedData.initiation_id,
          initiation_on: updatedData.initiation_on,
          initiation_text: updatedData.initiation_text,
          status: updatedData.status,
          training_events: updatedData.training_events,
          staffed_events: updatedData.staffed_events,
          lead_events: updatedData.lead_events,
          mos_events: updatedData.mos_events,
          area_id: updatedData.area_id,
          community_id: updatedData.community_id,
          initiation_event: updatedInitiationEventData
            ? {
                id: updatedInitiationEventData.id,
                name: updatedInitiationEventData.name,
                description: updatedInitiationEventData.description,
                event_type_id: updatedInitiationEventData.event_type_id,
                area_id: updatedInitiationEventData.area_id,
                community_id: updatedInitiationEventData.community_id,
                venue_id: updatedInitiationEventData.venue_id,
                start_at: updatedInitiationEventData.start_at,
                end_at: updatedInitiationEventData.end_at,
                transaction_log_id: updatedInitiationEventData.transaction_log_id,
                staff_cost: updatedInitiationEventData.staff_cost,
                staff_capacity: updatedInitiationEventData.staff_capacity,
                potential_staff: updatedInitiationEventData.potential_staff,
                committed_staff: updatedInitiationEventData.committed_staff,
                alternate_staff: updatedInitiationEventData.alternate_staff,
                participant_cost: updatedInitiationEventData.participant_cost,
                participant_capacity: updatedInitiationEventData.participant_capacity,
                potential_participants: updatedInitiationEventData.potential_participants,
                committed_participants: updatedInitiationEventData.committed_participants,
                waitlist_participants: updatedInitiationEventData.waitlist_participants,
                primary_leader_id: updatedInitiationEventData.primary_leader_id,
                leaders: updatedInitiationEventData.leaders,
                participant_schedule: updatedInitiationEventData.participant_schedule,
                staff_schedule: updatedInitiationEventData.staff_schedule,
                participant_published_time: updatedInitiationEventData.participant_published_time,
                staff_published_time: updatedInitiationEventData.staff_published_time,
                is_published: updatedInitiationEventData.is_published,
                is_active: updatedInitiationEventData.is_active,
                created_at: updatedInitiationEventData.created_at,
                updated_at: updatedInitiationEventData.updated_at,
                event_type: updatedInitiationEventData.event_type,
                area: updatedInitiationEventData.area,
                community: updatedInitiationEventData.community,
                venue: updatedInitiationEventData.venue
                  ? {
                      ...updatedInitiationEventData.venue,
                      physical_address: updatedInitiationEventData.venue.physical_address,
                    }
                  : undefined,
                primary_leader: updatedInitiationEventData.primary_leader,
                transactions: [],
              }
            : undefined,
        }

        return res.json({
          success: true,
          data: transformedUpdatedData,
          message: "Warrior updated successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/warriors/${id} - Deleting warrior`)

        const { error: deleteWarriorError } = await supabase.from("warriors").delete().eq("id", id)

        if (deleteWarriorError) {
          console.error("[v0] Warrior delete error:", deleteWarriorError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete warrior",
          })
        }

        const { error: deletePersonError } = await supabase.from("people").delete().eq("id", id)

        if (deletePersonError) {
          console.error("[v0] Person delete error:", deletePersonError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete person data",
          })
        }

        return res.json({
          success: true,
          message: "Warrior deleted successfully",
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
