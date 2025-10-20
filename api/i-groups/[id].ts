import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "../_lib/supabase.js"

const IGroupUpdateSchema = z.object({
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
  established_on: z.string().optional().nullable(),
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
      error: "Invalid or missing ID parameter",
    })
  }

  try {
    switch (method) {
      case "GET":
        console.log(`[v0] GET /api/i-groups/${id} - Fetching integration group`)

        const { data, error } = await supabase
          .from("groups")
          .select(`
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
            established_on,
            i_groups!inner (
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
          .eq("id", id)
          .single()

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(404).json({
            success: false,
            error: "Integration group not found",
          })
        }

        // Expand members array to include full Person details
        const memberIds = (data.members as string[]) || []
        let memberDetails: any[] = []

        if (memberIds.length > 0) {
          const { data: membersData, error: membersError } = await supabase
            .from("people")
            .select(`
              id,
              first_name,
              middle_name,
              last_name,
              email,
              phone,
              photo_url,
              is_active,
              warriors (
                status,
                area_id,
                community_id
              )
            `)
            .in("id", memberIds)

          if (!membersError && membersData) {
            memberDetails = membersData
          } else if (membersError) {
            console.error("[v0] Error fetching members:", membersError)
          }
        }

        const iGroupData = data.i_groups as any
        const transformedData = {
          id: data.id,
          name: data.name,
          description: data.description,
          url: data.url,
          members: memberDetails,
          member_ids: memberIds,
          is_accepting_new_members: data.is_accepting_new_members,
          membership_criteria: data.membership_criteria,
          venue_id: data.venue_id,
          genders: data.genders,
          is_publicly_listed: data.is_publicly_listed,
          public_contact_id: data.public_contact_id,
          primary_contact_id: data.primary_contact_id,
          is_active: iGroupData.is_active,
          created_at: iGroupData.created_at,
          updated_at: iGroupData.updated_at,
          deleted_at: data.deleted_at,
          is_accepting_initiated_visitors: iGroupData.is_accepting_initiated_visitors,
          is_accepting_uninitiated_visitors: iGroupData.is_accepting_uninitiated_visitors,
          is_requiring_contact_before_visiting: iGroupData.is_requiring_contact_before_visiting,
          schedule_events: iGroupData.schedule_events,
          schedule_description: iGroupData.schedule_description,
          area_id: iGroupData.area_id,
          community_id: iGroupData.community_id,
          area: iGroupData.area,
          community: iGroupData.community,
          venue: data.venue,
          public_contact: data.public_contact,
          primary_contact: data.primary_contact,
        }

        return res.json({
          success: true,
          data: transformedData,
        })

      case "PUT":
        console.log(`[v0] PUT /api/i-groups/${id} - Updating integration group`)

        const validatedData = IGroupUpdateSchema.parse(req.body)

        // Separate group fields from i_group fields
        const groupFields: any = {}
        const iGroupFields: any = {}

        if (validatedData.name !== undefined) groupFields.name = validatedData.name
        if (validatedData.description !== undefined) groupFields.description = validatedData.description
        if (validatedData.url !== undefined) groupFields.url = validatedData.url
        if (validatedData.members !== undefined) groupFields.members = validatedData.members
        if (validatedData.is_accepting_new_members !== undefined)
          groupFields.is_accepting_new_members = validatedData.is_accepting_new_members
        if (validatedData.membership_criteria !== undefined)
          groupFields.membership_criteria = validatedData.membership_criteria
        if (validatedData.venue_id !== undefined) groupFields.venue_id = validatedData.venue_id
        if (validatedData.genders !== undefined) groupFields.genders = validatedData.genders
        if (validatedData.is_publicly_listed !== undefined)
          groupFields.is_publicly_listed = validatedData.is_publicly_listed
        if (validatedData.public_contact_id !== undefined)
          groupFields.public_contact_id = validatedData.public_contact_id
        if (validatedData.primary_contact_id !== undefined)
          groupFields.primary_contact_id = validatedData.primary_contact_id

        if (validatedData.is_accepting_initiated_visitors !== undefined)
          iGroupFields.is_accepting_initiated_visitors = validatedData.is_accepting_initiated_visitors
        if (validatedData.is_accepting_uninitiated_visitors !== undefined)
          iGroupFields.is_accepting_uninitiated_visitors = validatedData.is_accepting_uninitiated_visitors
        if (validatedData.is_requiring_contact_before_visiting !== undefined)
          iGroupFields.is_requiring_contact_before_visiting = validatedData.is_requiring_contact_before_visiting
        if (validatedData.schedule_events !== undefined) iGroupFields.schedule_events = validatedData.schedule_events
        if (validatedData.schedule_description !== undefined)
          iGroupFields.schedule_description = validatedData.schedule_description
        if (validatedData.area_id !== undefined) iGroupFields.area_id = validatedData.area_id
        if (validatedData.community_id !== undefined) iGroupFields.community_id = validatedData.community_id
        if (validatedData.is_active !== undefined) iGroupFields.is_active = validatedData.is_active

        // Update groups table if there are group fields
        if (Object.keys(groupFields).length > 0) {
          const { error: groupError } = await supabase.from("groups").update(groupFields).eq("id", id)

          if (groupError) {
            console.error("[v0] Group update error:", groupError)
            return res.status(500).json({
              success: false,
              error: "Failed to update group record",
            })
          }
        }

        // Update i_groups table if there are i_group fields
        if (Object.keys(iGroupFields).length > 0) {
          const { error: iGroupError } = await supabase.from("i_groups").update(iGroupFields).eq("id", id)

          if (iGroupError) {
            console.error("[v0] IGroup update error:", iGroupError)
            return res.status(500).json({
              success: false,
              error: "Failed to update integration group record",
            })
          }
        }

        // Fetch the updated record
        const { data: updatedData, error: fetchError } = await supabase
          .from("groups")
          .select(`
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
            established_on,
            i_groups!inner (
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
          .eq("id", id)
          .single()

        if (fetchError) {
          console.error("[v0] Fetch error:", fetchError)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch updated integration group",
          })
        }

        // Expand members array for updated data
        const updatedMemberIds = (updatedData.members as string[]) || []
        let updatedMemberDetails: any[] = []

        if (updatedMemberIds.length > 0) {
          const { data: updatedMembersData, error: updatedMembersError } = await supabase
            .from("people")
            .select(`
              id,
              first_name,
              middle_name,
              last_name,
              email,
              phone,
              photo_url,
              is_active,
              warriors (
                status,
                area_id,
                community_id
              )
            `)
            .in("id", updatedMemberIds)

          if (!updatedMembersError && updatedMembersData) {
            updatedMemberDetails = updatedMembersData
          }
        }

        const updatedIGroupData = updatedData.i_groups as any
        const transformedUpdatedData = {
          id: updatedData.id,
          name: updatedData.name,
          description: updatedData.description,
          url: updatedData.url,
          members: updatedMemberDetails,
          member_ids: updatedMemberIds,
          is_accepting_new_members: updatedData.is_accepting_new_members,
          membership_criteria: updatedData.membership_criteria,
          venue_id: updatedData.venue_id,
          genders: updatedData.genders,
          is_publicly_listed: updatedData.is_publicly_listed,
          public_contact_id: updatedData.public_contact_id,
          primary_contact_id: updatedData.primary_contact_id,
          is_active: updatedIGroupData.is_active,
          created_at: updatedIGroupData.created_at,
          updated_at: updatedIGroupData.updated_at,
          deleted_at: updatedData.deleted_at,
          is_accepting_initiated_visitors: updatedIGroupData.is_accepting_initiated_visitors,
          is_accepting_uninitiated_visitors: updatedIGroupData.is_accepting_uninitiated_visitors,
          is_requiring_contact_before_visiting: updatedIGroupData.is_requiring_contact_before_visiting,
          schedule_events: updatedIGroupData.schedule_events,
          schedule_description: updatedIGroupData.schedule_description,
          area_id: updatedIGroupData.area_id,
          community_id: updatedIGroupData.community_id,
          area: updatedIGroupData.area,
          community: updatedIGroupData.community,
          venue: updatedData.venue,
          public_contact: updatedData.public_contact,
          primary_contact: updatedData.primary_contact,
        }

        return res.json({
          success: true,
          data: transformedUpdatedData,
          message: "Initiation group updated successfully",
        })

      case "DELETE":
        console.log(`[v0] DELETE /api/i-groups/${id} - Soft deleting initiation group`)

        const { error: deleteError } = await supabase
          .from("groups")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id)

        if (deleteError) {
          console.error("[v0] Delete error:", deleteError)
          return res.status(500).json({
            success: false,
            error: "Failed to delete initiation group",
          })
        }

        return res.json({
          success: true,
          message: "Initiation group deleted successfully",
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
