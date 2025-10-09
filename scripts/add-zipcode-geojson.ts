#!/usr/bin/env tsx

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
  geo_polygon?: any
}

interface GeoJSONFeature {
  type: "Feature"
  geometry: {
    type: string
    coordinates: any
  }
  properties: {
    ZCTA5CE10: string
    [key: string]: any
  }
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection"
  features: GeoJSONFeature[]
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let dryRun = false
  let hostOverride: string | null = null
  let processAreas = false
  let processCommunities = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--areas") {
      processAreas = true
    } else if (arg === "--communities") {
      processCommunities = true
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

  // If neither --areas nor --communities specified, process both
  if (!processAreas && !processCommunities) {
    processAreas = true
    processCommunities = true
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
  console.log(`Processing: ${processAreas ? "areas" : ""}${processAreas && processCommunities ? " & " : ""}${processCommunities ? "communities" : ""}`)
  if (dryRun) {
    console.log(`⚠️  DRY RUN MODE: No files will be modified\n`)
  }

  // Load GeoJSON data
  const geojsonPath = path.join(__dirname, "geojson-data", "usa_zip_codes_geo_100m.json")
  console.log(`Loading GeoJSON data from: ${geojsonPath}`)

  let geojsonData: GeoJSONFeatureCollection
  try {
    const geojsonContent = await fs.readFile(geojsonPath, "utf-8")
    geojsonData = JSON.parse(geojsonContent)
  } catch (error: any) {
    console.error(`Error loading GeoJSON file: ${error.message}`)
    console.error(
      `Please ensure the GeoJSON data exists at: ${geojsonPath}`
    )
    console.error(
      `You can download it from: https://raw.githubusercontent.com/ndrezn/zip-code-geojson/main/usa_zip_codes_geo_100m.json`
    )
    process.exit(1)
  }

  // Build a zipcode -> geometry lookup map
  console.log(`Building zipcode -> geometry lookup map from ${geojsonData.features.length} features...`)
  const zipcodeToGeometry = new Map<string, any>()

  for (const feature of geojsonData.features) {
    const zipcode = feature.properties.ZCTA5CE10
    zipcodeToGeometry.set(zipcode, feature.geometry)
  }

  console.log(`Lookup map built with ${zipcodeToGeometry.size} zipcodes\n`)

  // Process each dataset
  const datasets = []
  if (processAreas) {
    datasets.push({ name: "mkp-area-zipcodes", label: "Areas" })
  }
  if (processCommunities) {
    datasets.push({ name: "mkp-community-zipcodes", label: "Communities" })
  }

  for (const dataset of datasets) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`Processing ${dataset.label}`)
    console.log("=".repeat(60))

    const inputDir = path.join(__dirname, "data", hostname, dataset.name)

    console.log(`Reading zipcode files from: ${inputDir}`)

    let files: string[]
    try {
      files = await fs.readdir(inputDir)
    } catch (error: any) {
      console.error(`Error reading directory: ${error.message}`)
      console.error(`Skipping ${dataset.label} - directory not found`)
      continue
    }

    const jsonFiles = files.filter((f) => f.endsWith(".json"))

    if (jsonFiles.length === 0) {
      console.log(`No JSON files found in ${inputDir}`)
      continue
    }

    console.log(`Found ${jsonFiles.length} zipcode files`)

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

      // Skip if geo_polygon already exists
      if (zipcodeData.geo_polygon !== undefined && zipcodeData.geo_polygon !== null) {
        console.log(`  ⊘ Skipped: ${filename} - geo_polygon already set`)
        skippedCount++
        continue
      }

      // Lookup geometry
      const geometry = zipcodeToGeometry.get(zipcodeData.zipcode)

      if (!geometry) {
        console.warn(`  ⚠ Not Found: ${filename} - no GeoJSON geometry for zipcode ${zipcodeData.zipcode}`)
        notFoundCount++
        continue
      }

      // Update the geo_polygon field
      const updatedData: ExportedZipcode = {
        ...zipcodeData,
        geo_polygon: geometry,
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would update: ${filename} - added geo_polygon`)
        updatedCount++
      } else {
        // Write the updated data back to the file
        const jsonContent = JSON.stringify(updatedData)
        await fs.writeFile(filepath, jsonContent, "utf-8")

        console.log(`  ✓ Updated: ${filename} - added geo_polygon`)
        updatedCount++
      }
    }

    console.log(`\n📊 ${dataset.label} Summary:`)
    console.log(`  Total files processed: ${processedCount}`)
    console.log(`  ✓ Updated: ${updatedCount}`)
    console.log(`  ⊘ Skipped (already has geo_polygon): ${skippedCount}`)
    console.log(`  ⚠ Not found in GeoJSON data: ${notFoundCount}`)
    if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)
  }

  console.log(`\n${"=".repeat(60)}`)
  if (dryRun) {
    console.log(`⚠️  This was a DRY RUN. Run without --dry-run to actually update files.`)
  } else {
    console.log(`✅ GeoJSON enhancement complete!`)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
