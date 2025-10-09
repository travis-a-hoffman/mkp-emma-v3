#!/usr/bin/env tsx

import mariadb from "mariadb"
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
  const dbHost = process.env.MKPCONNECT_DB_HOST || process.env.MKPCONNECT_DRUPAL_DB_HOST || "mkpconnect.org"
  const dbPort = Number.parseInt(
    process.env.MKPCONNECT_DB_PORT || process.env.MKPCONNECT_DRUPAL_DB_PORT || "3306"
  )
  const dbUser = process.env.MKPCONNECT_DB_USERNAME
  const dbPassword = process.env.MKPCONNECT_DB_PASSWORD
  const dbName = process.env.MKPCONNECT_CIVICRM_DB_NAME || "connect_civicrm"

  if (!dbUser || !dbPassword) {
    console.error("Error: MKPCONNECT_DB_USERNAME and MKPCONNECT_DB_PASSWORD must be set in .env file")
    process.exit(1)
  }

  console.log(`Connecting to MariaDB at: ${dbHost}:${dbPort}`)

  // Determine the output hostname (use override if provided, otherwise use dbHost)
  const outputHostname = hostOverride || dbHost
  console.log(`Output directory will be based on hostname: ${outputHostname}`)

  let conn: mariadb.PoolConnection | null = null

  try {
    // Create connection pool
    const pool = mariadb.createPool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectionLimit: 5,
    })

    // Get connection from pool
    conn = await pool.getConnection()

    console.log("Fetching MKP community zipcodes from database...")

    // Execute the query
    const rows = await conn.query(`
      SELECT
          zip_county_lookup.zip as zipcode,
          zip_county_lookup.county,
          zip_county_lookup.state as st,
          zip_county_lookup.area,
          community,
          latitude,
          longitude
      FROM connect_civicrm.zip_county_lookup
          INNER JOIN connect_civicrm.civicrm_state_province csp
              on zip_county_lookup.state_province_id = csp.id
          RIGHT OUTER JOIN connect_civicrm.\`State, Area, Community, County, Zip\`
              ON zip_county_lookup.zip = \`State, Area, Community, County, Zip\`.zip
      WHERE csp.country_id = 1228
          AND csp.abbreviation NOT IN ('PR', 'VI', 'AS')
      ORDER BY zipcode
    `)

    if (!rows || rows.length === 0) {
      console.log("No zipcodes found in database")
      return
    }

    console.log(`Found ${rows.length} zipcodes`)

    // Ensure output directory exists (with hostname-based path)
    const outputDir = path.join(__dirname, "data", outputHostname, "mkp-community-zipcodes")
    await fs.mkdir(outputDir, { recursive: true })

    // Export each zipcode as a separate JSON file
    let exportedCount = 0

    for (const row of rows) {
      const exportData: ExportedZipcode = {
        zipcode: row.zipcode,
        county: row.county,
        st: row.st,
        area: row.area,
        community: row.community,
        latitude: row.latitude,
        longitude: row.longitude,
      }

      // Use zipcode for filename
      const filename = `${row.zipcode}.json`
      const filepath = path.join(outputDir, filename)

      const jsonContent = pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)

      await fs.writeFile(filepath, jsonContent, "utf-8")

      console.log(`  ✓ Exported: ${filename}`)
      exportedCount++
    }

    console.log(`\n✅ Successfully exported ${exportedCount} zipcodes to ${outputDir}`)
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  } finally {
    if (conn) {
      await conn.release()
    }
  }
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
