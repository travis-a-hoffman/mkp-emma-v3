#!/usr/bin/env tsx

import { dissolve } from "@turf/dissolve"
import { flatten } from "@turf/flatten"
import { union } from "@turf/union"
import { difference } from "@turf/difference"
import { featureCollection } from "@turf/helpers"
import * as fs from "node:fs/promises"
import * as fsSync from "node:fs"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"
import https from "node:https"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STATES_URL = "https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_5m.json"
const STATES_FILE = "usa_states_5m.geo.json"

const COUNTIES_URL = "https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_050_00_5m.json"
const COUNTIES_FILE = "usa_counties_5m.geo.json"

const ZIPCODES_FILE = "usa_zipcodes_100m.geo.json"

interface AreaData {
  id: string
  name: string
  code: string
  geo_json?: any
  geo_definition?: {
    states: string[]
    counties: string[]
    zipcodes: string[]
  }
  [key: string]: any
}

interface StateFeature {
  type: "Feature"
  properties: {
    STATE: string
    NAME: string
  }
  geometry: any
}

interface CountyFeature {
  type: "Feature"
  properties: {
    STATE: string
    COUNTY: string
    NAME: string
    LSAD: string
  }
  geometry: any
}

interface ZipcodeFeature {
  type: "Feature"
  properties: {
    ZCTA5CE10: string
    STATEFP10: string
  }
  geometry: any
}

