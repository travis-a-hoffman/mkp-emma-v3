import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const EventTimeSchema = z.object({
  start: z.string().datetime({ message: "Start time must be a valid ISO datetime string" }),
  end: z.string().datetime({ message: "End time must be a valid ISO datetime string" }),
})

const UpdateNwtaEventSchema = z.object({
  event_type_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  community_id: z.string().uuid().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  staff_cost: z.number().int().min(0).optional(),
  staff_capacity: z.number().int().min(0).optional(),
  potential_staff: z.array(z.string().uuid()).optional(),
  committed_staff: z.array(z.string().uuid()).optional(),
  alternate_staff: z.array(z.string().uuid()).optional(),
  participant_cost: z.number().int().min(0).optional(),
  participant_capacity: z.number().int().min(0).optional(),
  potential_participants: z.array(z.string().uuid()).optional(),
  committed_participants: z.array(z.string().uuid()).optional(),
  waitlist_participants: z.array(z.string().uuid()).optional(),
  primary_leader_id: z.string().uuid().nullable().optional(),
  leaders: z.array(z.string().uuid()).optional(),
  participant_schedule: z.array(EventTimeSchema).optional(),
  staff_schedule: z.array(EventTimeSchema).optional(),
  times: z.array(EventTimeSchema).optional(),
  participant_published_time: EventTimeSchema.nullable().optional(),
  staff_published_time: EventTimeSchema.nullable().optional(),
  start_at: z.string().datetime({ message: "Start time must be a valid ISO datetime string" }).nullable().optional(),
  end_at: z.string().datetime({ message: "End time must be a valid ISO datetime string" }).nullable().optional(),
  is_published: z.boolean().optional(),
  is_active: z.boolean().optional(),
  rookies: z.array(z.string().uuid()).optional(),
  elders: z.array(z.string().uuid()).optional(),
  mos: z.array(z.string().uuid()).optional(),
})

const normalizeDateTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${dateTimeString}`)
  }
  return date.toISOString()
}

const calculateEventStartEnd = (participant_schedule: Array<{ start: string; end: string }>) => {
  if (!participant_schedule || participant_schedule.length === 0) {
    return { start: null, end: null }
  }

  const starts = participant_schedule.map((p) => new Date(p.start).getTime())
  const ends = participant_schedule.map((p) => new Date(p.end).getTime())

  return {
    start: new Date(Math.min(...starts)).toISOString(),
    end: new Date(Math.max(...ends)).toISOString(),
  }
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
      error: "NWTA event ID is required",
    })
  }

  if (!z.string().uuid().safeParse(id).success) {
    return res.status(400).json({
      success: false,
      error: "Invalid NWTA event ID format",
    })
  }

  try {
    switch (method) {
      case "GET":
        console.log(`[v0] GET /api/nwta-events/${id} - Fetching NWTA event`)

        const { data: singleData, error: singleError } = await supabase
          .from("events")
          .select(`
            *,
            event_type:event_types(id, name, code, color),
            area:areas(id, name, code, color),
            community:communities(id, name, code, color),
            venue:venues(
              id,
              name,
              phone,
              email,
              website,
              timezone,
              physical_address:addresses!physical_address_id(
                id,
                address_1,
                address_2,
                city,
                state,
                postal_code,
                country
              )
            ),
            primary_leader:people!primary_leader_id(id, first_name, last_name),
            nwta_events!inner(
              rookies,
              elders,
              mos,
              created_at,
              updated_at
            ),
            nwta_roles(
              id,
              name,
              summary,
              role_type_id,
              lead_warrior_id,
              warriors,
              is_active,
              nwta_role_types(
                id,
                name,
                summary,
                experience_level,
                work_points,
                preparation_points
              ),
              warriors!nwta_roles_lead_warrior_id_fkey(
                id,
                people!inner(
                  first_name,
                  last_name,
                  email
                )
              )
            )
          `)
          .eq("id", id)
          .single()

        if (singleError) {
          if (singleError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: `NWTA event not found, id: ${id}`,
            })
          }
          console.error("[v0] Database error:", singleError)
          return res.status(500).json({
            success: false,
            error: `Failed to fetch NWTA event, id: ${id}`,
          })
        }

        const transformedSingleData = {
          ...singleData,
          rookies: singleData.nwta_events?.[0]?.rookies || [],
          elders: singleData.nwta_events?.[0]?.elders || [],
          mos: singleData.nwta_events?.[0]?.mos || [],
          nwta_created_at: singleData.nwta_events?.[0]?.created_at,
          nwta_updated_at: singleData.nwta_events?.[0]?.updated_at,
          roles:
            singleData.nwta_roles?.map((role: any) => ({
              id: role.id,
              name: role.name,
              summary: role.summary,
              role_type_id: role.role_type_id,
              lead_warrior_id: role.lead_warrior_id,
              warriors: role.warriors || [],
              is_active: role.is_active,
              role_type: role.nwta_role_types
                ? {
                    id: role.nwta_role_types.id,
                    name: role.nwta_role_types.name,
                    summary: role.nwta_role_types.summary,
                    experience_level: role.nwta_role_types.experience_level,
                    work_points: role.nwta_role_types.work_points,
                    preparation_points: role.nwta_role_types.preparation_points,
                  }
                : null,
              lead_warrior: role.warriors
                ? {
                    id: role.warriors.id,
                    person: role.warriors.people
                      ? {
                          first_name: role.warriors.people.first_name,
                          last_name: role.warriors.people.last_name,
                          email: role.warriors.people.email,
                        }
                      : null,
                  }
                : null,
            })) || [],
        }

        return res.json({
          success: true,
          data: transformedSingleData,
        })

      case "PUT":
        console.log(`[v0] PUT /api/nwta-events/${id} - Updating NWTA event`)

        const updateData = UpdateNwtaEventSchema.parse(req.body)

        if (updateData.times && updateData.times.length > 0) {
          updateData.times = updateData.times.map((time) => ({
            start: normalizeDateTime(time.start),
            end: normalizeDateTime(time.end),
          }))
        }

        if (updateData.participant_schedule && updateData.participant_schedule.length > 0) {
          updateData.participant_schedule = updateData.participant_schedule.map((time) => ({
            start: normalizeDateTime(time.start),
            end: normalizeDateTime(time.end),
          }))
        }

        if (updateData.staff_schedule && updateData.staff_schedule.length > 0) {
          updateData.staff_schedule = updateData.staff_schedule.map((time) => ({
            start: normalizeDateTime(time.start),
            end: normalizeDateTime(time.end),
          }))
        }

        if (updateData.participant_published_time) {
          updateData.participant_published_time = {
            start: normalizeDateTime(updateData.participant_published_time.start),
            end: normalizeDateTime(updateData.participant_published_time.end),
          }
        }

        if (updateData.staff_published_time) {
          updateData.staff_published_time = {
            start: normalizeDateTime(updateData.staff_published_time.start),
            end: normalizeDateTime(updateData.staff_published_time.end),
          }
        }

        const {
          rookies,
          elders,
          mos,
          participant_published_time,
          staff_published_time,
          participant_schedule,
          staff_schedule,
          ...baseEventUpdateData
        } = updateData

        if (participant_schedule) {
          const { start, end } = calculateEventStartEnd(participant_schedule)
          if (start && end) {
            baseEventUpdateData.start_at = start
            baseEventUpdateData.end_at = end
          }
        }

        // Update the base event
        const { error: eventUpdateError } = await supabase
          .from("events")
          .update({
            ...baseEventUpdateData,
            updated_at: new Date().toISOString(),
            participant_published_time: participant_published_time,
            staff_published_time: staff_published_time,
            participant_schedule: participant_schedule,
            staff_schedule: staff_schedule,
          })
          .eq("id", id)

        if (eventUpdateError) {
          console.error("[v0] Database error updating event:", eventUpdateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update event",
          })
        }

        if (rookies !== undefined || elders !== undefined || mos !== undefined) {
          const nwtaUpdateData: any = {
            updated_at: new Date().toISOString(),
          }

          if (rookies !== undefined) nwtaUpdateData.rookies = rookies
          if (elders !== undefined) nwtaUpdateData.elders = elders
          if (mos !== undefined) nwtaUpdateData.mos = mos

          const { error: nwtaUpdateError } = await supabase.from("nwta_events").update(nwtaUpdateData).eq("id", id)

          if (nwtaUpdateError) {
            console.error("[v0] Database error updating NWTA event:", nwtaUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update NWTA event",
            })
          }
        }

        const { data: updatedEvent, error: fetchUpdatedError } = await supabase
          .from("events")
          .select(`
            *,
            event_type:event_types(id, name, code, color),
            area:areas(id, name, code, color),
            community:communities(id, name, code, color),
            venue:venues(
              id,
              name,
              phone,
              email,
              website,
              timezone,
              physical_address:addresses!physical_address_id(
                id,
                address_1,
                address_2,
                city,
                state,
                postal_code,
                country
              )
            ),
            primary_leader:people!primary_leader_id(id, first_name, last_name),
            nwta_events!inner(
              rookies,
              elders,
              mos,
              created_at,
              updated_at
            ),
            nwta_roles(
              id,
              name,
              summary,
              role_type_id,
              lead_warrior_id,
              warriors,
              is_active,
              nwta_role_types(
                id,
                name,
                summary,
                experience_level,
                work_points,
                preparation_points
              ),
              warriors!nwta_roles_lead_warrior_id_fkey(
                id,
                people!inner(
                  first_name,
                  last_name,
                  email
                )
              )
            )
          `)
          .eq("id", id)
          .single()

        if (fetchUpdatedError) {
          console.error("[v0] Database error fetching updated event:", fetchUpdatedError)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch updated NWTA event",
          })
        }

        const transformedUpdatedData = {
          ...updatedEvent,
          rookies: updatedEvent.nwta_events?.[0]?.rookies || [],
          elders: updatedEvent.nwta_events?.[0]?.elders || [],
          mos: updatedEvent.nwta_events?.[0]?.mos || [],
          nwta_created_at: updatedEvent.nwta_events?.[0]?.created_at,
          nwta_updated_at: updatedEvent.nwta_events?.[0]?.updated_at,
          roles:
            updatedEvent.nwta_roles?.map((role: any) => ({
              id: role.id,
              name: role.name,
              summary: role.summary,
              role_type_id: role.role_type_id,
              lead_warrior_id: role.lead_warrior_id,
              warriors: role.warriors || [],
              is_active: role.is_active,
              role_type: role.nwta_role_types
                ? {
                    id: role.nwta_role_types.id,
                    name: role.nwta_role_types.name,
                    summary: role.nwta_role_types.summary,
                    experience_level: role.nwta_role_types.experience_level,
                    work_points: role.nwta_role_types.work_points,
                    preparation_points: role.nwta_role_types.preparation_points,
                  }
                : null,
              lead_warrior: role.warriors
                ? {
                    id: role.warriors.id,
                    person: role.warriors.people
                      ? {
                          first_name: role.warriors.people.first_name,
                          last_name: role.warriors.people.last_name,
                          email: role.warriors.people.email,
                        }
                      : null,
                  }
                : null,
            })) || [],
        }

        return res.json({
          success: true,
          data: transformedUpdatedData,
          message: "NWTA event updated successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/nwta-events/${id} - Deleting NWTA event`)

        // Delete the base event (cascade will handle nwta_events)
        const { data: deletedData, error: deleteError } = await supabase
          .from("events")
          .delete()
          .eq("id", id)
          .select()
          .single()

        if (deleteError) {
          if (deleteError.code === "PGRST116") {
            return res.status(404).json({
              success: false,
              error: "NWTA event not found",
            })
          }
          console.error("[v0] Database error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete NWTA event",
          })
        }

        return res.json({
          success: true,
          data: deletedData,
          message: "NWTA event deleted successfully",
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
