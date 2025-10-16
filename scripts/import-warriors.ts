#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Imported warrior structure (from extract-warriors-from-groups.ts output)
interface ImportedWarrior {
  // Person fields
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string | null
  phone: string | null
  billing_address_id: string | null
  mailing_address_id: string | null
  physical_address_id: string | null
  notes: string | null
  photo_url: string | null
  birth_date: string | null
  deceased_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Warrior-specific fields
  log_id: string | null
  initiation_id: string | null
  initiation_on: string | null
  status: string
  training_events: string[]
  staffed_events: string[]
  lead_events: string[]
  mos_events: string[]
  area_id: string | null
  community_id: string | null
  inner_essence_name: string | null
  // Raw MKP Connect data
  mkpconnect_data: any
}

interface ImportStats {
  imported: number
  updated: number
  skipped: number
  errors: number
}

async function validateForeignKeys(warrior: ImportedWarrior, supabase: any, filename: string): Promise<string | null> {
  // Validate area_id
  if (warrior.area_id) {
    const { data: area } = await supabase.from("areas").select("id").eq("id", warrior.area_id).single()
    if (!area) {
      return `Area with id ${warrior.area_id} not found in areas table`
    }
  }

  // Validate community_id
  if (warrior.community_id) {
    const { data: community } = await supabase
      .from("communities")
      .select("id")
      .eq("id", warrior.community_id)
      .single()
    if (!community) {
      return `Community with id ${warrior.community_id} not found in communities table`
    }
  }

  // Validate initiation_id
  if (warrior.initiation_id) {
    const { data: event } = await supabase.from("events").select("id").eq("id", warrior.initiation_id).single()
    if (!event) {
      return `Initiation event with id ${warrior.initiation_id} not found in events table`
    }
  }

  return null
}

