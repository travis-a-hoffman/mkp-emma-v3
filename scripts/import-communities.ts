#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ImportedCommunity {
  // Core fields
  id: string
  name: string
  code: string
  description: string | null
  image_url: string | null
  color: string | null
  is_active: boolean

  // Foreign keys
  area_id: string | null
  coordinator_id: string | null

  // JSON fields
  geo_json: any | null

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
  console.log(`Force mode: ${force ? "enabled (will update existing communities)" : "disabled (will skip duplicates)"}`)

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

  // Read all JSON files from data/{hostname}/communities directory
  const inputDir = path.join(__dirname, "data", inputHostname, "communities")

  console.log(`Reading community files from: ${inputDir}`)

  let files: string[]
  try {
    files = await fs.readdir(inputDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported communities first using: pnpm export:communities`)
    console.error(`Expected directory: ${inputDir}`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${inputDir}`)
    return
  }

  console.log(`Found ${jsonFiles.length} community files to import\n`)

  let importedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const filename of jsonFiles) {
    const filepath = path.join(inputDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let community: ImportedCommunity
    try {
      community = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      errorCount++
      continue
    }

    // Validate foreign key references if they exist
    if (community.area_id) {
      const { data: area } = await supabase.from("areas").select("id").eq("id", community.area_id).single()

      if (!area) {
        console.error(`  ✗ ${filename}: Area with id ${community.area_id} not found in areas table`)
        errorCount++
        continue
      }
    }

    if (community.coordinator_id) {
      const { data: coordinator } = await supabase
        .from("people")
        .select("id")
        .eq("id", community.coordinator_id)
        .single()

      if (!coordinator) {
        console.error(`  ✗ ${filename}: Coordinator with id ${community.coordinator_id} not found in people table`)
        errorCount++
        continue
      }
    }

    // Check if community already exists (by id since code may be null)
    const { data: existingCommunity } = await supabase
      .from("communities")
      .select("id, name")
      .eq("id", community.id)
      .single()

    if (existingCommunity && !force) {
      console.log(`  ⊘ Skipped: ${filename} (${community.name}) - already exists (use --force to update)`)
      skippedCount++
      continue
    }

    if (existingCommunity && force) {
      // Update existing community
      const { error: updateError } = await supabase
        .from("communities")
        .update({
          name: community.name,
          code: community.code,
          description: community.description,
          image_url: community.image_url,
          color: community.color,
          is_active: community.is_active,
          area_id: community.area_id,
          coordinator_id: community.coordinator_id,
          geo_json: community.geo_json,
          deleted_at: community.deleted_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", community.id)

      if (updateError) {
        console.error(`  ✗ Error updating ${filename}: ${updateError.message}`)
        errorCount++
        continue
      }

      console.log(`  ↻ Updated: ${filename} (${community.name})`)
      updatedCount++
    } else {
      // Insert new community
      const { error: insertError } = await supabase.from("communities").insert({
        id: community.id,
        name: community.name,
        code: community.code,
        description: community.description,
        image_url: community.image_url,
        color: community.color,
        is_active: community.is_active,
        area_id: community.area_id,
        coordinator_id: community.coordinator_id,
        geo_json: community.geo_json,
        created_at: community.created_at,
        updated_at: community.updated_at,
        deleted_at: community.deleted_at,
      })

      if (insertError) {
        console.error(`  ✗ Error inserting ${filename}: ${insertError.message}`)
        errorCount++
        continue
      }

      console.log(`  ✓ Imported: ${filename} (${community.name})`)
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
