#!/usr/bin/env tsx

import { find as findZipcode } from "zipcodes-us"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ExportedZipcode {
  zipcode: string
  county: string | null
  st: string | null
  area: string | null
  community: string | null
  latitude: number | null
  longitude: number | null
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let dryRun = false
  let hostOverride: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--dry-run") {
      dryRun = true
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

  // Determine the hostname (use override if provided, otherwise use env vars)
  const hostname =
    hostOverride ||
    process.env.MKPCONNECT_DB_HOST ||
    process.env.MKPCONNECT_DRUPAL_DB_HOST ||
    process.env.HOSTNAME
  if (!hostname) {
    console.error(
      "Error: HOSTNAME, MKPCONNECT_DB_HOST, or --host parameter must be provided to determine data directory"
    )
    process.exit(1)
  }

  console.log(`Using hostname: ${hostname}`)
  if (dryRun) {
    console.log(`⚠️  DRY RUN MODE: No files will be modified\n`)
  }

  // Read all JSON files from data/{hostname}/mkp-area-zipcodes directory
  const inputDir = path.join(__dirname, "data", hostname, "mkp-area-zipcodes")

  console.log(`Reading zipcode files from: ${inputDir}`)

  let files: string[]
  try {
    files = await fs.readdir(inputDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported zipcodes first using: pnpm export:mkp-area-zipcodes`)
    console.error(`Expected directory: ${inputDir}`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${inputDir}`)
    return
  }

  console.log(`Found ${jsonFiles.length} zipcode files\n`)

  let processedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  let errorCount = 0

  for (const filename of jsonFiles) {
    const filepath = path.join(inputDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let zipcodeData: ExportedZipcode
    try {
      zipcodeData = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      errorCount++
      continue
    }

    processedCount++

    // Skip if county already exists
    if (zipcodeData.county !== null && zipcodeData.county !== "") {
      console.log(`  ⊘ Skipped: ${filename} - county already set: ${zipcodeData.county}`)
      skippedCount++
      continue
    }

    // Lookup county using zipcodes-us package
    const zipInfo = findZipcode(zipcodeData.zipcode)

    if (!zipInfo || !zipInfo.isValid) {
      console.warn(`  ⚠ Not Found: ${filename} - no county data available for zipcode ${zipcodeData.zipcode}`)
      notFoundCount++
      continue
    }

    // Update the county field
    const updatedData: ExportedZipcode = {
      ...zipcodeData,
      county: zipInfo.county,
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would update: ${filename} - county: ${zipInfo.county}`)
      updatedCount++
    } else {
      // Write the updated data back to the file
      const jsonContent = JSON.stringify(updatedData)
      await fs.writeFile(filepath, jsonContent, "utf-8")

      console.log(`  ✓ Updated: ${filename} - county: ${zipInfo.county}`)
      updatedCount++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`  Total files processed: ${processedCount}`)
  console.log(`  ✓ Updated: ${updatedCount}`)
  console.log(`  ⊘ Skipped (already has county): ${skippedCount}`)
  console.log(`  ⚠ Not found in database: ${notFoundCount}`)
  if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)

  if (dryRun) {
    console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to actually update files.`)
  } else {
    console.log(`\n✅ County fill complete!`)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