async function downloadIfMissing(url: string, filepath: string): Promise<void> {
  try {
    await fs.access(filepath)
    console.log(`  ✓ ${path.basename(filepath)} already exists`)
    return
  } catch {
    // File doesn't exist, download it
  }

  console.log(`  Downloading ${path.basename(filepath)}...`)

  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location
          if (!redirectUrl) {
            reject(new Error("Redirect received but no location header"))
            return
          }
          https
            .get(redirectUrl, (redirectResponse) => {
              if (redirectResponse.statusCode !== 200) {
                reject(new Error(`Download failed with status: ${redirectResponse.statusCode}`))
                return
              }
              const fileStream = fsSync.createWriteStream(filepath)
              redirectResponse.pipe(fileStream)

              fileStream.on("finish", () => {
                fileStream.close()
                console.log(`  ✓ Downloaded ${path.basename(filepath)}`)
                resolve()
              })

              fileStream.on("error", (err) => {
                fs.unlink(filepath).catch(() => {})
                reject(err)
              })
            })
            .on("error", reject)
        } else if (response.statusCode === 200) {
          const fileStream = fsSync.createWriteStream(filepath)
          response.pipe(fileStream)

          fileStream.on("finish", () => {
            fileStream.close()
            console.log(`  ✓ Downloaded ${path.basename(filepath)}`)
            resolve()
          })

          fileStream.on("error", (err) => {
            fs.unlink(filepath).catch(() => {})
            reject(err)
          })
        } else {
          reject(new Error(`Download failed with status: ${response.statusCode}`))
        }
      })
      .on("error", reject)
  })
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
  let hostOverride: string | null = null
  let areaFilter: string | null = null
  let dryRun = false
  let pretty = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--host") {
      if (i + 1 < args.length) {
        hostOverride = args[i + 1]
        i++
      }
    } else if (arg === "--area") {
      if (i + 1 < args.length) {
        areaFilter = args[i + 1].toLowerCase()
        i++
      }
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--pretty") {
      pretty = true
    } else if (!arg.startsWith("--")) {
      envFilePath = arg
    }
  }

  // Load environment variables
  const envPath = path.isAbsolute(envFilePath) ? envFilePath : path.resolve(process.cwd(), envFilePath)
  const result = config({ path: envPath })

  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`)
    process.exit(1)
  }

  const hostname = hostOverride || process.env.HOSTNAME
  if (!hostname) {
    console.error("Error: HOSTNAME must be set in .env file or provided via --host parameter")
    process.exit(1)
  }

  console.log(`Processing areas for hostname: ${hostname}`)
  if (areaFilter) {
    console.log(`Filtering areas: ${areaFilter}`)
  }
  if (dryRun) {
    console.log(`⚠️  DRY RUN MODE: No files will be modified`)
  }
  console.log()

  // Ensure geojson-data directory exists
  const geojsonDir = path.join(__dirname, "geojson-data")
  await fs.mkdir(geojsonDir, { recursive: true })

  // Download GeoJSON files if missing
  console.log("Checking GeoJSON data files...")
  const statesPath = path.join(geojsonDir, STATES_FILE)
  const countiesPath = path.join(geojsonDir, COUNTIES_FILE)
  const zipcodesPath = path.join(geojsonDir, ZIPCODES_FILE)

  await downloadIfMissing(STATES_URL, statesPath)
  await downloadIfMissing(COUNTIES_URL, countiesPath)

  // Check for zipcodes file
  try {
    await fs.access(zipcodesPath)
    console.log(`  ✓ ${ZIPCODES_FILE} already exists`)
  } catch {
    console.error(`  ✗ Error: ${ZIPCODES_FILE} not found. Please run add:zipcode-geojson first.`)
    process.exit(1)
  }

  console.log()

  // Load GeoJSON data and build lookup maps
  console.log("Loading GeoJSON data...")
  const statesData = JSON.parse(await fs.readFile(statesPath, "utf-8"))
  const countiesData = JSON.parse(await fs.readFile(countiesPath, "utf-8"))
  const zipcodesData = JSON.parse(await fs.readFile(zipcodesPath, "utf-8"))

  // Build state name and STATE code → abbreviation maps
  const statesByName = new Map<string, StateFeature>()
  const stateCodeToAbbrev = new Map<string, string>()

  // US state abbreviations lookup
  const stateNameToAbbrev: Record<string, string> = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
    colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
    hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
    kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
    massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
    montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
    vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
    wisconsin: "WI", wyoming: "WY"
  }

  statesData.features.forEach((f: StateFeature) => {
    const nameLower = f.properties.NAME.toLowerCase()
    statesByName.set(nameLower, f)

    // Map STATE code to abbreviation
    const abbrev = stateNameToAbbrev[nameLower]
    if (abbrev) {
      stateCodeToAbbrev.set(f.properties.STATE, abbrev)
    }
  })

  // Build county lookup using state abbreviations
  // Use array to store multiple counties with same name but different LSAD (e.g., "St. Louis" has County and city)
  const countiesByName = new Map<string, CountyFeature[]>()
  countiesData.features.forEach((f: CountyFeature) => {
    const stateAbbrev = stateCodeToAbbrev.get(f.properties.STATE) || f.properties.STATE
    const key = `${f.properties.NAME}, ${stateAbbrev}`.toLowerCase()

    if (!countiesByName.has(key)) {
      countiesByName.set(key, [])
    }
    countiesByName.get(key)!.push(f)
  })

  const zipcodesByCode = new Map<string, ZipcodeFeature>()
  zipcodesData.features.forEach((f: ZipcodeFeature) => {
    zipcodesByCode.set(f.properties.ZCTA5CE10, f)
  })

  console.log(`  ✓ Loaded ${statesByName.size} states`)
  console.log(`  ✓ Loaded ${countiesByName.size} counties`)
  console.log(`  ✓ Loaded ${zipcodesByCode.size} zipcodes\n`)

  // Load area files
  const areasDir = path.join(__dirname, "data", hostname, "areas")
  const files = await fs.readdir(areasDir)
  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  const areas: Array<{ filename: string; filepath: string; data: AreaData }> = []

  for (const filename of jsonFiles) {
    const filepath = path.join(areasDir, filename)
    const content = await fs.readFile(filepath, "utf-8")
    const data: AreaData = JSON.parse(content)

    if (areaFilter && !data.name.toLowerCase().includes(areaFilter)) {
      continue
    }

    // Only process areas with geo_definition
    if (data.geo_definition) {
      areas.push({ filename, filepath, data })
    }
  }

  if (areas.length === 0) {
    console.log(areaFilter ? `No areas found matching: ${areaFilter}` : "No areas with geo_definition found")
    return
  }

  console.log(`Found ${areas.length} area(s) with geo_definition\n`)

  let processedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const { filename, filepath, data } of areas) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`Area: ${data.name} (${data.code || "no code"})`)
    console.log(`${"=".repeat(60)}`)

    processedCount++

    const geoDef = data.geo_definition!

    // Collect all geometries to include
    const geometriesToInclude: any[] = []
    const geometriesToExclude: any[] = []

    // Process states
    for (const stateEntry of geoDef.states) {
      const op = stateEntry[0]
      const stateName = stateEntry.slice(1).trim().toLowerCase()

      const stateFeature = statesByName.get(stateName)
      if (!stateFeature) {
        console.warn(`  ⚠ Warning: State not found: ${stateName}`)
        continue
      }

      if (op === "+") {
        geometriesToInclude.push(stateFeature.geometry)
        console.log(`  + Added state: ${stateFeature.properties.NAME}`)
      } else if (op === "-") {
        geometriesToExclude.push(stateFeature.geometry)
        console.log(`  - Excluded state: ${stateFeature.properties.NAME}`)
      }
    }

    // Process counties
    for (const countyEntry of geoDef.counties) {
      const op = countyEntry[0]
      const countyInput = countyEntry.slice(1).trim()

      // Parse optional LSAD qualifier: "Name (LSAD), ST" or "Name, ST"
      const lsadMatch = countyInput.match(/^(.+?)\s*\(([^)]+)\)\s*,\s*(.+)$/)
      let countyName: string
      let lsadQualifier: string | null = null

      if (lsadMatch) {
        // Format: "Name (LSAD), ST"
        countyName = `${lsadMatch[1].trim()}, ${lsadMatch[3].trim()}`
        lsadQualifier = lsadMatch[2].trim()
      } else {
        // Format: "Name, ST"
        countyName = countyInput
      }

      const matchingCounties = countiesByName.get(countyName.toLowerCase())
      if (!matchingCounties || matchingCounties.length === 0) {
        console.warn(`  ⚠ Warning: County not found: ${countyName}`)
        continue
      }

      // If LSAD qualifier provided, filter by it
      let countyFeature: CountyFeature | null = null
      if (lsadQualifier) {
        const filtered = matchingCounties.filter(
          (c) => c.properties.LSAD.toLowerCase() === lsadQualifier.toLowerCase()
        )
        if (filtered.length === 0) {
          console.warn(`  ⚠ Warning: County "${countyName}" with LSAD "${lsadQualifier}" not found`)
          console.warn(`  Available LSAD values: ${matchingCounties.map((c) => c.properties.LSAD).join(", ")}`)
          continue
        }
        countyFeature = filtered[0]
      } else {
        // No LSAD qualifier - use first match (should only be one if properly defined)
        if (matchingCounties.length > 1) {
          console.warn(`  ⚠ Warning: Multiple entries for "${countyName}", using ${matchingCounties[0].properties.LSAD}`)
          console.warn(`  Available: ${matchingCounties.map((c) => c.properties.LSAD).join(", ")}`)
        }
        countyFeature = matchingCounties[0]
      }

      if (op === "+") {
        geometriesToInclude.push(countyFeature.geometry)
        console.log(`  + Added county: ${countyInput}`)
      } else if (op === "-") {
        geometriesToExclude.push(countyFeature.geometry)
        console.log(`  - Excluded county: ${countyInput}`)
      }
    }

    // Process zipcodes
    for (const zipcodeEntry of geoDef.zipcodes) {
      const op = zipcodeEntry[0]
      const zipcode = zipcodeEntry.slice(1).trim()

      const zipcodeFeature = zipcodesByCode.get(zipcode)
      if (!zipcodeFeature) {
        console.warn(`  ⚠ Warning: Zipcode not found: ${zipcode}`)
        continue
      }

      if (op === "+") {
        geometriesToInclude.push(zipcodeFeature.geometry)
        console.log(`  + Added zipcode: ${zipcode}`)
      } else if (op === "-") {
        geometriesToExclude.push(zipcodeFeature.geometry)
        console.log(`  - Excluded zipcode: ${zipcode}`)
      }
    }

    if (geometriesToInclude.length === 0) {
      console.warn(`  ⚠ Warning: No geometries to include, skipping`)
      skippedCount++
      continue
    }

    console.log(`\n  Processing ${geometriesToInclude.length} geometries...`)

    // Dissolve geometries using two-stage approach
    let geoJson: any = null

    try {
      // Stage 1: Union each geometry's MultiPolygon into a single geometry
      console.log(`  Stage 1: Unifying individual geometries...`)
      const unifiedGeometries = geometriesToInclude.map((geom, idx) => {
        if (geom.type === "MultiPolygon") {
          // Flatten MultiPolygon into individual Polygons
          const flattened = flatten({
            type: "Feature" as const,
            geometry: geom,
            properties: {},
          })

          // Union all polygons within this geometry together
          let result = flattened.features[0].geometry
          for (let i = 1; i < flattened.features.length; i++) {
            try {
              const fc = featureCollection([
                { type: "Feature" as const, geometry: result, properties: {} },
                { type: "Feature" as const, geometry: flattened.features[i].geometry, properties: {} },
              ])
              const unioned = union(fc)
              if (unioned) {
                result = unioned.geometry
              }
            } catch (unionError: any) {
              console.warn(`    ⚠ Warning: Failed to union polygon ${i} in geometry ${idx}: ${unionError.message}`)
            }
          }
          return result
        }
        return geom
      })

      // Stage 1.5: Flatten any remaining MultiPolygons into individual Polygons
      console.log(`  Stage 1.5: Flattening any MultiPolygons into Polygons...`)
      const flattenedFeatures: any[] = []

      for (const geom of unifiedGeometries) {
        if (geom.type === "MultiPolygon") {
          const flattened = flatten({
            type: "Feature" as const,
            geometry: geom,
            properties: { area: data.name },
          })
          flattenedFeatures.push(...flattened.features)
        } else {
          flattenedFeatures.push({
            type: "Feature" as const,
            geometry: geom,
            properties: { area: data.name },
          })
        }
      }

      console.log(`  Stage 2: Dissolving ${flattenedFeatures.length} polygons into area boundary...`)

      // Stage 2: Dissolve all polygon features together
      // Note: Don't use propertyName - we want to dissolve ALL features together
      // Without propertyName, dissolve returns a MultiPolygon for disjoint regions (e.g., Hawaii islands)
      const fc = featureCollection(flattenedFeatures)
      const dissolved = dissolve(fc)

      if (dissolved && dissolved.features.length > 0) {
        // Dissolve without propertyName returns a flattened FeatureCollection
        // For disjoint regions (Hawaii islands, Michigan peninsulas), it returns MULTIPLE Polygon features
        // We need to combine them into a single MultiPolygon
        let mergedGeometry: any

        if (dissolved.features.length === 1) {
          // Single connected polygon or already a MultiPolygon
          mergedGeometry = dissolved.features[0].geometry
        } else {
          // Multiple disjoint polygons - combine into MultiPolygon
          console.log(`  ⚠ Note: Result contains ${dissolved.features.length} disjoint polygon(s)`)

          const allCoordinates: any[] = []
          for (const feature of dissolved.features) {
            if (feature.geometry.type === "Polygon") {
              // Add Polygon coordinates as a single array
              allCoordinates.push(feature.geometry.coordinates)
            } else if (feature.geometry.type === "MultiPolygon") {
              // Add all MultiPolygon coordinates
              allCoordinates.push(...feature.geometry.coordinates)
            }
          }

          mergedGeometry = {
            type: "MultiPolygon",
            coordinates: allCoordinates,
          }
        }

        // Stage 3: Subtract excluded geometries (if any)
        if (geometriesToExclude.length > 0) {
          console.log(`\n  Stage 3: Subtracting ${geometriesToExclude.length} excluded geometries...`)

          // Process excluded geometries the same way as included
          const unifiedExcludedGeometries = geometriesToExclude.map((geom, idx) => {
            if (geom.type === "MultiPolygon") {
              const flattened = flatten({
                type: "Feature" as const,
                geometry: geom,
                properties: {},
              })
              let result = flattened.features[0].geometry
              for (let i = 1; i < flattened.features.length; i++) {
                try {
                  const fc = featureCollection([
                    { type: "Feature" as const, geometry: result, properties: {} },
                    { type: "Feature" as const, geometry: flattened.features[i].geometry, properties: {} },
                  ])
                  const unioned = union(fc)
                  if (unioned) {
                    result = unioned.geometry
                  }
                } catch (unionError: any) {
                  console.warn(`    ⚠ Warning: Failed to union excluded polygon ${i} in geometry ${idx}: ${unionError.message}`)
                }
              }
              return result
            }
            return geom
          })

          // Flatten excluded geometries
          const flattenedExcludedFeatures: any[] = []
          for (const geom of unifiedExcludedGeometries) {
            if (geom.type === "MultiPolygon") {
              const flattened = flatten({
                type: "Feature" as const,
                geometry: geom,
                properties: { excluded: true },
              })
              flattenedExcludedFeatures.push(...flattened.features)
            } else {
              flattenedExcludedFeatures.push({
                type: "Feature" as const,
                geometry: geom,
                properties: { excluded: true },
              })
            }
          }

          // Dissolve all excluded geometries together
          // Note: Don't use propertyName - we want to dissolve ALL excluded features together
          const excludedFc = featureCollection(flattenedExcludedFeatures)
          const dissolvedExcluded = dissolve(excludedFc)

          if (dissolvedExcluded && dissolvedExcluded.features.length > 0) {
            // Subtract each excluded feature from the result
            for (const excludedFeature of dissolvedExcluded.features) {
              try {
                const includedFeature = {
                  type: "Feature" as const,
                  geometry: mergedGeometry,
                  properties: {},
                }

                // @turf/difference expects a FeatureCollection with [included, excluded] features
                const diffFc = featureCollection([includedFeature, excludedFeature])
                const diffResult = difference(diffFc)

                if (diffResult) {
                  mergedGeometry = diffResult.geometry
                  console.log(`    ✓ Subtracted excluded geometry`)
                } else {
                  console.warn(`    ⚠ Warning: Difference returned null (excluded area may not overlap)`)
                }
              } catch (diffError: any) {
                console.warn(`    ⚠ Warning: Failed to subtract excluded geometry: ${diffError.message}`)
              }
            }
          }
        }

        geoJson = wrapInFeatureCollection(mergedGeometry)

        // Report polygon count
        const polyCount =
          mergedGeometry.type === "MultiPolygon" ? mergedGeometry.coordinates.length : 1
        console.log(`  ✓ Created boundary with ${polyCount} polygon(s)`)
      } else {
        console.warn(`  ⚠ Warning: Dissolve returned no features`)
        geoJson = null
      }
    } catch (error: any) {
      console.error(`  ✗ Error dissolving polygons: ${error.message}`)
      errorCount++
      continue
    }

    // Update the area data
    data.geo_json = geoJson

    if (dryRun) {
      console.log(`  [DRY RUN] Would update: ${filename}`)
      updatedCount++
    } else {
      try {
        const jsonContent = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
        await fs.writeFile(filepath, jsonContent, "utf-8")
        console.log(`  ✓ Updated: ${filename}`)
        updatedCount++
      } catch (error: any) {
        console.error(`  ✗ Error writing ${filename}: ${error.message}`)
        errorCount++
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`)
  console.log(`📊 Summary:`)
  console.log(`  Total areas processed: ${processedCount}`)
  console.log(`  ✓ Updated: ${updatedCount}`)
  console.log(`  ⊘ Skipped: ${skippedCount}`)
  if (errorCount > 0) console.log(`  ✗ Errors: ${errorCount}`)

  if (dryRun) {
    console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to update files.`)
  } else {
    console.log(`\n✅ Area GeoJSON generation complete!`)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
