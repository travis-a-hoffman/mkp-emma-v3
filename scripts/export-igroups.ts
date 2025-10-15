#!/usr/bin/env tsx

import mariadb from "mariadb"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface MkpConnectIGroup {
  // Core fields
  mkp_connect_id: number
  igroup_name: string | null
  about: string | null
  igroup_type: string | null
  igroup_status: string | null
  igroup_class: string | null

  // Address fields
  address: string | null
  city: string | null
  postal_code: string | null
  state_province: string | null
  country: string | null

  // Relationships (names)
  community_name: string | null
  area_name: string | null
  owner_name: string | null

  // Relationships (IDs)
  community_id: number | null
  area_id: number | null
  owner_id: number | null

  // Meeting details
  meeting_night: string | null
  meeting_time: string | null
  meeting_frequency: string | null

  // Location
  latitude: string | null
  longitude: string | null

  // Flags/Settings
  is_accepting_initiated_visitors: string | null
  is_accepting_uninitiated_visitors: string | null
  is_accepting_new_members: string | null
  igroup_is_private: string | null
  is_public_display: string | null
  igroup_email: string | null
  igroup_is_mixed_gender: string | null
  igroup_mkpi: string | null

  // Contact information
  mkp_connect_contact_uid: number | null
  mkp_connect_contact_name: string | null
  mkp_connect_contact_email: string | null
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
  const dbName = process.env.MKPCONNECT_DRUPAL_DB_NAME || "connect_drupal"

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

    console.log("Fetching I-Groups from database...")

    // Execute the query
    const rows = await conn.query(`
      SELECT
          nid as mkp_connect_id,
          title as igroup_name,
          field_about_entity_value as about,
          field_igroup_type_value as igroup_type,
          field_igroup_status_value as igroup_status,
          field_igroup_class_value as igroup_class,

          field_address_value as address,
          field_city_value as city,
          field_postal_code_value as postal_code,
          field_state_province_value as state_province,
          field_country_value as country,

          field_community_value as community_name,
          field_community_nid_value as community_id,
          field_area_value as area_name,
          field_area_nid_value as area_id,

          field_owner_value as owner_name,
          field_owner_nid_value as owner_id,

          field_meeting_night_value as meeting_night,
          field_meeting_time_value as meeting_time,
          field_frequency_value as meeting_frequency,

          field_latitude_value as latitude,
          field_longitude_value as longitude,

          field_igroup_initiated_visit_value as is_accepting_initiated_visitors,
          field_igroup_uninitiated_visit_value as is_accepting_uninitiated_visitors,
          field_igroup_new_members_value as is_accepting_new_members,
          field_private_value as igroup_is_private,
          field_public_display_value as is_public_display,
          field_group_email_value as igroup_email,
          field_mixed_gender_value as igroup_is_mixed_gender,
          field_mkpi_value as igroup_mkpi,

          field_contact_uid as mkp_connect_contact_uid,
          connect_civicrm.civicrm_contact.display_name as mkp_connect_contact_name,
          connect_civicrm.civicrm_email.email as mkp_connect_contact_email
      FROM connect_drupal.igroups
          LEFT JOIN connect_civicrm.civicrm_contact ON connect_drupal.igroups.field_contact_uid = connect_civicrm.civicrm_contact.id
          LEFT JOIN connect_civicrm.civicrm_email ON connect_drupal.igroups.field_contact_uid = connect_civicrm.civicrm_email.contact_id
      WHERE field_country_value = 'United States'
      ORDER BY title
    `)

    if (!rows || rows.length === 0) {
      console.log("No I-Groups found in database")
      return
    }

    console.log(`Found ${rows.length} I-Groups`)

    // Ensure output directory exists (with hostname-based path)
    const outputDir = path.join(__dirname, "data", outputHostname, "igroups")
    await fs.mkdir(outputDir, { recursive: true })

    // Export each I-Group as a separate JSON file
    let exportedCount = 0

    for (const row of rows) {
      const exportData: MkpConnectIGroup = {
        // Core fields
        mkp_connect_id: row.mkp_connect_id,
        igroup_name: row.igroup_name,
        about: row.about,
        igroup_type: row.igroup_type,
        igroup_status: row.igroup_status,
        igroup_class: row.igroup_class,

        // Address fields
        address: row.address,
        city: row.city,
        postal_code: row.postal_code,
        state_province: row.state_province,
        country: row.country,

        // Relationships (names)
        community_name: row.community_name,
        area_name: row.area_name,
        owner_name: row.owner_name,

        // Relationships (IDs)
        community_id: row.community_id,
        area_id: row.area_id,
        owner_id: row.owner_id,

        // Meeting details
        meeting_night: row.meeting_night,
        meeting_time: row.meeting_time,
        meeting_frequency: row.meeting_frequency,

        // Location
        latitude: row.latitude,
        longitude: row.longitude,

        // Flags/Settings
        is_accepting_initiated_visitors: row.is_accepting_initiated_visitors,
        is_accepting_uninitiated_visitors: row.is_accepting_uninitiated_visitors,
        is_accepting_new_members: row.is_accepting_new_members,
        igroup_is_private: row.igroup_is_private,
        is_public_display: row.is_public_display,
        igroup_email: row.igroup_email,
        igroup_is_mixed_gender: row.igroup_is_mixed_gender,
        igroup_mkpi: row.igroup_mkpi,

        // Contact information
        mkp_connect_contact_uid: row.mkp_connect_contact_uid,
        mkp_connect_contact_name: row.mkp_connect_contact_name,
        mkp_connect_contact_email: row.mkp_connect_contact_email,
      }

      // Use sanitized name for filename
      const sanitizedName = (row.igroup_name || "unnamed")
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .substring(0, 50)
      const filename = `${sanitizedName}_${row.mkp_connect_id}.json`
      const filepath = path.join(outputDir, filename)

      const jsonContent = pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData)

      await fs.writeFile(filepath, jsonContent, "utf-8")

      console.log(`  ✓ Exported: ${filename} (${row.igroup_name})`)
      exportedCount++
    }

    console.log(`\n✅ Successfully exported ${exportedCount} I-Groups to ${outputDir}`)
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
