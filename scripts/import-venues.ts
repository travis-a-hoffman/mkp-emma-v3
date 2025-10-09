#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ImportedVenue {
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
  let force = false
  let hostOverride: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--force") {
      force = true
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
  console.log(`Force mode: ${force ? "enabled (will update existing venues)" : "disabled (will skip duplicates)"}`)

  // Determine the input hostname (use override if provided, otherwise use HOSTNAME env var)
  const inputHostname = hostOverride || process.env.HOSTNAME
  if (!inputHostname) {
    console.error("Error: HOSTNAME must be set in .env file or provided via --host parameter")
    process.exit(1)
  }
  console.log(`Input directory will be based on hostname: ${inputHostname}`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Read all JSON files from data/{hostname}/venues directory
  const inputDir = path.join(__dirname, "data", inputHostname, "venues")

  console.log(`Reading venue files from: ${inputDir}`)

  let files: string[]
  try {
    files = await fs.readdir(inputDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported venues first using: pnpm export:venues`)
    console.error(`Expected directory: ${inputDir}`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${inputDir}`)
    return
  }

  console.log(`Found ${jsonFiles.length} venue files to import\n`)

  let importedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const filename of jsonFiles) {
    const filepath = path.join(inputDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let venue: ImportedVenue
    try {
      venue = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      errorCount++
      continue
    }

    // Validate foreign key references if they exist
    if (venue.area_id) {
      const { data: area } = await supabase.from("areas").select("id").eq("id", venue.area_id).single()

      if (!area) {
        console.error(`  ✗ ${filename}: Area with id ${venue.area_id} not found in areas table`)
        errorCount++
        continue
      }
    }

    if (venue.community_id) {
      const { data: community } = await supabase.from("communities").select("id").eq("id", venue.community_id).single()

      if (!community) {
        console.error(`  ✗ ${filename}: Community with id ${venue.community_id} not found in communities table`)
        errorCount++
        continue
      }
    }

    if (venue.primary_contact_id) {
      const { data: contact } = await supabase.from("people").select("id").eq("id", venue.primary_contact_id).single()

      if (!contact) {
        console.error(`  ✗ ${filename}: Contact with id ${venue.primary_contact_id} not found in people table`)
        errorCount++
        continue
      }
    }

    if (venue.mailing_address_id) {
      const { data: address } = await supabase
        .from("addresses")
        .select("id")
        .eq("id", venue.mailing_address_id)
        .single()

      if (!address) {
        console.error(
          `  ✗ ${filename}: Mailing address with id ${venue.mailing_address_id} not found in addresses table`
        )
        errorCount++
        continue
      }
    }

    if (venue.physical_address_id) {
      const { data: address } = await supabase
        .from("addresses")
        .select("id")
        .eq("id", venue.physical_address_id)
        .single()

      if (!address) {
        console.error(
          `  ✗ ${filename}: Physical address with id ${venue.physical_address_id} not found in addresses table`
        )
        errorCount++
        continue
      }
    }

    // Check if venue already exists (by id)
    const { data: existingVenue } = await supabase.from("venues").select("id, name").eq("id", venue.id).single()

    if (existingVenue && !force) {
      console.log(`  ⊘ Skipped: ${filename} (${venue.name}) - already exists (use --force to update)`)
      skippedCount++
      continue
    }

    if (existingVenue && force) {
      // Update existing venue
      const { error: updateError } = await supabase
        .from("venues")
        .update({
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
          deleted_at: venue.deleted_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", venue.id)

      if (updateError) {
        console.error(`  ✗ Error updating ${filename}: ${updateError.message}`)
        errorCount++
        continue
      }

      console.log(`  ↻ Updated: ${filename} (${venue.name})`)
      updatedCount++
    } else {
      // Insert new venue
      const { error: insertError } = await supabase.from("venues").insert({
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
      })

      if (insertError) {
        console.error(`  ✗ Error inserting ${filename}: ${insertError.message}`)
        errorCount++
        continue
      }

      console.log(`  ✓ Imported: ${filename} (${venue.name})`)
      importedCount++
    }
  }

  console.log(`\n📊 Import Summary:`)
  console.log(`  ✓ Imported: ${importedCount}`)
  if (updatedCount > 0) console.log(`  ↻ Updated: ${updatedCount}`)
  if (skippedCount > 0) console.log(`  ⊘ Skipped: ${skippedCount}`)
  if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)
  console.log(`\n✅ Import complete!`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
