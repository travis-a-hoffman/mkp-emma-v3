import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { supabase, isSupabaseConfigured } from "./_lib/supabase.js"
import type { Person } from "../src/types/person"

interface Address {
  address_1: string
  address_2?: string | null
  city: string
  state: string
  postal_code: string
  country: string
}

interface Auth0User {
  id: string // a number
  govem_name: string | null
  family_name: string | null
  email: string | null
  nickname: string | null
  picture: string | null
  sub: string | null
  extracted_at: string
}

// Based on response type from GET /api/mkp-connect/warriors
interface CiviCrmUser {
  id: string
  civicrm_id: number
  drupal_id: number
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  email_primary: string | null
  phone_primary: string | null
  billing_address: Address | null
  physical_address: Address | null
  mailing_address: Address | null
  extracted_at: string
}

interface DrupalUser {
  id: string
  drupal_id: number
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  email_primary: string | null
  phone_primary: string | null
  photo: string | null
  extracted_at: string
}

interface EmmaUserWithRelations {
  id: string
  auth0_user: Auth0User
  civiCrmUser: CiviCrmUser
  drupalUser: DrupalUser
  person: Person

  otherAuth0Users: Auth0User[]
  otherCiviCrmUsers: CiviCrmUser[]
  otherDrupalUsers: DrupalUser[]
  otherPeople: Person[]

  synchronized_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  is_active: boolean
}

export type { EmmaUserWithRelations }

const UserSchema = z.object({
  id: z.string().uuid().optional(),
  auth0_user: z.any().optional().nullable(),
  civicrm_user: z.any().optional().nullable(),
  drupal_user: z.any().optional().nullable(),
  other_auth0_users: z.array(z.any()).default([]),
  other_civicrm_users: z.array(z.any()).default([]),
  other_drupal_users: z.array(z.any()).default([]),
  approved_at: z.string().optional().nullable(),
  synchronized_at: z.string().optional().nullable(),
})

export type UserApiResponse = {
  success: boolean
  data: EmmaUserWithRelations | EmmaUserWithRelations[]
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
        // GET /api/users - Retrieve all users
        console.log("[v0] GET /api/users - Fetching all users")

        const { approved, search, email } = query
        let dbQuery = supabase?.from("emma_users").select("*")

        if (approved !== undefined) {
          if (approved === "true") {
            dbQuery = dbQuery.not("approved_at", "is", null)
          } else if (approved === "false") {
            dbQuery = dbQuery.is("approved_at", null)
          }
        }

        if (email && typeof email === "string") {
          // Search in auth0_user, civicrm_user, and drupal_user email fields
          dbQuery = dbQuery.or(
            `auth0_user->>email.eq.${email},civicrm_user->>email_primary.eq.${email},drupal_user->>email_primary.eq.${email}`,
          )
        }

        if (search && typeof search === "string") {
          const searchTerm = search.trim()
          if (searchTerm.length > 0) {
            // Search in various name fields across user objects
            dbQuery = dbQuery.or(
              `auth0_user->>given_name.ilike.*${searchTerm}*,auth0_user->>family_name.ilike.*${searchTerm}*,civicrm_user->>first_name.ilike.*${searchTerm}*,civicrm_user->>last_name.ilike.*${searchTerm}*,drupal_user->>first_name.ilike.*${searchTerm}*,drupal_user->>last_name.ilike.*${searchTerm}*`,
            )
          }
        }

        const { data, error } = await dbQuery.order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Database error:", error)
          return res.status(500).json({
            success: false,
            error: "Failed to fetch users",
          })
        }

        return res.json({
          success: true,
          data: data || [],
          count: data?.length || 0,
        })

      case "POST":
        // POST /api/users - Create a new user
        console.log("[v0] POST /api/users - Creating new user")

        const validatedData = UserSchema.parse(req.body)

        const { data: newData, error: createError } = await supabase
          .from("emma_users")
          .insert({
            auth0_user: validatedData.auth0_user || null,
            civicrm_user: validatedData.civicrm_user || null,
            drupal_user: validatedData.drupal_user || null,
            other_auth0_users: validatedData.other_auth0_users,
            other_civicrm_users: validatedData.other_civicrm_users,
            other_drupal_users: validatedData.other_drupal_users,
            approved_at: validatedData.approved_at || null,
          })
          .select("*")
          .single()

        if (createError) {
          console.error("[v0] Database error:", createError)
          return res.status(500).json({
            success: false,
            error: "Failed to create user",
          })
        }

        return res.status(201).json({
          success: true,
          data: newData,
          message: "User created successfully",
        })

      case "PUT":
        // PUT /api/users?id=uuid - Update an existing user
        console.log("[v0] PUT /api/users - Updating user")

        const { id } = query
        if (!id || typeof id !== "string") {
          return res.status(400).json({
            success: false,
            error: "User ID is required",
          })
        }

        const updateData = UserSchema.partial().parse(req.body)

        const { data: updatedData, error: updateError } = await supabase
          .from("emma_users")
          .update({
            auth0_user: updateData.auth0_user,
            civicrm_user: updateData.civicrm_user,
            drupal_user: updateData.drupal_user,
            other_auth0_users: updateData.other_auth0_users,
            other_civicrm_users: updateData.other_civicrm_users,
            other_drupal_users: updateData.other_drupal_users,
            approved_at: updateData.approved_at,
          })
          .eq("id", id)
          .select("*")
          .single()

        if (updateError) {
          console.error("[v0] Database error:", updateError)
          return res.status(500).json({
            success: false,
            error: "Failed to update user",
          })
        }

        return res.json({
          success: true,
          data: updatedData,
          message: "User updated successfully",
        })

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT"])
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
