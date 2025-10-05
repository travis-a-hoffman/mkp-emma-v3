import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { Warrior } from "../src/types/person"
import type { Area } from "../src/types/area"
import type { Community } from "../src/types/community"
import type { EventWithRelations } from "../src/types/event"

interface WarriorWithRelations extends Warrior<EventWithRelations> {
  initiation_event?: EventWithRelations
  area: Area | null
  community: Community | null
  civicrm_id: string
  drupal_id: string
}

const WarriorSchema = z.object({
  id: z.string().uuid().optional(),
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
  log_id: z.string().uuid().optional().nullable(),
  initiation_id: z.string().uuid().optional().nullable(),
  initiation_on: z.string().optional().nullable(),
  initiation_text: z.string().optional().nullable(),
  status: z.string().default("Initiated"),
  training_events: z.array(z.string().uuid()).default([]),
  staffed_events: z.array(z.string().uuid()).default([]),
  lead_events: z.array(z.string().uuid()).default([]),
  mos_events: z.array(z.string().uuid()).default([]),
  area_id: z.string().uuid().optional().nullable(),
  community_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
})

export type WarriorApiResponse = {
  success: boolean
  data: WarriorWithRelations | WarriorWithRelations[]
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
        console.log("[v0] GET /api/warriors - Fetching all warriors")

        const { active, status, search } = query
        let dbQuery = supabase.from("people").select(`
            id,
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
            updated_at,
            warriors!inner (
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
              area:areas(id, name, code, color, is_active),
              community:communities(id, name, code, color, is_active)
            ),
            initiation_event:warriors!inner(events(
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
            ))
          `)

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("warriors.is_active", isActive)
        }

        if (status) {
          dbQuery = dbQuery.eq("warriors.status", status)
        }

        if (search && typeof search === "string") {
          const searchTerm = search.trim()
          if (searchTerm.length > 0) {
            dbQuery = dbQuery.or(`first_name.ilike.*${searchTerm}*,last_name.ilike.*${searchTerm}*`)
          }
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch warriors",
          })
        }

        const transformedData =
          data?.map((person: any) => {
            const warriorData = person.warriors as any
            const initiationEventData = person.initiation_event as any
            return {
              id: person.id,
              first_name: person.first_name,
              middle_name: person.middle_name,
              last_name: person.last_name,
              email: person.email,
              phone: person.phone,
              billing_address_id: person.billing_address_id,
              mailing_address_id: person.mailing_address_id,
              physical_address_id: person.physical_address_id,
              notes: person.notes,
              photo_url: person.photo_url,
              is_active: warriorData.is_active,
              created_at: warriorData.created_at,
              updated_at: warriorData.updated_at,
              log_id: warriorData.log_id,
              initiation_id: warriorData.initiation_id,
              initiation_on: warriorData.initiation_on,
              initiation_text: warriorData.initiation_text,
              status: warriorData.status,
              training_events: warriorData.training_events,
              staffed_events: warriorData.staffed_events,
              lead_events: warriorData.lead_events,
              mos_events: warriorData.mos_events,
              area_id: warriorData.area_id,
              community_id: warriorData.community_id,
              area: warriorData.area,
              community: warriorData.community,
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
          }) || []

        return res.json({
          success: true,
          data: transformedData,
          count: transformedData.length,
        })

      case "POST":
        console.log("[v0] POST /api/warriors - Creating new warrior")

        const validatedData = WarriorSchema.parse(req.body)

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
            error: "Failed to create person record",
          })
        }

        const { data: newData, error: createError } = await supabase
          .from("warriors")
          .insert({
            id: personData.id,
            log_id: validatedData.log_id || null,
            initiation_id: validatedData.initiation_id || null,
            initiation_on: validatedData.initiation_on || null,
            initiation_text: validatedData.initiation_text || null,
            status: validatedData.status,
            training_events: validatedData.training_events,
            staffed_events: validatedData.staffed_events,
            lead_events: validatedData.lead_events,
            mos_events: validatedData.mos_events,
            area_id: validatedData.area_id || null,
            community_id: validatedData.community_id || null,
            is_active: validatedData.is_active,
          })
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
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create warrior",
          })
        }

        const peopleData = newData.people as any
        const initiationEventData = newData.initiation_event as any
        const transformedNewData = {
          id: newData.id,
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
          is_active: newData.is_active,
          created_at: newData.created_at,
          updated_at: newData.updated_at,
          log_id: newData.log_id,
          initiation_id: newData.initiation_id,
          initiation_on: newData.initiation_on,
          initiation_text: newData.initiation_text,
          status: newData.status,
          training_events: newData.training_events,
          staffed_events: newData.staffed_events,
          lead_events: newData.lead_events,
          mos_events: newData.mos_events,
          area_id: newData.area_id,
          community_id: newData.community_id,
          area: newData.area,
          community: newData.community,
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

        return res.status(201).json({
          success: true,
          data: transformedNewData,
          message: "Warrior created successfully",
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
