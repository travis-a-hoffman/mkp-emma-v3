#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as https from "node:https"
import { createWriteStream, createReadStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import { parse } from "csv-parse"
import AdmZip from "adm-zip"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// SimpleMaps US Zipcodes download URL
const DOWNLOAD_URL =
  "https://simplemaps.com/static/data/us-zips/1.911/basic/simplemaps_uszips_basicv1.911.zip"
const ZIP_FILENAME = "simplemaps_uszips_basicv1.911.zip"
const CSV_FILENAME = "uszips.csv"

interface USZipcodeRow {
  zip: string
  lat: string
  lng: string
  city: string
  state_id: string
  state_name: string
  zcta: string
  parent_zcta: string
  population: string
  density: string
  county_fips: string
  county_name: string
  county_weights: string
  county_names_all: string
  county_fips_all: string
  imprecise: string
  military: string
  timezone: string
}

interface TransformedZipcode {
  zip: string
  lat: number
  lng: number
  city: string
  state_id: string
  state_name: string
  zcta: string | null
  parent_zcta: string | null
  population: number | null
  density: number | null
  county_fips: string | null
  county_name: string | null
  county_weights: string | null
  county_names_all: string | null
  county_fips_all: string | null
  imprecise: boolean
  military: boolean
  timezone: string | null
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(outputPath)
    let downloadedBytes = 0
    let totalBytes = 0

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            return downloadFile(redirectUrl, outputPath).then(resolve).catch(reject)
          }
        }

        if (response.statusCode !== 200) {
          file.close()
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
          return
        }

        totalBytes = parseInt(response.headers["content-length"] || "0", 10)

        response.on("data", (chunk) => {
          downloadedBytes += chunk.length
          if (totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1)
            process.stdout.write(`\r  Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB (${percent}%)`)
          }
        })

        response.pipe(file)

        file.on("finish", () => {
          file.close()
          process.stdout.write("\n")
          resolve()
        })
      })
      .on("error", (err) => {
        file.close()
        fs.unlink(outputPath).catch(() => {})
        reject(err)
      })

    file.on("error", (err) => {
      file.close()
      fs.unlink(outputPath).catch(() => {})
      reject(err)
    })
  })
}

async function extractZipFile(zipPath: string, extractToDir: string): Promise<void> {
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(extractToDir, true)
}

async function dropAndCreateTable(supabase: any): Promise<void> {
  console.log("  ⚠ Note: Table creation must be done manually in Supabase SQL Editor")
  console.log("  → Please run the SQL from: scripts/db/create-geography-us-zipcodes-table.sql")
  console.log("  → Or copy the SQL below into Supabase SQL Editor:\n")

  const createTableSQL = `-- Drop existing table
DROP TABLE IF EXISTS public.geography_us_zipcodes CASCADE;

-- Create new table
CREATE TABLE IF NOT EXISTS public.geography_us_zipcodes (
  zip TEXT PRIMARY KEY,
  lat NUMERIC(10, 6) NOT NULL,
  lng NUMERIC(10, 6) NOT NULL,
  city TEXT NOT NULL,
  state_id TEXT NOT NULL,
  state_name TEXT NOT NULL,
  zcta TEXT,
  parent_zcta TEXT,
  population INTEGER,
  density NUMERIC,
  county_fips TEXT,
  county_name TEXT,
  county_weights TEXT,
  county_names_all TEXT,
  county_fips_all TEXT,
  imprecise BOOLEAN,
  military BOOLEAN,
  timezone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_city ON public.geography_us_zipcodes (city);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_state_id ON public.geography_us_zipcodes (state_id);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_city_state ON public.geography_us_zipcodes (city, state_id);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_lat_lng ON public.geography_us_zipcodes (lat, lng);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_county_fips ON public.geography_us_zipcodes (county_fips);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_population ON public.geography_us_zipcodes (population DESC NULLS LAST);`

  console.log(createTableSQL)
  console.log("\n  Waiting for table to be created... (Press Ctrl+C if already done)")

  // Check if table exists
  let tableExists = false
  for (let i = 0; i < 60; i++) {
    // Wait up to 60 seconds
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const { error } = await supabase.from("geography_us_zipcodes").select("zip").limit(1)

    if (!error || !error.message.includes("does not exist")) {
      tableExists = true
      break
    }

    if (i % 5 === 0 && i > 0) {
      process.stdout.write(".")
    }
  }

  if (!tableExists) {
    throw new Error(
      "Table was not created. Please run the SQL above in Supabase SQL Editor, then run this script again with --skip-extract to continue."
    )
  }

  console.log("\n  ✓ Table verified!")
}

function transformRow(row: USZipcodeRow): TransformedZipcode {
  return {
    zip: row.zip,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    city: row.city,
    state_id: row.state_id,
    state_name: row.state_name,
    zcta: row.zcta || null,
    parent_zcta: row.parent_zcta || null,
    population: row.population ? parseInt(row.population, 10) : null,
    density: row.density ? parseFloat(row.density) : null,
    county_fips: row.county_fips || null,
    county_name: row.county_name || null,
    county_weights: row.county_weights || null,
    county_names_all: row.county_names_all || null,
    county_fips_all: row.county_fips_all || null,
    imprecise: row.imprecise === "TRUE" || row.imprecise === "1",
    military: row.military === "TRUE" || row.military === "1",
    timezone: row.timezone || null,
  }
}

