import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { IGroup } from "../src/types/group"
import type { Area } from "../src/types/area"
import type { Community } from "../src/types/community"
import type { Venue } from "../src/types/venue"

interface IGroupWithRelations extends IGroup {
  area: Area | null
  community: Community | null
  venue: Venue | null
  distance?: number
  distance_units?: string
}

/**
 * Parse radius parameter which may have "mi" suffix (e.g., "25mi", "25.00mi")
 * Returns radius in miles as a number, or null if invalid
 */
function parseRadius(radiusParam: string | string[] | undefined): number | null {
  if (!radiusParam) return null
  const radiusStr = Array.isArray(radiusParam) ? radiusParam[0] : radiusParam
  // Remove "mi" suffix if present
  const cleanRadius = radiusStr.replace(/mi$/i, "").trim()
  const radius = parseFloat(cleanRadius)
  return isNaN(radius) ? null : radius
}

const IGroupSchema = z.object({
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
  established_on: z.string().optional().nullable(),
})

export type IGroupApiResponse = {
  success: boolean
  data: IGroupWithRelations | IGroupWithRelations[]
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
        console.log("[v0] GET /api/i-groups - Fetching all integration groups")

        const {
          active,
          search,
          name,
          city,
          state,
          zipcode,
          initiated,
          uninitiated,
          days,
          dates,
          time,
          lat,
          latitude,
          lon,
          longitude,
          rad,
          radius,
          by,
          order
        } = query

        // Parse geolocation parameters
        const latParam = lat || latitude
        const lonParam = lon || longitude
        const radParam = rad || radius
        const hasGeolocation = latParam && lonParam

        // Parse sorting parameters
        const sortBy = Array.isArray(by) ? by[0] : (by || (hasGeolocation ? "distance" : "created_at"))
        const sortOrder = Array.isArray(order) ? order[0] : (order || (sortBy === "distance" ? "ascending" : "descending"))

        // Handle geolocation-based filtering
        let distanceMap = new Map<string, number>()
        let filteredIds: string[] | null = null

        if (hasGeolocation) {
          const parsedLat = parseFloat(Array.isArray(latParam) ? latParam[0] : (latParam as string))
          const parsedLon = parseFloat(Array.isArray(lonParam) ? lonParam[0] : (lonParam as string))
          const radiusMiles = parseRadius(radParam) || 50
          const radiusMeters = radiusMiles * 1609.34

          if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
            console.log(`[v0] Geolocation filter: lat=${parsedLat}, lon=${parsedLon}, radius=${radiusMiles}mi`)

            const { data: nearbyGroups, error: nearbyError } = await supabase.rpc("find_igroups_within_radius", {
              point_lon: parsedLon,
              point_lat: parsedLat,
              radius_meters: radiusMeters,
            })

            if (!nearbyError && nearbyGroups && nearbyGroups.length > 0) {
              filteredIds = nearbyGroups.map((g: any) => g.id)
              nearbyGroups.forEach((g: any) => {
                distanceMap.set(g.id, g.distance_meters)
              })
              console.log(`[v0] Found ${filteredIds!.length} i-groups within ${radiusMiles} miles`)
            } else if (!nearbyError) {
              // No groups found within radius, return empty result
              console.log(`[v0] No i-groups found within ${radiusMiles} miles`)
              return res.json({
                success: true,
                data: [],
                count: 0,
              })
            } else {
              console.error("[v0] RPC error:", nearbyError)
            }
          }
        }

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
            latitude,
            longitude,
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

        // Filter by geolocation IDs if provided
        if (filteredIds) {
          dbQuery = dbQuery.in("id", filteredIds)
        }

        if (active !== undefined) {
          const isActive = active === "true"
          dbQuery = dbQuery.eq("i_groups.is_active", isActive)
        }

        // Name search (specific to group name only)
        if (name && typeof name === "string") {
          const nameTerm = Array.isArray(name) ? name[0] : name.trim()
          if (nameTerm.length > 0) {
            dbQuery = dbQuery.ilike("name", `%${nameTerm}%`)
          }
        }

        // Legacy search parameter (searches both name and description)
        if (search && typeof search === "string" && !name) {
          const searchTerm = search.trim()
          if (searchTerm.length > 0) {
            dbQuery = dbQuery.or(`name.ilike.*${searchTerm}*,description.ilike.*${searchTerm}*`)
          }
        }

        // Visitor type filters
        if (initiated !== undefined) {
          const acceptsInitiated = initiated === "true"
          dbQuery = dbQuery.eq("i_groups.is_accepting_initiated_visitors", acceptsInitiated)
        }

        if (uninitiated !== undefined) {
          const acceptsUninitiated = uninitiated === "true"
          dbQuery = dbQuery.eq("i_groups.is_accepting_uninitiated_visitors", acceptsUninitiated)
        }

        // Only apply database-level ordering if not sorting by distance
        // (distance sorting requires the computed distance field, so we do it in-memory)
        const { data, error } = sortBy === "distance"
          ? await dbQuery
          : await dbQuery.order(
              sortBy === "name" ? "name" : "created_at",
              { ascending: sortOrder === "ascending" }
            )

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch integration groups",
          })
        }

        let transformedData =
          data?.map((group: any) => {
            const iGroupData = group.i_groups as any
            const baseData = {
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
              is_active: iGroupData.is_active,
              created_at: iGroupData.created_at,
              updated_at: iGroupData.updated_at,
              deleted_at: group.deleted_at,
              latitude: group.latitude,
              longitude: group.longitude,
              is_accepting_initiated_visitors: iGroupData.is_accepting_initiated_visitors,
              is_accepting_uninitiated_visitors: iGroupData.is_accepting_uninitiated_visitors,
              is_requiring_contact_before_visiting: iGroupData.is_requiring_contact_before_visiting,
              schedule_events: iGroupData.schedule_events,
              schedule_description: iGroupData.schedule_description,
              area_id: iGroupData.area_id,
              community_id: iGroupData.community_id,
              area: iGroupData.area,
              community: iGroupData.community,
              venue: group.venue,
              public_contact: group.public_contact,
              primary_contact: group.primary_contact,
            }

            // Add distance fields if geolocation was used
            if (distanceMap.has(group.id)) {
              return {
                ...baseData,
                distance: distanceMap.get(group.id),
                distance_units: "meters",
              }
            }

            return baseData
          }) || []

        // Apply city/state filtering (in-memory)
        if (city || state || zipcode) {
          transformedData = transformedData.filter((group: any) => {
            const venueAddress = group.venue?.physical_address
            if (!venueAddress) return false

            // Zipcode filter (exact match)
            if (zipcode) {
              const zipcodeParam = Array.isArray(zipcode) ? zipcode[0] : zipcode
              return venueAddress.postal_code === zipcodeParam.trim()
            }

            // City and/or state filter (case-insensitive)
            let matches = true
            if (city) {
              const cityParam = Array.isArray(city) ? city[0] : city
              matches = matches && venueAddress.city.toLowerCase() === cityParam.trim().toLowerCase()
            }
            if (state) {
              const stateParam = Array.isArray(state) ? state[0] : state
              matches = matches && venueAddress.state.toLowerCase() === stateParam.trim().toLowerCase()
            }
            return matches
          })
        }

        // Apply day-of-week filtering (in-memory)
        if (days) {
          const daysParam = Array.isArray(days) ? days[0] : days
          const requestedDays = daysParam.split(/[\s,+]+/).filter(Boolean)
          const dayMap: Record<string, number> = {
            'sun': 0, 'sunday': 0,
            'mon': 1, 'monday': 1,
            'tue': 2, 'tuesday': 2,
            'wed': 3, 'wednesday': 3,
            'thu': 4, 'thursday': 4,
            'fri': 5, 'friday': 5,
            'sat': 6, 'saturday': 6
          }
          const requestedDayNumbers = requestedDays.map(d => dayMap[d.toLowerCase()]).filter(n => n !== undefined)

          transformedData = transformedData.filter((group: any) => {
            const scheduleEvents = group.schedule_events || []
            if (!Array.isArray(scheduleEvents) || scheduleEvents.length === 0) return false

            return scheduleEvents.some((event: any) => {
              if (!event.start) return false
              const eventDate = new Date(event.start)
              const eventDay = eventDate.getDay()
              return requestedDayNumbers.includes(eventDay)
            })
          })
        }

        // Apply specific date filtering (in-memory)
        if (dates) {
          const datesParam = Array.isArray(dates) ? dates[0] : dates
          const requestedDate = new Date(datesParam)

          transformedData = transformedData.filter((group: any) => {
            const scheduleEvents = group.schedule_events || []
            if (!Array.isArray(scheduleEvents) || scheduleEvents.length === 0) return false

            return scheduleEvents.some((event: any) => {
              if (!event.start) return false
              const eventStart = new Date(event.start)
              const eventEnd = event.end ? new Date(event.end) : eventStart

              // Check if requested date falls within any event
              return requestedDate >= eventStart && requestedDate <= eventEnd
            })
          })
        }

        // Apply time-of-day filtering (in-memory)
        if (time) {
          const timeParam = Array.isArray(time) ? time[0] : time
          const requestedTime = new Date(timeParam)
          const requestedHour = requestedTime.getHours()
          const requestedMinute = requestedTime.getMinutes()

          transformedData = transformedData.filter((group: any) => {
            const scheduleEvents = group.schedule_events || []
            if (!Array.isArray(scheduleEvents) || scheduleEvents.length === 0) return false

            return scheduleEvents.some((event: any) => {
              if (!event.start) return false
              const eventStart = new Date(event.start)
              const eventHour = eventStart.getHours()
              const eventMinute = eventStart.getMinutes()

              // Match within 1 hour window
              const timeDiffMinutes = Math.abs((eventHour * 60 + eventMinute) - (requestedHour * 60 + requestedMinute))
              return timeDiffMinutes <= 60
            })
          })
        }

        // Sort by distance if requested (in-memory sorting)
        if (sortBy === "distance" && distanceMap.size > 0) {
          transformedData.sort((a: any, b: any) => {
            const distA = a.distance || Infinity
            const distB = b.distance || Infinity
            return sortOrder === "ascending" ? distA - distB : distB - distA
          })
        }

        return res.json({
          success: true,
          data: transformedData,
          count: transformedData.length,
        })

      case "POST":
        console.log("[v0] POST /api/i-groups - Creating new integration group")

        const validatedData = IGroupSchema.parse(req.body)

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

        // Create the i_groups record
        const { data: newData, error: createError } = await supabase
          .from("i_groups")
          .insert({
            id: groupData.id,
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
            error: "Failed to create integration group",
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
          message: "Integration group created successfully",
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
