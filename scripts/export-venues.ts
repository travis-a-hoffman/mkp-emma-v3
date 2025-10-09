#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ExportedVenue {
  // Core fields
  id: string
  name: string
  description: string | null
  email: string | null
  phone: string | null
  website: string | null
  timezone: string

  // Foreign keys
  mailing_address_id: string | null
  physical_address_id: string | null
  primary_contact_id: string | null
  area_id: string | null
  community_id: string | null

  // JSON fields
  event_types: any

  // Location
  latitude: number | null
  longitude: number | null

  // Notes
  nudity_note: string | null
  rejected_note: string | null

  // Flags
  is_nudity: boolean
  is_rejected: boolean
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
  let hostOverride: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--host") {
      // Get the next argument as the host value
      if (i + 1 < args.length) {
        hostOverride = args[i + 1]
        i++ // Skip the next argument since we've consumed it
      } else {
        console.error("Error: --host flag requires a hostname argument")
        process.exit(1)
      }
    } else if (!arg.startsWith("--")) {
      envFilePath = arg
    }
  }

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

  // Determine the output hostname (use override if provided, otherwise use HOSTNAME env var)
  const outputHostname = hostOverride || process.env.HOSTNAME
  if (!outputHostname) {
    console.error("Error: HOSTNAME must be set in .env file or provided via --host parameter")
    process.exit(1)
  }
  console.log(`Output directory will be based on hostname: ${outputHostname}`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Query all venues
  console.log("Fetching venues from database...")

  const { data: venues, error } = await supabase.from("venues").select("*").order("name", { ascending: true })

  if (error) {
    console.error("Error fetching venues:", error)
    process.exit(1)
  }

  if (!venues || venues.length === 0) {
    console.log("No venues found in database")
    return
  }

  console.log(`Found ${venues.length} venues`)

  // Ensure output directory exists (with hostname-based path)
  const outputDir = path.join(__dirname, "data", outputHostname, "venues")
  await fs.mkdir(outputDir, { recursive: true })

  // Export each venue as a separate JSON file
  let exportedCount = 0

  for (const venue of venues) {
    const exportData: ExportedVenue = {
      id: venue.id,
      name: venue.name,
      description: venue.description,
      email: venue.email,
      phone: venue.phone,
      website: venue.website,
      timezone: venue.timezone,
      mailing_address_id: venue.mailing_address_id,
      physical_address_id: venue.physical_address_id,
      primary_contact_id: venue.primary_contact_id,
      area_id: venue.area_id,
      community_id: venue.community_id,
      event_types: venue.event_types,
      latitude: venue.latitude,
      longitude: venue.longitude,
      nudity_note: venue.nudity_note,
      rejected_note: venue.rejected_note,
      is_nudity: venue.is_nudity,
      is_rejected: venue.is_rejected,
      is_active: venue.is_active,
      created_at: venue.created_at,
      updated_at: venue.updated_at,
      deleted_at: venue.deleted_at,
    }

    // Use a sanitized name for filename (venues don't have a code field)
    const sanitizedName = venue.name.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 50)
    const filename = `${sanitizedName}_${venue.id.substring(0, 8)}.json`
    const filepath = path.join(outputDir, filename)

    const jsonContent = pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)

    await fs.writeFile(filepath, jsonContent, "utf-8")

    console.log(`  ✓ Exported: ${filename} (${venue.name})`)
    exportedCount++
  }

  console.log(`\n✅ Successfully exported ${exportedCount} venues to ${outputDir}`)
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
