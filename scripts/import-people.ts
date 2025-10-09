#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ImportedPerson {
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
  let force = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--force") {
      force = true
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
  console.log(`Force mode: ${force ? "enabled (will update existing people)" : "disabled (will skip duplicates)"}`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Read all JSON files from data/people directory
  const inputDir = path.join(__dirname, "data", "people")

  console.log(`Reading people files from: ${inputDir}`)

  let files: string[]
  try {
    files = await fs.readdir(inputDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported people first using: tsx scripts/export-people.ts`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log("No JSON files found in data/people directory")
    return
  }

  console.log(`Found ${jsonFiles.length} people files to import\n`)

  let importedCount = 0
  let skippedCount = 0
  let updatedCount = 0
  let errorCount = 0

  for (const filename of jsonFiles) {
    const filepath = path.join(inputDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let person: ImportedPerson
    try {
      person = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      errorCount++
      continue
    }

    // Validate foreign key references if they exist
    if (person.billing_address_id) {
      const { data: address } = await supabase
        .from("addresses")
        .select("id")
        .eq("id", person.billing_address_id)
        .single()

      if (!address) {
        console.error(
          `  ✗ ${filename}: Billing address with id ${person.billing_address_id} not found in addresses table`
        )
        errorCount++
        continue
      }
    }

    if (person.mailing_address_id) {
      const { data: address } = await supabase
        .from("addresses")
        .select("id")
        .eq("id", person.mailing_address_id)
        .single()

      if (!address) {
        console.error(
          `  ✗ ${filename}: Mailing address with id ${person.mailing_address_id} not found in addresses table`
        )
        errorCount++
        continue
      }
    }

    if (person.physical_address_id) {
      const { data: address } = await supabase
        .from("addresses")
        .select("id")
        .eq("id", person.physical_address_id)
        .single()

      if (!address) {
        console.error(
          `  ✗ ${filename}: Physical address with id ${person.physical_address_id} not found in addresses table`
        )
        errorCount++
        continue
      }
    }

    // Check if person already exists (by id)
    const { data: existingPerson } = await supabase.from("people").select("id").eq("id", person.id).single()

    if (existingPerson && !force) {
      console.log(
        `  ⊘ Skipped: ${filename} (${person.first_name} ${person.last_name}) - already exists (use --force to update)`
      )
      skippedCount++
      continue
    }

    if (existingPerson && force) {
      // Update existing person
      const { error: updateError } = await supabase
        .from("people")
        .update({
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
          deleted_at: person.deleted_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", person.id)

      if (updateError) {
        console.error(`  ✗ Error updating ${filename}: ${updateError.message}`)
        errorCount++
        continue
      }

      console.log(`  ↻ Updated: ${filename} (${person.first_name} ${person.last_name})`)
      updatedCount++
    } else {
      // Insert new person
      const { error: insertError } = await supabase.from("people").insert({
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
      })

      if (insertError) {
        console.error(`  ✗ Error inserting ${filename}: ${insertError.message}`)
        errorCount++
        continue
      }

      console.log(`  ✓ Imported: ${filename} (${person.first_name} ${person.last_name})`)
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
