import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"
import type { Transaction } from "../../src/types/transaction"

const EventTimeSchema = z.object({
  start: z.string().datetime({ message: "Start time must be a valid ISO datetime string" }),
  end: z.string().datetime({ message: "End time must be a valid ISO datetime string" }),
})

const UpdateEventSchema = z.object({
  event_type_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  community_id: z.string().uuid().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  transaction_log_id: z.string().uuid().optional(),
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
  participant_published_time: EventTimeSchema.nullable().optional(),
  staff_published_time: EventTimeSchema.nullable().optional(),
  times: z.array(EventTimeSchema).optional(),
  start_at: z.string().datetime({ message: "Start time must be a valid ISO datetime string" }).nullable().optional(),
  end_at: z.string().datetime({ message: "End time must be a valid ISO datetime string" }).nullable().optional(),
  is_published: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

const normalizeDateTime = (dateTimeString: string): string => {
  const date = new Date(dateTimeString)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${dateTimeString}`)
  }
  return date.toISOString() // Ensures UTC format
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

  const { id } = req.query

  if (!id || typeof id !== "string") {
    return res.status(400).json({
      success: false,
      error: "Event ID is required",
    })
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
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
          primary_leader:people!primary_leader_id(id, first_name, last_name)
        `)
        .eq("id", id)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Event not found",
          })
        }
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch event",
          details: error,
        })
      }

      let transactions: Transaction[] = []
      if (data.transaction_log_id) {
        const { data: txData, error: txError } = await supabase
          .from("transaction_logs")
          .select(`
            id,
            log_id,
            type,
            name,
            payor_name,
            payor_person_id,
            payee_name,
            payee_person_id,
            details,
            amount,
            method,
            ordering,
            data,
            happened_at,
            created_at,
            updated_at
          `)
          .eq("log_id", data.transaction_log_id)
          .order("ordering", { ascending: true })

        if (!txError && txData) {
          transactions = txData.map((tx: any) => ({
            id: tx.id,
            log_id: tx.log_id,
            type: tx.type,
            name: tx.name,
            payor_name: tx.payor_name,
            payor_person_id: tx.payor_person_id,
            payee_name: tx.payee_name,
            payee_person_id: tx.payee_person_id,
            details: tx.details,
            amount: tx.amount,
            method: tx.method,
            ordering: tx.ordering,
            data: tx.data,
            happened_at: tx.happened_at,
            created_at: tx.created_at,
            updated_at: tx.updated_at,
          }))
        }
      }

      const responseData = {
        ...data,
        transactions,
      }

      return res.status(200).json({
        success: true,
        data: responseData,
      })
    } else if (req.method === "PUT") {
      const validation = UpdateEventSchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        })
      }

      const updateData = validation.data

      if (updateData.participant_schedule && updateData.participant_schedule.length > 0) {
        const originalSchedule = updateData.participant_schedule.map((time: { start: string; end: string }) => ({
          start: normalizeDateTime(time.start),
          end: normalizeDateTime(time.end),
        }))

        updateData.participant_schedule = originalSchedule.map((time: { start: string; end: string }) => ({
          start: time.start,
          end: time.end,
        }))

        // Calculate start_at/end_at using the original format
        const { start, end } = calculateEventStartEnd(originalSchedule)
        if (start !== null && end !== null) {
          updateData.start_at = start
          updateData.end_at = end
        } else {
          updateData.start_at = null
          updateData.end_at = null
        }
      }

      if (updateData.staff_schedule && updateData.staff_schedule.length > 0) {
        updateData.staff_schedule = updateData.staff_schedule.map((time: { start: string; end: string }) => ({
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

      if (updateData.times && updateData.times.length > 0) {
        updateData.times = updateData.times.map((time: { start: string; end: string }) => ({
          start: normalizeDateTime(time.start),
          end: normalizeDateTime(time.end),
        }))
      }

      const { data, error } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", id)
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
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Event not found",
          })
        }
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to update event",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data,
        message: "Event updated successfully",
      })
    } else if (req.method === "DELETE") {
      // Soft delete by setting is_active to false
      const { data, error } = await supabase.from("events").update({ is_active: false }).eq("id", id).select().single()

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({
            success: false,
            error: "Event not found",
          })
        }
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to delete event",
          details: error,
        })
      }

      return res.status(200).json({
        success: true,
        data,
        message: "Event deleted successfully",
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
