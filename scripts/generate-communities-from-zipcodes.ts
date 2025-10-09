#!/usr/bin/env tsx

import { union } from "@turf/union"
import { featureCollection } from "@turf/helpers"
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

interface GeneratedArea {
  id: string
  name: string
  code: string
  [key: string]: any
}

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

  // Load generated areas for area_id lookup
  const areasDir = path.join(__dirname, "data", target, "areas")
  console.log(`Loading areas from: ${areasDir}`)

  const areaNameToId = new Map<string, string>()

  try {
    const areaFiles = await fs.readdir(areasDir)
    const areaJsonFiles = areaFiles.filter((f) => f.endsWith(".json"))

    for (const filename of areaJsonFiles) {
      const filepath = path.join(areasDir, filename)
      const content = await fs.readFile(filepath, "utf-8")
      const area: GeneratedArea = JSON.parse(content)
      areaNameToId.set(area.name, area.id)
    }

    console.log(`Loaded ${areaNameToId.size} areas for lookup`)
  } catch (error: any) {
    console.warn(`⚠️  Warning: Could not load areas: ${error.message}`)
    console.warn(`Communities will be created with area_id = null`)
    console.warn(`Run 'pnpm generate:areas' first to create areas with proper references\n`)
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

  // Load all zipcode data and group by community
  const communityMap = new Map<string, ZipcodeData[]>()

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

    if (!zipcodeData.community) {
      console.warn(`  ⚠ Skipping ${filename}: no community specified`)
      continue
    }

    if (!communityMap.has(zipcodeData.community)) {
      communityMap.set(zipcodeData.community, [])
    }

    communityMap.get(zipcodeData.community)!.push(zipcodeData)
  }

  console.log(`\nFound ${communityMap.size} unique communities`)

  // Ensure output directory exists
  const outputDir = path.join(__dirname, "data", target, "communities")
  if (!dryRun) {
    await fs.mkdir(outputDir, { recursive: true })
  }

  let createdCount = 0
  let errorCount = 0

  // Generate a Community JSON for each unique community
  for (const [communityName, zipcodes] of communityMap.entries()) {
    console.log(`\nProcessing: ${communityName} (${zipcodes.length} zipcodes)`)

    // Get area_id from the first zipcode's area
    let areaId: string | null = null
    const areaName = zipcodes[0].area

    if (areaName && areaNameToId.has(areaName)) {
      areaId = areaNameToId.get(areaName)!
      console.log(`  Area: ${areaName} (${areaId})`)
    } else if (areaName) {
      console.warn(`  ⚠ Warning: Area '${areaName}' not found in generated areas`)
    }

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

    // Generate the Community object
    const now = new Date().toISOString()
    const communityCode = sanitizeCode(communityName)

    const communityData: ExportedCommunity = {
      id: randomUUID(),
      name: communityName,
      code: communityCode,
      description: null,
      image_url: null,
      color: null,
      is_active: true,
      area_id: areaId,
      coordinator_id: null,
      geo_polygon: geoPolygon,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const filename = `${communityCode}.json`
    const filepath = path.join(outputDir, filename)

    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${filename}`)
      createdCount++
    } else {
      try {
        const jsonContent = pretty ? JSON.stringify(communityData, null, 2) : JSON.stringify(communityData)
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
  console.log(`  Total communities: ${communityMap.size}`)
  console.log(`  ✓ Created: ${createdCount}`)
  if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)

  if (dryRun) {
    console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to create files.`)
  } else {
    console.log(`\n✅ Community generation complete!`)
    console.log(`Output directory: ${outputDir}`)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
