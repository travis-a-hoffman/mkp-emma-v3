#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ImportedArea {
  // Core fields
  id: string
  name: string
  code: string
  description: string | null
  color: string | null
  is_active: boolean
  image_url: string | null

  // Foreign keys
  steward_id: string | null
  finance_coordinator_id: string | null

  // JSON fields
  geo_json: any | null

  // Timestamps
  created_at: string
  updated_at: string
  deleted_at: string | null

  // Related data
  area_admins: Array<{
    id: string
    area_id: string
    person_id: string
    created_at: string
    updated_at: string
  }>
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
  console.log(`Force mode: ${force ? "enabled (will update existing areas)" : "disabled (will skip duplicates)"}`)

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

  // Read all JSON files from data/{hostname}/areas directory
  const inputDir = path.join(__dirname, "data", inputHostname, "areas")

  console.log(`Reading area files from: ${inputDir}`)

  let files: string[]
  try {
    files = await fs.readdir(inputDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported areas first using: pnpm export:areas`)
    console.error(`Expected directory: ${inputDir}`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${inputDir}`)
    return
  }

  console.log(`Found ${jsonFiles.length} area files to import\n`)

  let importedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const filename of jsonFiles) {
    const filepath = path.join(inputDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let area: ImportedArea
    try {
      area = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      errorCount++
      continue
    }

    // Validate foreign key references if they exist
    if (area.steward_id) {
      const { data: steward } = await supabase.from("people").select("id").eq("id", area.steward_id).single()

      if (!steward) {
        console.error(`  ✗ ${filename}: Steward with id ${area.steward_id} not found in people table`)
        errorCount++
        continue
      }
    }

    if (area.finance_coordinator_id) {
      const { data: coordinator } = await supabase
        .from("people")
        .select("id")
        .eq("id", area.finance_coordinator_id)
        .single()

      if (!coordinator) {
        console.error(
          `  ✗ ${filename}: Finance coordinator with id ${area.finance_coordinator_id} not found in people table`
        )
        errorCount++
        continue
      }
    }

    // Check if area already exists (by id since code may be null)
    const { data: existingArea } = await supabase.from("areas").select("id, name").eq("id", area.id).single()

    if (existingArea && !force) {
      console.log(`  ⊘ Skipped: ${filename} (${area.name}) - already exists (use --force to update)`)
      skippedCount++
      continue
    }

    if (existingArea && force) {
      // Update existing area
      const { error: updateError } = await supabase
        .from("areas")
        .update({
          name: area.name,
          code: area.code,
          description: area.description,
          color: area.color,
          is_active: area.is_active,
          image_url: area.image_url,
          steward_id: area.steward_id,
          finance_coordinator_id: area.finance_coordinator_id,
          geo_json: area.geo_json,
          deleted_at: area.deleted_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", area.id)

      if (updateError) {
        console.error(`  ✗ Error updating ${filename}: ${updateError.message}`)
        errorCount++
        continue
      }

      // Delete existing area_admins
      await supabase.from("area_admins").delete().eq("area_id", existingArea.id)

      // Insert new area_admins
      if (area.area_admins && area.area_admins.length > 0) {
        // Validate that all person_ids exist
        const personIds = area.area_admins.map((admin) => admin.person_id)
        const { data: people } = await supabase.from("people").select("id").in("id", personIds)

        if (!people || people.length !== personIds.length) {
          console.warn(`  ⚠ Warning: Some person_ids in area_admins for ${filename} not found, skipping admins`)
        } else {
          const { error: adminsError } = await supabase.from("area_admins").insert(
            area.area_admins.map((admin) => ({
              area_id: existingArea.id,
              person_id: admin.person_id,
            }))
          )

          if (adminsError) {
            console.error(`  ✗ Error inserting area_admins for ${filename}: ${adminsError.message}`)
          }
        }
      }

      console.log(`  ↻ Updated: ${filename} (${area.name})`)
      updatedCount++
    } else {
      // Insert new area
      const { data: newArea, error: insertError } = await supabase
        .from("areas")
        .insert({
          id: area.id,
          name: area.name,
          code: area.code,
          description: area.description,
          color: area.color,
          is_active: area.is_active,
          image_url: area.image_url,
          steward_id: area.steward_id,
          finance_coordinator_id: area.finance_coordinator_id,
          geo_json: area.geo_json,
          created_at: area.created_at,
          updated_at: area.updated_at,
          deleted_at: area.deleted_at,
        })
        .select()
        .single()

      if (insertError) {
        console.error(`  ✗ Error inserting ${filename}: ${insertError.message}`)
        errorCount++
        continue
      }

      // Insert area_admins
      if (area.area_admins && area.area_admins.length > 0) {
        // Validate that all person_ids exist
        const personIds = area.area_admins.map((admin) => admin.person_id)
        const { data: people } = await supabase.from("people").select("id").in("id", personIds)

        if (!people || people.length !== personIds.length) {
          console.warn(`  ⚠ Warning: Some person_ids in area_admins for ${filename} not found, skipping admins`)
        } else {
          const { error: adminsError } = await supabase.from("area_admins").insert(
            area.area_admins.map((admin) => ({
              id: admin.id,
              area_id: admin.area_id,
              person_id: admin.person_id,
              created_at: admin.created_at,
              updated_at: admin.updated_at,
            }))
          )

          if (adminsError) {
            console.error(`  ✗ Error inserting area_admins for ${filename}: ${adminsError.message}`)
          }
        }
      }

      console.log(`  ✓ Imported: ${filename} (${area.name})`)
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