async function importCSVData(supabase: any, csvPath: string): Promise<void> {
  const records: TransformedZipcode[] = []
  let totalProcessed = 0
  let totalImported = 0
  let errorCount = 0
  const BATCH_SIZE = 1000

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  )

  for await (const row of parser) {
    try {
      const transformedRow = transformRow(row as USZipcodeRow)
      records.push(transformedRow)
      totalProcessed++

      if (records.length >= BATCH_SIZE) {
        const { error } = await supabase.from("geography_us_zipcodes").insert(records)

        if (error) {
          console.error(`\n  ✗ Error inserting batch at row ${totalProcessed}: ${error.message}`)
          errorCount++
        } else {
          totalImported += records.length
        }

        if (totalProcessed % 5000 === 0) {
          console.log(`  → Processed ${totalProcessed.toLocaleString()} rows...`)
        }

        records.length = 0
      }
    } catch (err: any) {
      console.error(`\n  ✗ Error transforming row ${totalProcessed}: ${err.message}`)
      errorCount++
    }
  }

  // Insert remaining records
  if (records.length > 0) {
    const { error } = await supabase.from("geography_us_zipcodes").insert(records)

    if (error) {
      console.error(`\n  ✗ Error inserting final batch: ${error.message}`)
      errorCount++
    } else {
      totalImported += records.length
    }
  }

  console.log(`\n  ✓ Imported ${totalImported.toLocaleString()} zipcodes`)
  if (errorCount > 0) {
    console.log(`  ✗ Errors: ${errorCount}`)
  }

  // Get some statistics
  const { data: stats } = await supabase.from("geography_us_zipcodes").select("state_id, population, military")

  if (stats && stats.length > 0) {
    const states = new Set((stats as any[]).map((r: any) => r.state_id))
    const populations = (stats as any[])
      .map((r: any) => r.population)
      .filter((p: number | null) => p !== null && p > 0)
    const avgPop = populations.length > 0 ? Math.round(populations.reduce((a: number, b: number) => a + b, 0) / populations.length) : 0
    const militaryCount = (stats as any[]).filter((r: any) => r.military === true).length

    console.log(`\n📊 Import Summary:`)
    console.log(`  ✓ Total zipcodes: ${totalImported.toLocaleString()}`)
    console.log(`  ✓ States covered: ${states.size}`)
    console.log(`  ✓ Average population: ${avgPop.toLocaleString()}`)
    console.log(`  ✓ Military zipcodes: ${militaryCount.toLocaleString()}`)
  }
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let skipDownload = false
  let skipExtract = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--skip-download") {
      skipDownload = true
    } else if (arg === "--skip-extract") {
      skipExtract = true
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

  // Validate required environment variables
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
    process.exit(1)
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}\n`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Define paths
  const dataDir = path.join(__dirname, "data")
  const zipPath = path.join(dataDir, ZIP_FILENAME)
  const extractDir = path.join(dataDir, "simplemaps.com", "us-zips")
  const csvPath = path.join(extractDir, CSV_FILENAME)

  // Ensure data directory exists
  await fs.mkdir(dataDir, { recursive: true })

  // Step 1: Download
  console.log("📥 Step 1: Downloading US Zipcodes data...")
  const zipExists = await fileExists(zipPath)

  if (skipDownload && zipExists) {
    console.log("  ⊘ Skipped download (file already exists)")
  } else if (zipExists && !skipDownload) {
    console.log("  ⊘ File already exists, using cached version (use --skip-download to suppress this message)")
  } else {
    try {
      await downloadFile(DOWNLOAD_URL, zipPath)
      console.log(`  ✓ Downloaded to ${zipPath}`)
    } catch (error: any) {
      console.error(`  ✗ Download failed: ${error.message}`)
      process.exit(1)
    }
  }

  // Step 2: Extract
  console.log("\n📦 Step 2: Extracting archive...")
  const csvExists = await fileExists(csvPath)

  if (skipExtract && csvExists) {
    console.log("  ⊘ Skipped extraction (CSV already exists)")
  } else {
    try {
      await fs.mkdir(extractDir, { recursive: true })
      await extractZipFile(zipPath, extractDir)
      console.log(`  ✓ Extracted to ${extractDir}`)

      // Check if CSV exists
      if (!(await fileExists(csvPath))) {
        console.error(`  ✗ Error: ${CSV_FILENAME} not found in extracted files`)
        process.exit(1)
      }
    } catch (error: any) {
      console.error(`  ✗ Extraction failed: ${error.message}`)
      process.exit(1)
    }
  }

  // Step 3: Create table
  console.log("\n🗄️  Step 3: Creating database table...")
  try {
    await dropAndCreateTable(supabase)
  } catch (error: any) {
    console.error(`  ✗ Table creation failed: ${error.message}`)
    console.error("\nNote: You may need to run this SQL manually in Supabase:")
    console.error("  DROP TABLE IF EXISTS geography_us_zipcodes CASCADE;")
    process.exit(1)
  }

  // Step 4: Import data
  console.log("\n📊 Step 4: Importing data...")
  try {
    await importCSVData(supabase, csvPath)
  } catch (error: any) {
    console.error(`  ✗ Import failed: ${error.message}`)
    process.exit(1)
  }

  console.log("\n✅ Import complete!")
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
