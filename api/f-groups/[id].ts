import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const FGroupUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  url: z.string().url().optional().nullable(),
  members: z.array(z.string().uuid()).optional(),
  is_accepting_new_members: z.boolean().optional(),
  membership_criteria: z.string().optional().nullable(),
  venue_id: z.string().uuid().optional().nullable(),
  genders: z.string().optional().nullable(),
  is_publicly_listed: z.boolean().optional(),
  public_contact_id: z.string().uuid().optional().nullable(),
  primary_contact_id: z.string().uuid().optional().nullable(),
  group_type: z.enum(["Men's", "Mixed Gender", "Open Men's", "Closed Men's"]).optional(),
  is_accepting_new_facilitators: z.boolean().optional(),
  facilitators: z.array(z.string().uuid()).optional(),
  is_accepting_initiated_visitors: z.boolean().optional(),
  is_accepting_uninitiated_visitors: z.boolean().optional(),
  is_requiring_contact_before_visiting: z.boolean().optional(),
  schedule_events: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
      }),
    )
    .optional(),
  schedule_description: z.string().optional().nullable(),
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
      error: "Facilitation group ID is required",
    })
  }

  try {
    switch (method) {
      case "GET":
        console.log(`[v0] GET /api/f-groups/${id} - Fetching facilitation group`)

        const { data, error } = await supabase
          .from("f_groups")
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
            area:areas!area_id(id, name, code, color, is_active),
            community:communities!community_id(id, name, code, color, is_active),
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
          .eq("id", id)
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(404).json({
            success: false,
            error: "Facilitation group not found",
          })
        }

        const groupsData = data.groups as any
        const transformedData = {
          id: data.id,
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
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
          deleted_at: groupsData.deleted_at,
          group_type: data.group_type,
          is_accepting_new_facilitators: data.is_accepting_new_facilitators,
          facilitators: data.facilitators,
          is_accepting_initiated_visitors: data.is_accepting_initiated_visitors,
          is_accepting_uninitiated_visitors: data.is_accepting_uninitiated_visitors,
          is_requiring_contact_before_visiting: data.is_requiring_contact_before_visiting,
          schedule_events: data.schedule_events,
          schedule_description: data.schedule_description,
          area_id: data.area_id,
          community_id: data.community_id,
          area: data.area,
          community: data.community,
          venue: data.venue,
          public_contact: data.public_contact,
          primary_contact: data.primary_contact,
        }

        return res.json({
          success: true,
          data: transformedData,
        })

      case "PUT":
        console.log(`[v0] PUT /api/f-groups/${id} - Updating facilitation group`)

        const validatedData = FGroupUpdateSchema.parse(req.body)

        // Separate group fields from f_group fields
        const groupFields = {
          name: validatedData.name,
          description: validatedData.description,
          url: validatedData.url,
          members: validatedData.members,
          is_accepting_new_members: validatedData.is_accepting_new_members,
          membership_criteria: validatedData.membership_criteria,
          venue_id: validatedData.venue_id,
          genders: validatedData.genders,
          is_publicly_listed: validatedData.is_publicly_listed,
          public_contact_id: validatedData.public_contact_id,
          primary_contact_id: validatedData.primary_contact_id,
          is_active: validatedData.is_active,
        }

        const hasGroupUpdates = Object.values(groupFields).some((value) => value !== undefined)

        if (hasGroupUpdates) {
          const groupUpdateData = Object.fromEntries(
            Object.entries(groupFields).filter(([_, value]) => value !== undefined),
          )

          const { error: groupUpdateError } = await supabase
            .from("groups")
            .update({
              ...groupUpdateData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)

          if (groupUpdateError) {
            console.error("[v0] Group update error:", groupUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update group data",
            })
          }
        }

        // Update f_groups fields
        const fGroupFields = {
          group_type: validatedData.group_type,
          is_accepting_new_facilitators: validatedData.is_accepting_new_facilitators,
          facilitators: validatedData.facilitators,
          is_accepting_initiated_visitors: validatedData.is_accepting_initiated_visitors,
          is_accepting_uninitiated_visitors: validatedData.is_accepting_uninitiated_visitors,
          is_requiring_contact_before_visiting: validatedData.is_requiring_contact_before_visiting,
          schedule_events: validatedData.schedule_events,
          schedule_description: validatedData.schedule_description,
          area_id: validatedData.area_id,
          community_id: validatedData.community_id,
          is_active: validatedData.is_active,
        }

        const hasFGroupUpdates = Object.values(fGroupFields).some((value) => value !== undefined)

        if (hasFGroupUpdates) {
          const fGroupUpdateData = Object.fromEntries(
            Object.entries(fGroupFields).filter(([_, value]) => value !== undefined),
          )

          const { error: fGroupUpdateError } = await supabase
            .from("f_groups")
            .update({
              ...fGroupUpdateData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)

          if (fGroupUpdateError) {
            console.error("[v0] F-group update error:", fGroupUpdateError)
            return res.status(500).json({
              success: false,
              error: "Failed to update facilitation group data",
            })
          }
        }

        // Fetch updated data
        const { data: updatedData, error: fetchError } = await supabase
          .from("f_groups")
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
          .eq("id", id)
          .single()

        if (fetchError) {
          console.error("[v0] Fetch error:", fetchError)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch updated facilitation group",
          })
        }

        const updatedGroupsData = updatedData.groups as any
        const transformedUpdatedData = {
          id: updatedData.id,
          name: updatedGroupsData.name,
          description: updatedGroupsData.description,
          url: updatedGroupsData.url,
          members: updatedGroupsData.members,
          is_accepting_new_members: updatedGroupsData.is_accepting_new_members,
          membership_criteria: updatedGroupsData.membership_criteria,
          venue_id: updatedGroupsData.venue_id,
          genders: updatedGroupsData.genders,
          is_publicly_listed: updatedGroupsData.is_publicly_listed,
          public_contact_id: updatedGroupsData.public_contact_id,
          primary_contact_id: updatedGroupsData.primary_contact_id,
          is_active: updatedData.is_active,
          created_at: updatedData.created_at,
          updated_at: updatedData.updated_at,
          deleted_at: updatedGroupsData.deleted_at,
          group_type: updatedData.group_type,
          is_accepting_new_facilitators: updatedData.is_accepting_new_facilitators,
          facilitators: updatedData.facilitators,
          is_accepting_initiated_visitors: updatedData.is_accepting_initiated_visitors,
          is_accepting_uninitiated_visitors: updatedData.is_accepting_uninitiated_visitors,
          is_requiring_contact_before_visiting: updatedData.is_requiring_contact_before_visiting,
          schedule_events: updatedData.schedule_events,
          schedule_description: updatedData.schedule_description,
          area_id: updatedData.area_id,
          community_id: updatedData.community_id,
          area: updatedData.area,
          community: updatedData.community,
          venue: updatedData.venue,
        }

        return res.json({
          success: true,
          data: transformedUpdatedData,
          message: "Facilitation group updated successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/f-groups/${id} - Deleting facilitation group`)

        // Delete f_groups record first (due to foreign key)
        const { error: deleteFGroupError } = await supabase.from("f_groups").delete().eq("id", id)

        if (deleteFGroupError) {
          console.error("[v0] F-group delete error:", deleteFGroupError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete facilitation group",
          })
        }

        // Delete groups record
        const { error: deleteGroupError } = await supabase.from("groups").delete().eq("id", id)

        if (deleteGroupError) {
          console.error("[v0] Group delete error:", deleteGroupError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete group data",
          })
        }

        return res.json({
          success: true,
          message: "Facilitation group deleted successfully",
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
