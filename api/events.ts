import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { EventWithRelations } from "../src/types/event"
import type { Transaction } from "../src/types/transaction"

const EventTimeSchema = z.object({
  start_at: z.string().datetime({ message: "Start time must be a valid ISO datetime string" }),
  end_at: z.string().datetime({ message: "End time must be a valid ISO datetime string" }),
})

const CreateEventSchema = z.object({
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
  participant_schedule: z.array(EventTimeSchema).default([]),
  staff_schedule: z.array(EventTimeSchema).default([]),
  participant_published_time: EventTimeSchema.nullable().optional(),
  staff_published_time: EventTimeSchema.nullable().optional(),
  is_published: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

const normalizeDateTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${dateTimeString}`)
  }
  return date.toISOString() // Ensures UTC format
}

const calculateEventStartEnd = (participant_schedule: Array<{ start_at: string; end_at: string }>) => {
  if (!participant_schedule || participant_schedule.length === 0) {
    return { start_at: null, end_at: null }
  }

  const starts = participant_schedule.map((p) => new Date(p.start_at).getTime())
  const ends = participant_schedule.map((p) => new Date(p.end_at).getTime())

  return {
    start_at: new Date(Math.min(...starts)).toISOString(),
    end_at: new Date(Math.max(...ends)).toISOString(),
  }
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
      const { active, search, published, nwta } = req.query
      console.log("[v0] GET /api/events — req.query: ", JSON.stringify(req.query))

      let query = supabase
        .from("events")
        .select(`
          *,
          event_type:event_types!event_type_id(id, name, code, color),
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
          primary_leader:people!primary_leader_id(id, first_name, last_name)
        `)
        .order("created_at", { ascending: false })

      /* Get the list of event types (which can change) */
      let etQuery = supabase.from("event_types").select("*")

      if (!(nwta === "include")) {
        etQuery = etQuery.neq("code", "NWTA")
      }

      const { data: etData, error: etError, count: etCount } = await etQuery

      if (etError) {
        console.error("Database error:", etError)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch event type codes",
          details: etError,
        })
      }

      // Filter by active status
      if (active === "true") {
        query = query.eq("is_active", true)
      } else if (active === "false") {
        query = query.eq("is_active", false)
      }

      // Filter by published status
      if (published === "true") {
        query = query.eq("is_published", true)
      } else if (published === "false") {
        query = query.eq("is_published", false)
      }

      const etIds = etData.map((et: any) => et["id"])
      //console.log("[v0] etIds; ", JSON.stringify(etIds))

      // Event Type filtering
      query = query.in("event_type_id", etIds || [])

      // Search functionality
      if (search && typeof search === "string") {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch events",
          details: error,
        })
      }

      // Storage for quick access to the events we're working with
      const eventsById: Map<string, EventWithRelations> = new Map()
      const eventsByLogId: Map<string, EventWithRelations> = new Map()

      // Get all the events, retrieve all transactions from the transaction table in a single query (rather than N queries via the naïve solution)
      data.map((e: EventWithRelations) => eventsByLogId.set(e.transaction_log_id, e))
      // 'order' is the column name, ascending by default
      const txQuery = supabase
        .from("transaction_logs")
        .select("*")
        .in("log_id", Array.from(eventsByLogId.keys()))
        .order("order")
      const { data: txData, error: txError, count: txCount } = await txQuery

      // Assign all the log records to the appropriate event transaction log. They are
      // returned in ascending order by the database according to their "order" field.
      if (txData) {
        txData.map((t: Transaction) => eventsByLogId.get(t.log_id)?.transactions.push(t))
        eventsByLogId.forEach((value) => eventsById.set(value.id, value))
        data.map((e: EventWithRelations) => (e.transactions = eventsById.get(e.id)?.transactions || []))
      }

      //console.log("[v0] GET /api/events — data: ", data || [])

      return res.status(200).json({
        success: true,
        data: data || [],
        count: count || 0,
      })
    } else if (req.method === "POST") {
      const validation = CreateEventSchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        })
      }

      const eventData = validation.data

      if (eventData.participant_schedule && eventData.participant_schedule.length > 0) {
        eventData.participant_schedule = eventData.participant_schedule.map((time) => ({
          start_at: normalizeDateTime(time.start_at),
          end_at: normalizeDateTime(time.end_at),
        }))
      }

      if (eventData.staff_schedule && eventData.staff_schedule.length > 0) {
        eventData.staff_schedule = eventData.staff_schedule.map((time) => ({
          start_at: normalizeDateTime(time.start_at),
          end_at: normalizeDateTime(time.end_at),
        }))
      }

      if (eventData.participant_published_time) {
        eventData.participant_published_time = {
          start_at: normalizeDateTime(eventData.participant_published_time.start_at),
          end_at: normalizeDateTime(eventData.participant_published_time.end_at),
        }
      }

      if (eventData.staff_published_time) {
        eventData.staff_published_time = {
          start_at: normalizeDateTime(eventData.staff_published_time.start_at),
          end_at: normalizeDateTime(eventData.staff_published_time.end_at),
        }
      }

      const { start_at, end_at } = calculateEventStartEnd(eventData.participant_schedule)
      const finalEventData = {
        ...eventData,
        start_at,
        end_at,
      }

      const { data, error } = await supabase
        .from("events")
        .insert([finalEventData])
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
          primary_leader:people!primary_leader_id(id, first_name, last_name)
        `)
        .single()

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to create event",
          details: error,
        })
      }

      return res.status(201).json({
        success: true,
        data,
        message: "Event created successfully",
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
