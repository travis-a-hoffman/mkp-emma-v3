#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ImportedAddress {
  // Core fields
  id: string
  address_1: string
  address_2: string | null
  city: string
  state: string
  postal_code: string
  country: string

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
  console.log(`Force mode: ${force ? "enabled (will update existing addresses)" : "disabled (will skip duplicates)"}`)

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

  // Read all JSON files from data/{hostname}/addresses directory
  const inputDir = path.join(__dirname, "data", inputHostname, "addresses")

  console.log(`Reading address files from: ${inputDir}`)

  let files: string[]
  try {
    files = await fs.readdir(inputDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported addresses first using: pnpm export:addresses`)
    console.error(`Expected directory: ${inputDir}`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${inputDir}`)
    return
  }

  console.log(`Found ${jsonFiles.length} address files to import\n`)

  let importedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const filename of jsonFiles) {
    const filepath = path.join(inputDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let address: ImportedAddress
    try {
      address = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      errorCount++
      continue
    }

    // Check if address already exists (by id)
    const { data: existingAddress } = await supabase.from("addresses").select("id").eq("id", address.id).single()

    if (existingAddress && !force) {
      console.log(
        `  ⊘ Skipped: ${filename} (${address.address_1}, ${address.city}) - already exists (use --force to update)`
      )
      skippedCount++
      continue
    }

    if (existingAddress && force) {
      // Update existing address
      const { error: updateError } = await supabase
        .from("addresses")
        .update({
          address_1: address.address_1,
          address_2: address.address_2,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country,
          deleted_at: address.deleted_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", address.id)

      if (updateError) {
        console.error(`  ✗ Error updating ${filename}: ${updateError.message}`)
        errorCount++
        continue
      }

      console.log(`  ↻ Updated: ${filename} (${address.address_1}, ${address.city})`)
      updatedCount++
    } else {
      // Insert new address
      const { error: insertError } = await supabase.from("addresses").insert({
        id: address.id,
        address_1: address.address_1,
        address_2: address.address_2,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
        created_at: address.created_at,
        updated_at: address.updated_at,
        deleted_at: address.deleted_at,
      })

      if (insertError) {
        console.error(`  ✗ Error inserting ${filename}: ${insertError.message}`)
        errorCount++
        continue
      }

      console.log(`  ✓ Imported: ${filename} (${address.address_1}, ${address.city})`)
      importedCount++
    }
  }

  console.log(`\n📊 Import Summary:`)
  console.log(`  ✓ Imported: ${importedCount}`)
  if (updatedCount > 0) console.log(`  ↻ Updated: ${updatedCount}`)
  if (skippedCount > 0) console.log(`  ⊘ Skipped: ${skippedCount}`)
  if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)
  console.log(`\n✅ Import complete!`)
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
