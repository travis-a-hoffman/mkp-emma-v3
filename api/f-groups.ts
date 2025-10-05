import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { FGroup } from "../src/types/group"
import type { Area } from "../src/types/area"
import type { Community } from "../src/types/community"
import type { Venue } from "../src/types/venue"

interface FGroupWithRelations extends FGroup {
  area: Area | null
  community: Community | null
  venue: Venue | null
}

const FGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string(),
  url: z.string().url().optional().nullable(),
  members: z.array(z.string().uuid()).default([]),
  is_accepting_new_members: z.boolean().default(true),
  membership_criteria: z.string().optional().nullable(),
  venue_id: z.string().uuid().optional().nullable(),
  genders: z.string().optional().nullable(),
  is_publicly_listed: z.boolean().default(true),
  public_contact_id: z.string().uuid().optional().nullable(),
  primary_contact_id: z.string().uuid().optional().nullable(),
  group_type: z.enum(["Men's", "Mixed Gender", "Open Men's", "Closed Men's"]),
  is_accepting_new_facilitators: z.boolean().default(true),
  facilitators: z.array(z.string().uuid()).default([]),
  is_accepting_initiated_visitors: z.boolean().default(true),
  is_accepting_uninitiated_visitors: z.boolean().default(false),
  is_requiring_contact_before_visiting: z.boolean().default(true),
  schedule_events: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
      }),
    )
    .default([]),
  schedule_description: z.string().optional().nullable(),
  area_id: z.string().uuid().optional().nullable(),
  community_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
})

