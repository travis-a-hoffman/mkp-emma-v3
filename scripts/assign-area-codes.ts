#!/usr/bin/env tsx

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as readline from "node:readline"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface AreaData {
  id: string
  name: string
  code: string | null
  [key: string]: any
}

// US State abbreviations
const STATE_ABBREV: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
}

// Major US city airport codes
const AIRPORT_CODES: Record<string, string> = {
  atlanta: "ATL",
  boston: "BOS",
  chicago: "ORD",
  dallas: "DFW",
  denver: "DEN",
  detroit: "DTW",
  houston: "IAH",
  "las vegas": "LAS",
  "los angeles": "LAX",
  miami: "MIA",
  minneapolis: "MSP",
  "new york": "NYC",
  newark: "EWR",
  orlando: "MCO",
  philadelphia: "PHL",
  phoenix: "PHX",
  portland: "PDX",
  "salt lake": "SLC",
  "salt lake city": "SLC",
  "san diego": "SAN",
  "san francisco": "SFO",
  seattle: "SEA",
  "st louis": "STL",
  "st. louis": "STL",
  "saint louis": "STL",
  tampa: "TPA",
  "washington dc": "DCA",
}

function suggestAreaCode(name: string): string {
  const lowerName = name.toLowerCase().trim()

  // Check if it's a single state
  if (STATE_ABBREV[lowerName]) {
    return STATE_ABBREV[lowerName]
  }

  // Check if it's a major city
  if (AIRPORT_CODES[lowerName]) {
    return AIRPORT_CODES[lowerName]
  }

  // Check for partial matches in cities
  for (const [city, code] of Object.entries(AIRPORT_CODES)) {
    if (lowerName.includes(city) || city.includes(lowerName)) {
      return code
    }
  }

  // Multi-word: take first letter of each word
  const words = name.split(/[\s-]+/).filter((w) => w.length > 0)
  const acronym = words.map((w) => w[0].toUpperCase()).join("")

  // Limit to 6 characters
  return acronym.substring(0, 6)
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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--host") {
      if (i + 1 < args.length) {
        hostOverride = args[i + 1]
        i++
      } else {
        console.error("Error: --host flag requires a hostname argument")
        process.exit(1)
      }
    } else if (!arg.startsWith("--")) {
      envFilePath = arg
    }
  }

  // Load environment variables
  const envPath = path.isAbsolute(envFilePath) ? envFilePath : path.resolve(process.cwd(), envFilePath)
  console.log(`Loading environment variables from: ${envPath}`)
  const result = config({ path: envPath })

  if (result.error) {
    console.error(`Error loading .env file: ${result.error.message}`)
    process.exit(1)
  }

  // Determine hostname
  const hostname = hostOverride || process.env.HOSTNAME
  if (!hostname) {
    console.error("Error: HOSTNAME must be set in .env file or provided via --host parameter")
    process.exit(1)
  }

  console.log(`Processing areas for hostname: ${hostname}\n`)

  // Read all area files
  const areasDir = path.join(__dirname, "data", hostname, "areas")
  console.log(`Reading area files from: ${areasDir}\n`)

  let files: string[]
  try {
    files = await fs.readdir(areasDir)
  } catch (error: any) {
    console.error(`Error reading directory: ${error.message}`)
    process.exit(1)
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log(`No JSON files found in ${areasDir}`)
    return
  }

  // Load all areas
  const areas: Array<{ filename: string; filepath: string; data: AreaData }> = []

  for (const filename of jsonFiles) {
    const filepath = path.join(areasDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    try {
      const data: AreaData = JSON.parse(content)
      areas.push({ filename, filepath, data })
    } catch (error: any) {
      console.error(`Error parsing ${filename}: ${error.message}`)
    }
  }

  console.log(`Found ${areas.length} areas\n`)
  console.log("=" .repeat(60))
  console.log("Instructions:")
  console.log("  - Press Enter to accept the suggested code")
  console.log("  - Type a custom code (max 6 chars) and press Enter")
  console.log("  - Type 's' to skip this area")
  console.log("  - Type 'q' to quit")
  console.log("=" .repeat(60))
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  let updatedCount = 0
  let skippedCount = 0

  for (let i = 0; i < areas.length; i++) {
    const { filename, filepath, data } = areas[i]

    console.log(`\n[${i + 1}/${areas.length}] ${data.name}`)
    console.log(`  Current code: ${data.code === null ? "(null)" : data.code}`)

    // Skip if code already exists and is valid
    if (data.code && data.code.length > 0 && data.code.length <= 6) {
      console.log(`  ✓ Already has valid code: ${data.code}`)
      skippedCount++
      continue
    }

    const suggested = suggestAreaCode(data.name)
    console.log(`  Suggested: ${suggested}`)

    const response = await promptUser(rl, "  Enter code (or s/q): ")

    if (response.toLowerCase() === "q") {
      console.log("\nExiting...")
      break
    }

    if (response.toLowerCase() === "s" || response === "") {
      if (response.toLowerCase() === "s") {
        console.log("  ⊘ Skipped")
        skippedCount++
        continue
      }
      // Empty means accept suggestion
      data.code = suggested.toUpperCase()
    } else {
      // Custom code
      const customCode = response.toUpperCase().trim()

      if (customCode.length === 0) {
        console.log("  ✗ Code cannot be empty. Skipping.")
        skippedCount++
        continue
      }

      if (customCode.length > 6) {
        console.log("  ✗ Code must be 6 characters or less. Skipping.")
        skippedCount++
        continue
      }

      data.code = customCode
    }

    // Save the updated file
    const jsonContent = JSON.stringify(data)
    await fs.writeFile(filepath, jsonContent, "utf-8")

    console.log(`  ✓ Updated: ${data.code}`)
    updatedCount++
  }

  rl.close()

  console.log(`\n${"=".repeat(60)}`)
  console.log("📊 Summary:")
  console.log(`  ✓ Updated: ${updatedCount}`)
  console.log(`  ⊘ Skipped: ${skippedCount}`)
  console.log(`\n✅ Code assignment complete!`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
