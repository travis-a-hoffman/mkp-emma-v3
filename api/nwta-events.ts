import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

const EventTimeSchema = z.object({
  start: z.string().datetime({ message: "Start time must be a valid ISO datetime string" }),
  end: z.string().datetime({ message: "End time must be a valid ISO datetime string" }),
})

const CreateNwtaEventSchema = z.object({
  event_type_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  community_id: z.string().uuid().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  staff_cost: z.number().int().min(0).default(0),
  staff_capacity: z.number().int().min(0).default(0),
  potential_staff: z.array(z.string().uuid()).default([]),
  committed_staff: z.array(z.string().uuid()).default([]),
  alternate_staff: z.array(z.string().uuid()).default([]),
  participant_cost: z.number().int().min(0).default(0),
  participant_capacity: z.number().int().min(0).default(0),
  potential_participants: z.array(z.string().uuid()).default([]),
  committed_participants: z.array(z.string().uuid()).default([]),
  waitlist_participants: z.array(z.string().uuid()).default([]),
  primary_leader_id: z.string().uuid().nullable().optional(),
  leaders: z.array(z.string().uuid()).default([]),
  times: z.array(EventTimeSchema).default([]),
  participant_published_time: EventTimeSchema.nullable().optional(),
  staff_published_time: EventTimeSchema.nullable().optional(),
  is_published: z.boolean().default(false),
  is_active: z.boolean().default(true),
  rookies: z.array(z.string().uuid()).default([]),
  elders: z.array(z.string().uuid()).default([]),
  mos: z.array(z.string().uuid()).default([]),
})

const normalizeDateTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${dateTimeString}`)
  }
  return date.toISOString() // Ensures UTC format
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

  try {
    if (req.method === "GET") {
      const { active, search, published } = req.query

      if (published && published !== "true" && published !== "false") {
        return res.status(400).json({
          success: false,
          error: "Invalid published parameter. Only 'true' or 'false' are accepted.",
        })
      }

      let query = supabase
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
        .order("created_at", { ascending: false })

      // Filter by active status
      if (active === "true") {
        query = query.eq("is_active", true)
      } else if (active === "false") {
        query = query.eq("is_active", false)
      }

      if (published === "true") {
        query = query.eq("is_published", true)
      } else if (published === "false") {
        query = query.eq("is_published", false)
      }
      // When published parameter is not provided, return both published and unpublished events (no filter)

      // Search functionality
      if (search && typeof search === "string") {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch NWTA events",
          details: error,
        })
      }

      const transformedData =
        data?.map((event: any) => ({
          ...event,
          rookies: event.nwta_events?.[0]?.rookies || [],
          elders: event.nwta_events?.[0]?.elders || [],
          mos: event.nwta_events?.[0]?.mos || [],
          nwta_created_at: event.nwta_events?.[0]?.created_at,
          nwta_updated_at: event.nwta_events?.[0]?.updated_at,
          roles:
            event.nwta_roles?.map((role: any) => ({
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
        })) || []

      return res.status(200).json({
        success: true,
        data: transformedData,
        count: count || 0,
      })
    } else if (req.method === "POST") {
      const validation = CreateNwtaEventSchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        })
      }

      const eventData = validation.data

      if (eventData.times && eventData.times.length > 0) {
        eventData.times = eventData.times.map((time) => ({
          start: normalizeDateTime(time.start),
          end: normalizeDateTime(time.end),
        }))
      }

      if (eventData.participant_published_time) {
        eventData.participant_published_time = {
          start: normalizeDateTime(eventData.participant_published_time.start),
          end: normalizeDateTime(eventData.participant_published_time.end),
        }
      }

      if (eventData.staff_published_time) {
        eventData.staff_published_time = {
          start: normalizeDateTime(eventData.staff_published_time.start),
          end: normalizeDateTime(eventData.staff_published_time.end),
        }
      }

      const { rookies, elders, mos, participant_published_time, staff_published_time, ...baseEventData } = eventData

      // Create the base event first
      const { data: newEvent, error: eventError } = await supabase
        .from("events")
        .insert([baseEventData])
        .select("id")
        .single()

      if (eventError) {
        console.error("Database error creating event:", eventError)
        return res.status(500).json({
          success: false,
          error: "Failed to create event",
          details: eventError,
        })
      }

      const { error: nwtaError } = await supabase.from("nwta_events").insert([
        {
          id: newEvent.id,
          rookies,
          elders,
          mos,
          participant_published_time,
          staff_published_time,
        },
      ])

      if (nwtaError) {
        console.error("Database error creating NWTA event:", nwtaError)
        // Rollback the event creation
        await supabase.from("events").delete().eq("id", newEvent.id)
        return res.status(500).json({
          success: false,
          error: "Failed to create NWTA event",
          details: nwtaError,
        })
      }

      const { data: completeEvent, error: fetchError } = await supabase
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
            participant_published_time,
            staff_published_time,
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
        .eq("id", newEvent.id)
        .single()

      if (fetchError) {
        console.error("Database error fetching created event:", fetchError)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch created NWTA event",
          details: fetchError,
        })
      }

      const transformedEvent = {
        ...completeEvent,
        rookies: completeEvent.nwta_events?.[0]?.rookies || [],
        elders: completeEvent.nwta_events?.[0]?.elders || [],
        mos: completeEvent.nwta_events?.[0]?.mos || [],
        participant_published_time: completeEvent.nwta_events?.[0]?.participant_published_time,
        staff_published_time: completeEvent.nwta_events?.[0]?.staff_published_time,
        nwta_created_at: completeEvent.nwta_events?.[0]?.created_at,
        nwta_updated_at: completeEvent.nwta_events?.[0]?.updated_at,
        roles:
          completeEvent.nwta_roles?.map((role: any) => ({
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

      return res.status(201).json({
        success: true,
        data: transformedEvent,
        message: "NWTA event created successfully",
      })
    } else {
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      })
    }
  } catch (error) {
    console.error("API error:", error)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