export type FGroupApiResponse = {
  success: boolean
  data: FGroupWithRelations | FGroupWithRelations[]
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
        console.log("[v0] GET /api/f-groups - Fetching all facilitation groups")

        const { active, group_type, search } = query
        let dbQuery = supabase.from("groups").select(`
            id,
            name,
            description,
            url,
            members,
            is_accepting_new_members,
            membership_criteria,
            venue_id,
            genders,
            is_publicly_listed,
            public_contact_id,
            primary_contact_id,
            is_active,
            created_at,
            updated_at,
            deleted_at,
            f_groups!inner (
              group_type,
              is_accepting_new_facilitators,
              facilitators,
              is_accepting_initiated_visitors,
              is_accepting_uninitiated_visitors,
              is_requiring_contact_before_visiting,
              schedule_events,
              schedule_description,
              area_id,
              community_id,
              is_active,
              created_at,
              updated_at,
              area:areas(id, name, code, color, is_active),
              community:communities(id, name, code, color, is_active)
            ),
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
            public_contact:people!groups_public_contact_id_fkey(id, first_name, last_name, email, phone),
            primary_contact:people!groups_primary_contact_id_fkey(id, first_name, last_name, email, phone)
          `)

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("f_groups.is_active", isActive)
        }

        if (group_type) {
          dbQuery = dbQuery.eq("f_groups.group_type", group_type)
        }

        if (search && typeof search === "string") {
          const searchTerm = search.trim()
          if (searchTerm.length > 0) {
            dbQuery = dbQuery.or(`name.ilike.*${searchTerm}*,description.ilike.*${searchTerm}*`)
          }
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch facilitation groups",
          })
        }

        const transformedData =
          data?.map((group: any) => {
            const fGroupData = group.f_groups as any
            return {
              id: group.id,
              name: group.name,
              description: group.description,
              url: group.url,
              members: group.members,
              is_accepting_new_members: group.is_accepting_new_members,
              membership_criteria: group.membership_criteria,
              venue_id: group.venue_id,
              genders: group.genders,
              is_publicly_listed: group.is_publicly_listed,
              public_contact_id: group.public_contact_id,
              primary_contact_id: group.primary_contact_id,
              is_active: fGroupData.is_active,
              created_at: fGroupData.created_at,
              updated_at: fGroupData.updated_at,
              deleted_at: group.deleted_at,
              group_type: fGroupData.group_type,
              is_accepting_new_facilitators: fGroupData.is_accepting_new_facilitators,
              facilitators: fGroupData.facilitators,
              is_accepting_initiated_visitors: fGroupData.is_accepting_initiated_visitors,
              is_accepting_uninitiated_visitors: fGroupData.is_accepting_uninitiated_visitors,
              is_requiring_contact_before_visiting: fGroupData.is_requiring_contact_before_visiting,
              schedule_events: fGroupData.schedule_events,
              schedule_description: fGroupData.schedule_description,
              area_id: fGroupData.area_id,
              community_id: fGroupData.community_id,
              area: fGroupData.area,
              community: fGroupData.community,
              venue: group.venue,
              public_contact: group.public_contact,
              primary_contact: group.primary_contact,
            }
          }) || []

        return res.json({
          success: true,
          data: transformedData,
          count: transformedData.length,
        })

      case "POST":
        console.log("[v0] POST /api/f-groups - Creating new facilitation group")

        const validatedData = FGroupSchema.parse(req.body)

        // Create the base group record
        const { data: groupData, error: groupError } = await supabase
          .from("groups")
          .insert({
            name: validatedData.name,
            description: validatedData.description,
            url: validatedData.url || null,
            members: validatedData.members,
            is_accepting_new_members: validatedData.is_accepting_new_members,
            membership_criteria: validatedData.membership_criteria || null,
            venue_id: validatedData.venue_id || null,
            genders: validatedData.genders || null,
            is_publicly_listed: validatedData.is_publicly_listed,
            public_contact_id: validatedData.public_contact_id || null,
            primary_contact_id: validatedData.primary_contact_id || null,
            is_active: validatedData.is_active,
          })
          .select("id")
          .single()

        if (groupError) {
          console.error("[v0] Group creation error:", groupError)
          return res.status(500).json({
            success: false,
            error: "Failed to create group record",
          })
        }

        // Create the f_groups record
        const { data: newData, error: createError } = await supabase
          .from("f_groups")
          .insert({
            id: groupData.id,
            group_type: validatedData.group_type,
            is_accepting_new_facilitators: validatedData.is_accepting_new_facilitators,
            facilitators: validatedData.facilitators,
            is_accepting_initiated_visitors: validatedData.is_accepting_initiated_visitors,
            is_accepting_uninitiated_visitors: validatedData.is_accepting_uninitiated_visitors,
            is_requiring_contact_before_visiting: validatedData.is_requiring_contact_before_visiting,
            schedule_events: validatedData.schedule_events,
            schedule_description: validatedData.schedule_description || null,
            area_id: validatedData.area_id || null,
            community_id: validatedData.community_id || null,
            is_active: validatedData.is_active,
          })
          .select(`
            id,
            group_type,
            is_accepting_new_facilitators,
            facilitators,
            is_accepting_initiated_visitors,
            is_accepting_uninitiated_visitors,
            is_requiring_contact_before_visiting,
            schedule_events,
            schedule_description,
            area_id,
            community_id,
            is_active,
            created_at,
            updated_at,
            groups!inner (
              name,
              description,
              url,
              members,
              is_accepting_new_members,
              membership_criteria,
              venue_id,
              genders,
              is_publicly_listed,
              public_contact_id,
              primary_contact_id,
              is_active,
              created_at,
              updated_at,
              deleted_at
            ),
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
            )
          `)
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create facilitation group",
          })
        }

        const groupsData = newData.groups as any
        const transformedNewData = {
          id: newData.id,
          name: groupsData.name,
          description: groupsData.description,
          url: groupsData.url,
          members: groupsData.members,
          is_accepting_new_members: groupsData.is_accepting_new_members,
          membership_criteria: groupsData.membership_criteria,
          venue_id: groupsData.venue_id,
          genders: groupsData.genders,
          is_publicly_listed: groupsData.is_publicly_listed,
          public_contact_id: groupsData.public_contact_id,
          primary_contact_id: groupsData.primary_contact_id,
          is_active: newData.is_active,
          created_at: newData.created_at,
          updated_at: newData.updated_at,
          deleted_at: groupsData.deleted_at,
          group_type: newData.group_type,
          is_accepting_new_facilitators: newData.is_accepting_new_facilitators,
          facilitators: newData.facilitators,
          is_accepting_initiated_visitors: newData.is_accepting_initiated_visitors,
          is_accepting_uninitiated_visitors: newData.is_accepting_uninitiated_visitors,
          is_requiring_contact_before_visiting: newData.is_requiring_contact_before_visiting,
          schedule_events: newData.schedule_events,
          schedule_description: newData.schedule_description,
          area_id: newData.area_id,
          community_id: newData.community_id,
          area: newData.area,
          community: newData.community,
          venue: newData.venue,
        }

        return res.status(201).json({
          success: true,
          data: transformedNewData,
          message: "Facilitation group created successfully",
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
