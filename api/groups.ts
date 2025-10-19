import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"

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

const PersonSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string(),
  middle_name: z.string().nullable().optional(),
  last_name: z.string(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
})

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  url: z.string().url().nullable().optional(),
  members: z.array(PersonSchema).default([]),
  is_accepting_new_members: z.boolean().default(false),
  membership_criteria: z.string().nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  genders: z.string().nullable().optional(),
  is_publicly_listed: z.boolean().default(false),
  public_contact_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().default(true),
  established_on: z.string().nullable().optional(),
})

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
      const { active, search, publicly_listed, lat, latitude, lon, longitude, rad, radius, by, order } = req.query
      console.log("[v0] GET /api/groups — req.query: ", JSON.stringify(req.query))

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

          const { data: nearbyGroups, error: nearbyError } = await supabase.rpc("find_groups_within_radius", {
            point_lon: parsedLon,
            point_lat: parsedLat,
            radius_meters: radiusMeters,
          })

          if (!nearbyError && nearbyGroups && nearbyGroups.length > 0) {
            // Filter out soft-deleted groups
            const validGroups = nearbyGroups.filter((g: any) => !g.deleted_at)
            filteredIds = validGroups.map((g: any) => g.id)
            validGroups.forEach((g: any) => {
              distanceMap.set(g.id, g.distance_meters)
            })
            console.log(`[v0] Found ${filteredIds!.length} groups within ${radiusMiles} miles`)
          } else if (!nearbyError) {
            // No groups found within radius, return empty result
            console.log(`[v0] No groups found within ${radiusMiles} miles`)
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

      let query = supabase
        .from("groups")
        .select(`
          *,
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
          public_contact:people!public_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url),
          primary_contact:people!primary_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url)
        `)
        .is("deleted_at", null)

      // Filter by geolocation IDs if provided
      if (filteredIds) {
        query = query.in("id", filteredIds)
      }

      // Filter by active status
      if (active === "true") {
        query = query.eq("is_active", true)
      } else if (active === "false") {
        query = query.eq("is_active", false)
      }

      // Filter by publicly listed status
      if (publicly_listed === "true") {
        query = query.eq("is_publicly_listed", true)
      } else if (publicly_listed === "false") {
        query = query.eq("is_publicly_listed", false)
      }

      // Search functionality
      if (search && typeof search === "string") {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      // Only apply database-level ordering if not sorting by distance
      if (sortBy !== "distance") {
        query = query.order(
          sortBy === "name" ? "name" : "created_at",
          { ascending: sortOrder === "ascending" }
        )
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to fetch groups",
          details: error,
        })
      }

      // Add distance fields if geolocation was used
      let transformedData = data || []
      if (distanceMap.size > 0) {
        transformedData = transformedData.map((group: any) => {
          if (distanceMap.has(group.id)) {
            return {
              ...group,
              distance: distanceMap.get(group.id),
              distance_units: "meters",
            }
          }
          return group
        })

        // Sort by distance if requested (in-memory sorting)
        if (sortBy === "distance") {
          transformedData.sort((a: any, b: any) => {
            const distA = a.distance || Infinity
            const distB = b.distance || Infinity
            return sortOrder === "ascending" ? distA - distB : distB - distA
          })
        }
      }

      return res.status(200).json({
        success: true,
        data: transformedData,
        count: transformedData.length,
      })
    } else if (req.method === "POST") {
      const validation = CreateGroupSchema.safeParse(req.body)

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        })
      }

      const groupData = validation.data

      const { data, error } = await supabase
        .from("groups")
        .insert([groupData])
        .select(`
          *,
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
          public_contact:people!public_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url),
          primary_contact:people!primary_contact_id(id, first_name, middle_name, last_name, email, phone, photo_url)
        `)
        .single()

      if (error) {
        console.error("Database error:", error)
        return res.status(500).json({
          success: false,
          error: "Failed to create group",
          details: error,
        })
      }

      return res.status(201).json({
        success: true,
        data,
        message: "Group created successfully",
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
