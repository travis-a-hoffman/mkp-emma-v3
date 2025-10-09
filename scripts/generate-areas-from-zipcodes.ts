#!/usr/bin/env tsx

import { union } from "@turf/union"
import { polygon, featureCollection } from "@turf/helpers"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ZipcodeData {
  zipcode: string
  county: string | null
  st: string | null
  area: string | null
  community: string | null
  latitude: number | null
  longitude: number | null
  geo_polygon?: any
}

interface ExportedArea {
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
  geo_polygon: any | null

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

function sanitizeCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function wrapInFeatureCollection(geometry: any): any {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: geometry,
        properties: {},
      },
    ],
  }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let dryRun = false
  let pretty = false
  let sourceHost: string | null = null
  let targetHost: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--source-host") {
      if (i + 1 < args.length) {
        sourceHost = args[i + 1]
        i++
      } else {
        console.error("Error: --source-host flag requires a hostname argument")
        process.exit(1)
      }
    } else if (arg === "--target-host") {
      if (i + 1 < args.length) {
        targetHost = args[i + 1]
        i++
      } else {
        console.error("Error: --target-host flag requires a hostname argument")
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

  // Determine source and target hostnames
  const source = sourceHost || process.env.MKPCONNECT_DB_HOST || "mkpconnect.org"
  const target = targetHost || process.env.HOSTNAME || "mkp-emma-v3.vercel.app"

  console.log(`Source data from: ${source}`)
  console.log(`Target output to: ${target}`)
  if (dryRun) {
    console.log(`⚠️  DRY RUN MODE: No files will be written\n`)
  }

  // Read all zipcode JSON files from source
  const sourceDir = path.join(__dirname, "data", source, "mkp-community-zipcodes")

  console.log(`Reading zipcode files from: ${sourceDir}`)

  let files: string[]
  try {
    files = await fs.readdir(sourceDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    console.error(`Make sure you have exported zipcodes first`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${sourceDir}`)
    process.exit(1)
  }

  console.log(`Found ${jsonFiles.length} zipcode files`)

  // Load all zipcode data and group by area
  const areaMap = new Map<string, ZipcodeData[]>()

  for (const filename of jsonFiles) {
    const filepath = path.join(sourceDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let zipcodeData: ZipcodeData
    try {
      zipcodeData = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      continue
    }

    if (!zipcodeData.area) {
      console.warn(`  ⚠ Skipping ${filename}: no area specified`)
      continue
    }

    if (!areaMap.has(zipcodeData.area)) {
      areaMap.set(zipcodeData.area, [])
    }

    areaMap.get(zipcodeData.area)!.push(zipcodeData)
  }

  console.log(`\nFound ${areaMap.size} unique areas`)

  // Ensure output directory exists
  const outputDir = path.join(__dirname, "data", target, "areas")
  if (!dryRun) {
    await fs.mkdir(outputDir, { recursive: true })
  }

  let createdCount = 0
  let errorCount = 0

  // Generate an Area JSON for each unique area
  for (const [areaName, zipcodes] of areaMap.entries()) {
    console.log(`\nProcessing: ${areaName} (${zipcodes.length} zipcodes)`)

    // Create geo_polygon by unioning all zipcode polygons
    let geoPolygon: any = null

    const zipcodesWithGeometry = zipcodes.filter((z) => z.geo_polygon)

    if (zipcodesWithGeometry.length > 0) {
      try {
        console.log(`  Merging ${zipcodesWithGeometry.length} polygons...`)

        // Start with the first polygon
        let result = zipcodesWithGeometry[0].geo_polygon

        // Union with each subsequent polygon
        for (let i = 1; i < zipcodesWithGeometry.length; i++) {
          const nextGeometry = zipcodesWithGeometry[i].geo_polygon

          try {
            // Create features for union
            const feature1 = {
              type: "Feature" as const,
              geometry: result,
              properties: {},
            }
            const feature2 = {
              type: "Feature" as const,
              geometry: nextGeometry,
              properties: {},
            }

            const fc = featureCollection([feature1, feature2])
            const unionResult = union(fc)

            if (unionResult) {
              result = unionResult.geometry
            }
          } catch (unionError: any) {
            console.warn(`  ⚠ Warning: Failed to union polygon ${i}: ${unionError.message}`)
            // Continue with current result
          }
        }

        geoPolygon = wrapInFeatureCollection(result)
        console.log(`  ✓ Successfully created merged polygon`)
      } catch (error: any) {
        console.error(`  ✗ Error creating polygon union: ${error.message}`)
        geoPolygon = null
      }
    } else {
      console.warn(`  ⚠ No zipcodes with geo_polygon data`)
    }

    // Generate the Area object
    const now = new Date().toISOString()
    const areaCode = sanitizeCode(areaName)

    const areaData: ExportedArea = {
      id: randomUUID(),
      name: areaName,
      code: areaCode,
      description: null,
      color: null,
      is_active: true,
      image_url: null,
      steward_id: null,
      finance_coordinator_id: null,
      geo_polygon: geoPolygon,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      area_admins: [],
    }

    const filename = `${areaCode}.json`
    const filepath = path.join(outputDir, filename)

    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${filename}`)
      createdCount++
    } else {
      try {
        const jsonContent = pretty ? JSON.stringify(areaData, null, 2) : JSON.stringify(areaData)
        await fs.writeFile(filepath, jsonContent, "utf-8")
        console.log(`  ✓ Created: ${filename}`)
        createdCount++
      } catch (error: any) {
        console.error(`  ✗ Error writing ${filename}: ${error.message}`)
        errorCount++
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log(`📊 Summary:`)
  console.log(`  Total areas: ${areaMap.size}`)
  console.log(`  ✓ Created: ${createdCount}`)
  if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)

  if (dryRun) {
    console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to create files.`)
  } else {
    console.log(`\n✅ Area generation complete!`)
    console.log(`Output directory: ${outputDir}`)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
