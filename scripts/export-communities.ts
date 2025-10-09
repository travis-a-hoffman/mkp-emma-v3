#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ExportedCommunity {
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
  geo_polygon: any | null

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

  // Query all communities
  console.log("Fetching communities from database...")

  const { data: communities, error } = await supabase
    .from("communities")
    .select("*")
    .order("code", { ascending: true })

  if (error) {
    console.error("Error fetching communities:", error)
    process.exit(1)
  }

  if (!communities || communities.length === 0) {
    console.log("No communities found in database")
    return
  }

  console.log(`Found ${communities.length} communities`)

  // Ensure output directory exists (with hostname-based path)
  const outputDir = path.join(__dirname, "data", outputHostname, "communities")
  await fs.mkdir(outputDir, { recursive: true })

  // Export each community as a separate JSON file
  let exportedCount = 0

  for (const community of communities) {
    const exportData: ExportedCommunity = {
      id: community.id,
      name: community.name,
      code: community.code,
      description: community.description,
      image_url: community.image_url,
      color: community.color,
      is_active: community.is_active,
      area_id: community.area_id,
      coordinator_id: community.coordinator_id,
      geo_polygon: community.geo_polygon,
      created_at: community.created_at,
      updated_at: community.updated_at,
      deleted_at: community.deleted_at,
    }

    const filename = `${community.code}.json`
    const filepath = path.join(outputDir, filename)

    const jsonContent = pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)

    await fs.writeFile(filepath, jsonContent, "utf-8")

    console.log(`  ✓ Exported: ${filename} (${community.name})`)
    exportedCount++
  }

  console.log(`\n✅ Successfully exported ${exportedCount} communities to ${outputDir}`)
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