async function importWarrior(
  warrior: ImportedWarrior,
  supabase: any,
  filename: string,
  force: boolean,
  stats: ImportStats
): Promise<void> {
  // Validate foreign keys
  const validationError = await validateForeignKeys(warrior, supabase, filename)
  if (validationError) {
    console.error(`  ✗ ${filename}: ${validationError}`)
    stats.errors++
    return
  }

  // Check if person/warrior already exists
  const { data: existingPerson } = await supabase
    .from("people")
    .select("id, first_name, last_name")
    .eq("id", warrior.id)
    .single()

  if (existingPerson && !force) {
    console.log(
      `  ⊘ Skipped: ${filename} (${warrior.first_name} ${warrior.last_name}) - already exists (use --force to update)`
    )
    stats.skipped++
    return
  }

  // Add imported_at timestamp to mkpconnect_data
  const mkpconnectDataWithTimestamp = {
    ...warrior.mkpconnect_data,
    imported_at: new Date().toISOString(),
  }

  if (existingPerson && force) {
    // Update existing person
    const { error: updatePersonError } = await supabase
      .from("people")
      .update({
        first_name: warrior.first_name,
        middle_name: warrior.middle_name,
        last_name: warrior.last_name,
        email: warrior.email,
        phone: warrior.phone,
        billing_address_id: warrior.billing_address_id,
        mailing_address_id: warrior.mailing_address_id,
        physical_address_id: warrior.physical_address_id,
        notes: warrior.notes,
        photo_url: warrior.photo_url,
        birth_date: warrior.birth_date,
        deceased_date: warrior.deceased_date,
        is_active: warrior.is_active,
        mkpconnect_data: mkpconnectDataWithTimestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", warrior.id)

    if (updatePersonError) {
      console.error(`  ✗ Error updating person for ${filename}: ${updatePersonError.message}`)
      stats.errors++
      return
    }

    // Update warriors record
    const { error: updateWarriorError } = await supabase
      .from("warriors")
      .update({
        log_id: warrior.log_id,
        initiation_id: warrior.initiation_id,
        initiation_on: warrior.initiation_on,
        status: warrior.status,
        inner_essence_name: warrior.inner_essence_name,
        training_events: warrior.training_events,
        staffed_events: warrior.staffed_events,
        lead_events: warrior.lead_events,
        mos_events: warrior.mos_events,
        area_id: warrior.area_id,
        community_id: warrior.community_id,
        is_active: warrior.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", warrior.id)

    if (updateWarriorError) {
      console.error(`  ✗ Error updating warrior for ${filename}: ${updateWarriorError.message}`)
      stats.errors++
      return
    }

    console.log(`  ↻ Updated: ${filename} (${warrior.first_name} ${warrior.last_name})`)
    stats.updated++
  } else {
    // Insert new person
    const { error: insertPersonError } = await supabase.from("people").insert({
      id: warrior.id,
      first_name: warrior.first_name,
      middle_name: warrior.middle_name,
      last_name: warrior.last_name,
      email: warrior.email,
      phone: warrior.phone,
      billing_address_id: warrior.billing_address_id,
      mailing_address_id: warrior.mailing_address_id,
      physical_address_id: warrior.physical_address_id,
      notes: warrior.notes,
      photo_url: warrior.photo_url,
      birth_date: warrior.birth_date,
      deceased_date: warrior.deceased_date,
      is_active: warrior.is_active,
      mkpconnect_data: mkpconnectDataWithTimestamp,
      created_at: warrior.created_at,
      updated_at: warrior.updated_at,
    })

    if (insertPersonError) {
      console.error(`  ✗ Error inserting person for ${filename}: ${insertPersonError.message}`)
      stats.errors++
      return
    }

    // Insert warriors record (same ID)
    const { error: insertWarriorError } = await supabase.from("warriors").insert({
      id: warrior.id,
      log_id: warrior.log_id,
      initiation_id: warrior.initiation_id,
      initiation_on: warrior.initiation_on,
      status: warrior.status,
      inner_essence_name: warrior.inner_essence_name,
      training_events: warrior.training_events,
      staffed_events: warrior.staffed_events,
      lead_events: warrior.lead_events,
      mos_events: warrior.mos_events,
      area_id: warrior.area_id,
      community_id: warrior.community_id,
      is_active: warrior.is_active,
      created_at: warrior.created_at,
      updated_at: warrior.updated_at,
    })

    if (insertWarriorError) {
      console.error(`  ✗ Error inserting warrior for ${filename}: ${insertWarriorError.message}`)
      stats.errors++
      return
    }

    console.log(`  ✓ Imported: ${filename} (${warrior.first_name} ${warrior.last_name})`)
    stats.imported++
  }
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
      if (i + 1 < args.length) {
        hostOverride = args[i + 1]
        i++
      } else {
        console.error("Error: --host flag requires a hostname argument")
        process.exit(1)
      }
    } else if (!arg.startsWith("--")) {
      envFilePath = arg
    }
  }

  // Load environment variables
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
  console.log(`Force mode: ${force ? "enabled (will update existing warriors)" : "disabled (will skip duplicates)"}`)

  // Determine the input hostname
  const inputHostname = hostOverride || process.env.HOSTNAME || "mkp-emma-v3.vercel.app"
  console.log(`Input directory will be based on hostname: ${inputHostname}`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Initialize stats
  const stats: ImportStats = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  }

  // Process Warriors
  const warriorsDir = path.join(__dirname, "data", inputHostname, "warriors")
  console.log(`\nReading warrior files from: ${warriorsDir}`)

  let warriorFiles: string[] = []
  try {
    warriorFiles = await fs.readdir(warriorsDir)
    warriorFiles = warriorFiles.filter((f) => f.endsWith(".json"))
    console.log(`Found ${warriorFiles.length} warrior files to import\n`)
  } catch (error: any) {
    console.error(`Error: Could not read warriors directory: ${error.message}`)
    process.exit(1)
  }

  if (warriorFiles.length === 0) {
    console.log("No warrior files found to import")
    process.exit(0)
  }

  // Import each warrior
  for (const filename of warriorFiles) {
    const filepath = path.join(warriorsDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let warrior: ImportedWarrior
    try {
      warrior = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      stats.errors++
      continue
    }

    // Basic validation
    if (!warrior.id || !warrior.first_name || !warrior.last_name) {
      console.error(`  ✗ ${filename}: Missing required fields (id, first_name, last_name)`)
      stats.errors++
      continue
    }

    await importWarrior(warrior, supabase, filename, force, stats)
  }

  // Print summary
  console.log(`\n${"=".repeat(60)}`)
  console.log(`📊 Import Summary`)
  console.log(`${"=".repeat(60)}`)
  console.log(`\n  Warriors:`)
  console.log(`    ✓ Imported: ${stats.imported}`)
  if (stats.updated > 0) console.log(`    ↻ Updated: ${stats.updated}`)
  if (stats.skipped > 0) console.log(`    ⊘ Skipped: ${stats.skipped}`)
  if (stats.errors > 0) console.log(`    ✗ Errors: ${stats.errors}`)

  console.log(`\n${"=".repeat(60)}`)
  console.log(`✅ Import complete!`)
  console.log(`${"=".repeat(60)}\n`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
