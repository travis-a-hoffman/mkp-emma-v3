#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ExportedAddress {
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

  // Query all addresses
  console.log("Fetching addresses from database...")

  const { data: addresses, error } = await supabase.from("addresses").select("*").order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching addresses:", error)
    process.exit(1)
  }

  if (!addresses || addresses.length === 0) {
    console.log("No addresses found in database")
    return
  }

  console.log(`Found ${addresses.length} addresses`)

  // Ensure output directory exists (with hostname-based path)
  const outputDir = path.join(__dirname, "data", outputHostname, "addresses")
  await fs.mkdir(outputDir, { recursive: true })

  // Export each address as a separate JSON file
  let exportedCount = 0

  for (const address of addresses) {
    const exportData: ExportedAddress = {
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
    }

    // Use a sanitized identifier for filename (addresses don't have a code field)
    const sanitizedCity = address.city.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 20)
    const sanitizedState = address.state.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 10)
    const sanitizedPostal = address.postal_code.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 10)
    const filename = `${sanitizedCity}_${sanitizedState}_${sanitizedPostal}_${address.id.substring(0, 8)}.json`
    const filepath = path.join(outputDir, filename)

    const jsonContent = pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)

    await fs.writeFile(filepath, jsonContent, "utf-8")

    console.log(`  ✓ Exported: ${filename}`)
    exportedCount++
  }

  console.log(`\n✅ Successfully exported ${exportedCount} addresses to ${outputDir}`)
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
