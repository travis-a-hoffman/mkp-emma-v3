#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ExportedPerson {
  // Core fields
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string | null
  phone: string | null

  // Foreign keys
  billing_address_id: string | null
  mailing_address_id: string | null
  physical_address_id: string | null

  // Additional fields
  notes: string | null
  photo_url: string | null
  is_active: boolean

  // Timestamps
  created_at: string
  updated_at: string
  deleted_at: string | null
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let pretty = false
  let filterAreas = false
  let filterCommunities = false
  let filterVenues = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--areas") {
      filterAreas = true
    } else if (arg === "--communities") {
      filterCommunities = true
    } else if (arg === "--venues") {
      filterVenues = true
    } else if (!arg.startsWith("--")) {
      envFilePath = arg
    }
  }

  const hasFilters = filterAreas || filterCommunities || filterVenues

  // Load environment variables from specified .env file
  const envPath = path.isAbsolute(envFilePath) ? envFilePath : path.resolve(process.cwd(), envFilePath)

  console.log(`Loading environment variables from: ${envPath}`)
  const result = config({ path: envPath })

  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`)
    process.exit(1)
  }

  // Validate required environment variables
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
    process.exit(1)
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Collect person IDs based on filters
  const personIds = new Set<string>()

  if (hasFilters) {
    console.log(`Filtering people by: ${[filterAreas && "areas", filterCommunities && "communities", filterVenues && "venues"].filter(Boolean).join(", ")}`)

    // Get people from areas
    if (filterAreas) {
      console.log("  - Collecting people from areas...")

      // Get stewards and finance coordinators from areas
      const { data: areas, error: areasError } = await supabase
        .from("areas")
        .select("steward_id, finance_coordinator_id")

      if (areasError) {
        console.error("Error fetching areas:", areasError)
        process.exit(1)
      }

      if (areas) {
        for (const area of areas) {
          if (area.steward_id) personIds.add(area.steward_id)
          if (area.finance_coordinator_id) personIds.add(area.finance_coordinator_id)
        }
      }

      // Get people from area_admins
      const { data: areaAdmins, error: areaAdminsError } = await supabase
        .from("area_admins")
        .select("person_id")

      if (areaAdminsError) {
        console.error("Error fetching area_admins:", areaAdminsError)
        process.exit(1)
      }

      if (areaAdmins) {
        for (const admin of areaAdmins) {
          if (admin.person_id) personIds.add(admin.person_id)
        }
      }

      console.log(`    Found ${personIds.size} unique people from areas`)
    }

    // Get people from communities
    if (filterCommunities) {
      console.log("  - Collecting people from communities...")
      const beforeCount = personIds.size

      const { data: communities, error: communitiesError } = await supabase
        .from("communities")
        .select("coordinator_id")

      if (communitiesError) {
        console.error("Error fetching communities:", communitiesError)
        process.exit(1)
      }

      if (communities) {
        for (const community of communities) {
          if (community.coordinator_id) personIds.add(community.coordinator_id)
        }
      }

      console.log(`    Added ${personIds.size - beforeCount} unique people from communities (total: ${personIds.size})`)
    }

    // Get people from venues
    if (filterVenues) {
      console.log("  - Collecting people from venues...")
      const beforeCount = personIds.size

      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("primary_contact_id")

      if (venuesError) {
        console.error("Error fetching venues:", venuesError)
        process.exit(1)
      }

      if (venues) {
        for (const venue of venues) {
          if (venue.primary_contact_id) personIds.add(venue.primary_contact_id)
        }
      }

      console.log(`    Added ${personIds.size - beforeCount} unique people from venues (total: ${personIds.size})`)
    }

    console.log(`\nTotal unique people to export: ${personIds.size}`)
  }

  // Query people
  console.log("Fetching people from database...")

  let peopleQuery = supabase.from("people").select("*")

  if (hasFilters && personIds.size > 0) {
    // Filter by collected person IDs
    peopleQuery = peopleQuery.in("id", Array.from(personIds))
  } else if (hasFilters && personIds.size === 0) {
    console.log("No people found matching the specified filters")
    return
  }

  const { data: people, error } = await peopleQuery.order("last_name", { ascending: true })

  if (error) {
    console.error("Error fetching people:", error)
    process.exit(1)
  }

  if (!people || people.length === 0) {
    console.log("No people found in database")
    return
  }

  console.log(`Found ${people.length} people`)

  // Ensure output directory exists
  const outputDir = path.join(__dirname, "data", "people")
  await fs.mkdir(outputDir, { recursive: true })

  // Export each person as a separate JSON file
  let exportedCount = 0

  for (const person of people) {
    const exportData: ExportedPerson = {
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
      is_active: person.is_active,
      created_at: person.created_at,
      updated_at: person.updated_at,
      deleted_at: person.deleted_at,
    }

    // Use sanitized name for filename (people don't have a code field)
    const sanitizedFirstName = person.first_name.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 20)
    const sanitizedLastName = person.last_name.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 20)
    const filename = `${sanitizedLastName}_${sanitizedFirstName}_${person.id.substring(0, 8)}.json`
    const filepath = path.join(outputDir, filename)

    const jsonContent = pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)

    await fs.writeFile(filepath, jsonContent, "utf-8")

    console.log(`  ✓ Exported: ${filename} (${person.first_name} ${person.last_name})`)
    exportedCount++
  }

  console.log(`\n✅ Successfully exported ${exportedCount} people to ${outputDir}`)
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
