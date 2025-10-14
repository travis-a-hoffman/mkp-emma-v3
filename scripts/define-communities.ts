#!/usr/bin/env tsx

import * as fs from "node:fs/promises"
import * as fsSync from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"
import https from "node:https"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STATES_URL = "https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_040_00_5m.json"
const STATES_FILE = "usa_states_5m.geo.json"

const COUNTIES_URL = "https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_050_00_5m.json"
const COUNTIES_FILE = "usa_counties_5m.geo.json"

const ZIPCODES_OLD_FILE = "usa_zip_codes_geo_100m.json"
const ZIPCODES_FILE = "usa_zipcodes_100m.geo.json"

interface CommunityData {
  id: string
  name: string
  code: string
  area_id?: string | null
  geo_definition?: {
    states: string[]
    counties: string[]
    zipcodes: string[]
  }
  [key: string]: any
}

interface StateFeature {
  properties: {
    STATE: string
    NAME: string
  }
}

interface CountyFeature {
  properties: {
    STATE: string
    COUNTY: string
    NAME: string
    LSAD: string
  }
}

interface ZipcodeFeature {
  properties: {
    ZCTA5CE10: string
    STATEFP10: string
  }
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

async function promptUser(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let hostOverride: string | null = null
  let communityFilter: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--host") {
      if (i + 1 < args.length) {
        hostOverride = args[i + 1]
        i++
      }
    } else if (arg === "--community") {
      if (i + 1 < args.length) {
        communityFilter = args[i + 1].toLowerCase()
        i++
      }
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

  console.log(`Processing communities for hostname: ${hostname}\n`)

  // Ensure geojson-data directory exists
  const geojsonDir = path.join(__dirname, "geojson-data")
  await fs.mkdir(geojsonDir, { recursive: true })

  // Download GeoJSON files if missing
  console.log("Checking GeoJSON data files...")
  const statesPath = path.join(geojsonDir, STATES_FILE)
  const countiesPath = path.join(geojsonDir, COUNTIES_FILE)
  const zipcodesPath = path.join(geojsonDir, ZIPCODES_FILE)
  const zipcodesOldPath = path.join(geojsonDir, ZIPCODES_OLD_FILE)

  await downloadIfMissing(STATES_URL, statesPath)
  await downloadIfMissing(COUNTIES_URL, countiesPath)

  // Rename old zipcodes file if exists
  try {
    await fs.access(zipcodesOldPath)
    try {
      await fs.access(zipcodesPath)
      console.log(`  ✓ ${ZIPCODES_FILE} already exists`)
    } catch {
      await fs.rename(zipcodesOldPath, zipcodesPath)
      console.log(`  ✓ Renamed ${ZIPCODES_OLD_FILE} → ${ZIPCODES_FILE}`)
    }
  } catch {
    // Old file doesn't exist, check for new file
    try {
      await fs.access(zipcodesPath)
      console.log(`  ✓ ${ZIPCODES_FILE} already exists`)
    } catch {
      console.error(`  ✗ Error: ${ZIPCODES_FILE} not found. Please run add:zipcode-geojson first.`)
      process.exit(1)
    }
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

  // Load community files
  const communitiesDir = path.join(__dirname, "data", hostname, "communities")

  // Check if communities directory exists
  try {
    await fs.access(communitiesDir)
  } catch {
    console.error(`Error: Communities directory not found: ${communitiesDir}`)
    console.error(`Please ensure community JSON files exist in this directory.`)
    process.exit(1)
  }

  const files = await fs.readdir(communitiesDir)
  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  const communities: Array<{ filename: string; filepath: string; data: CommunityData }> = []

  for (const filename of jsonFiles) {
    const filepath = path.join(communitiesDir, filename)
    const content = await fs.readFile(filepath, "utf-8")
    const data: CommunityData = JSON.parse(content)

    if (communityFilter && !data.name.toLowerCase().includes(communityFilter)) {
      continue
    }

    communities.push({ filename, filepath, data })
  }

  if (communities.length === 0) {
    console.log(communityFilter ? `No communities found matching: ${communityFilter}` : "No communities found")
    return
  }

  console.log(`Found ${communities.length} communit${communities.length === 1 ? 'y' : 'ies'}\n`)

  // Optionally load areas for displaying area name
  let areasMap: Map<string, { name: string; code: string }> | null = null
  try {
    const areasDir = path.join(__dirname, "data", hostname, "areas")
    const areaFiles = await fs.readdir(areasDir)
    areasMap = new Map()

    for (const areaFile of areaFiles.filter(f => f.endsWith(".json"))) {
      const areaPath = path.join(areasDir, areaFile)
      const areaData = JSON.parse(await fs.readFile(areaPath, "utf-8"))
      if (areaData.id) {
        areasMap.set(areaData.id, { name: areaData.name, code: areaData.code })
      }
    }
  } catch {
    // Areas directory not found, skip area name display
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  for (const { filename, filepath, data } of communities) {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`Community: ${data.name} (${data.code})`)

    // Display area name if available
    if (data.area_id && areasMap) {
      const area = areasMap.get(data.area_id)
      if (area) {
        console.log(`Area: ${area.name} (${area.code})`)
      }
    }

    console.log(`${"=".repeat(60)}`)

    if (data.geo_definition) {
      console.log("\nCurrent geo_definition:")
      console.log(`  States: ${data.geo_definition.states.length > 0 ? data.geo_definition.states.join(", ") : "(none)"}`)
      console.log(`  Counties: ${data.geo_definition.counties.length > 0 ? data.geo_definition.counties.join(", ") : "(none)"}`)
      console.log(`  Zipcodes: ${data.geo_definition.zipcodes.length > 0 ? data.geo_definition.zipcodes.length + " zipcodes" : "(none)"}`)
    } else {
      console.log("\n(No geo_definition set)")
    }

    const modify = await promptUser(rl, "\nModify geo_definition? (y/n): ")
    if (modify.toLowerCase() !== "y") {
      console.log("Skipped.")
      continue
    }

    const definition: { states: string[]; counties: string[]; zipcodes: string[] } = {
      states: data.geo_definition?.states || [],
      counties: data.geo_definition?.counties || [],
      zipcodes: data.geo_definition?.zipcodes || [],
    }

    // States
    console.log("\n--- STATES ---")
    console.log('Enter state names with "+" to add or "-" to subtract')
    console.log('Type "done" when finished, "clear" to reset')
    console.log(`Current: ${definition.states.join(", ") || "(none)"}`)

    while (true) {
      const input = await promptUser(rl, "State: ")

      if (input.toLowerCase() === "done") break
      if (input.toLowerCase() === "clear") {
        definition.states = []
        console.log("  Cleared all states")
        continue
      }

      if (!input.startsWith("+") && !input.startsWith("-")) {
        console.log('  ✗ Must start with "+" or "-"')
        continue
      }

      const op = input[0]
      const stateName = input.slice(1).trim()

      if (!statesByName.has(stateName.toLowerCase())) {
        console.log(`  ✗ Invalid state: ${stateName}`)
        console.log(`  Valid examples: Arizona, New Mexico, Texas`)
        continue
      }

      const entry = `${op}${stateName}`
      definition.states.push(entry)
      console.log(`  ✓ Added: ${entry}`)
    }

    // Counties
    console.log("\n--- COUNTIES ---")
    console.log('Enter counties as "County Name, ST" with "+" to add or "-" to subtract')
    console.log('Optional: Include LSAD qualifier like "County Name (County), ST" or "County Name (city), ST"')
    console.log('Type "done" when finished, "clear" to reset')
    console.log(`Current: ${definition.counties.join(", ") || "(none)"}`)

    while (true) {
      const input = await promptUser(rl, "County: ")

      if (input.toLowerCase() === "done") break
      if (input.toLowerCase() === "clear") {
        definition.counties = []
        console.log("  Cleared all counties")
        continue
      }

      if (!input.startsWith("+") && !input.startsWith("-")) {
        console.log('  ✗ Must start with "+" or "-"')
        continue
      }

      const op = input[0]
      const countyInput = input.slice(1).trim()

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

      const countyKey = countyName.toLowerCase()
      const matchingCounties = countiesByName.get(countyKey)

      if (!matchingCounties || matchingCounties.length === 0) {
        console.log(`  ✗ Invalid county: ${countyName}`)
        console.log(`  Format: "County Name, ST" (e.g., "El Paso, TX")`)
        continue
      }

      // If LSAD qualifier provided, filter by it
      let selectedCounty: CountyFeature | null = null
      if (lsadQualifier) {
        const filtered = matchingCounties.filter(
          (c) => c.properties.LSAD.toLowerCase() === lsadQualifier.toLowerCase()
        )
        if (filtered.length === 0) {
          console.log(`  ✗ No county found with LSAD "${lsadQualifier}"`)
          console.log(`  Available options for "${countyName}":`)
          matchingCounties.forEach((c) => {
            console.log(`    - ${c.properties.NAME} (${c.properties.LSAD})`)
          })
          continue
        }
        selectedCounty = filtered[0]
      } else {
        // No LSAD qualifier provided
        if (matchingCounties.length > 1) {
          console.log(`  ⚠ Multiple entries found for "${countyName}":`)
          matchingCounties.forEach((c) => {
            console.log(`    - ${c.properties.NAME} (${c.properties.LSAD})`)
          })
          console.log(`  Please specify LSAD, e.g., "${op}${countyName.split(",")[0]} (County), ${countyName.split(",")[1]}"`)
          continue
        }
        selectedCounty = matchingCounties[0]
      }

      // Build the entry string with LSAD if not provided by user
      let entry: string
      if (lsadQualifier) {
        entry = `${op}${countyInput}`
      } else {
        // Add LSAD to entry for clarity
        const nameParts = countyName.split(",")
        entry = `${op}${nameParts[0].trim()} (${selectedCounty.properties.LSAD}), ${nameParts[1].trim()}`
      }

      definition.counties.push(entry)
      console.log(`  ✓ Added: ${entry}`)
    }

    // Zipcodes
    console.log("\n--- ZIPCODES ---")
    console.log('Enter 5-digit zipcodes with "+" to add or "-" to subtract')
    console.log('Type "done" when finished, "clear" to reset')
    console.log(`Current: ${definition.zipcodes.length} zipcode(s)`)

    while (true) {
      const input = await promptUser(rl, "Zipcode: ")

      if (input.toLowerCase() === "done") break
      if (input.toLowerCase() === "clear") {
        definition.zipcodes = []
        console.log("  Cleared all zipcodes")
        continue
      }

      if (!input.startsWith("+") && !input.startsWith("-")) {
        console.log('  ✗ Must start with "+" or "-"')
        continue
      }

      const op = input[0]
      const zipcode = input.slice(1).trim()

      if (!/^\d{5}$/.test(zipcode)) {
        console.log(`  ✗ Invalid zipcode format: ${zipcode} (must be 5 digits)`)
        continue
      }

      if (!zipcodesByCode.has(zipcode)) {
        console.log(`  ✗ Zipcode not found: ${zipcode}`)
        continue
      }

      const entry = `${op}${zipcode}`
      definition.zipcodes.push(entry)
      console.log(`  ✓ Added: ${entry}`)
    }

    // Save
    data.geo_definition = definition
    await fs.writeFile(filepath, JSON.stringify(data), "utf-8")

    console.log("\n✓ Saved geo_definition:")
    console.log(`  States: ${definition.states.join(", ") || "(none)"}`)
    console.log(`  Counties: ${definition.counties.join(", ") || "(none)"}`)
    console.log(`  Zipcodes: ${definition.zipcodes.length} zipcode(s)`)
  }

  rl.close()
  console.log("\n✅ Complete!")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
