#!/usr/bin/env tsx

import mariadb from "mariadb"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ExportedIGroup {
  mkp_connect_id: number
  igroup_name: string | null
  igroup_type: string | null
  igroup_status: string | null
  owner: string | null
  format: string | null
  meeting_night: string | null
  meeting_time: string | null
  meeting_frequency: string | null
  area_name: string | null
  community_name: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  is_accepting_new_members: string | null
  is_ok_initiated_visitors: string | null
  is_ok_uninitiated_visitors: string | null
  is_public_display: number | null
  is_mixed_gender: number | null
  mkp_connect_contact_uid: number | null
  mkp_connect_contact_name: string | null
  public_contact: string | null
  latitude: string | null
  longitude: string | null
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
          connect_drupal.node.nid as mkp_connect_id,
          connect_drupal.node.title as igroup_name,
          connect_drupal.field_data_field_igroup_type.field_igroup_type_value as igroup_type,
          connect_drupal.field_data_field_igroup_status.field_igroup_status_value as igroup_status,
          connect_drupal.field_data_field_owner.field_owner_value as owner,
          connect_drupal.field_data_field_venue.field_venue_value as format,
          connect_drupal.field_data_field_meeting_night.field_meeting_night_value as meeting_night,
          connect_drupal.field_data_field_meeting_time.field_meeting_time_value as meeting_time,
          connect_drupal.field_data_field_frequency.field_frequency_value as meeting_frequency,
          connect_drupal.field_data_field_area.field_area_value as area_name,
          connect_drupal.field_data_field_community.field_community_value as community_name,
          connect_drupal.field_data_field_city.field_city_value as city,
          connect_drupal.field_data_field_state_province.field_state_province_value as state_province,
          connect_drupal.field_data_field_postal_code.field_postal_code_value as postal_code,
          connect_drupal.field_data_field_igroup_new_members.field_igroup_new_members_value as is_accepting_new_members,
          connect_drupal.field_data_field_igroup_initiated_visit.field_igroup_initiated_visit_value as is_ok_initiated_visitors,
          connect_drupal.field_data_field_igroup_uninitiated_visit.field_igroup_uninitiated_visit_value as is_ok_uninitiated_visitors,
          connect_drupal.field_data_field_public_display.field_public_display_value as is_public_display,
          connect_drupal.field_data_field_mixed_gender.field_mixed_gender_value as is_mixed_gender,
          connect_drupal.field_data_field_contact.field_contact_uid as mkp_connect_contact_uid,
          connect_civicrm.civicrm_contact.display_name as mkp_connect_contact_name,
          connect_drupal.field_data_field_public_contact.field_public_contact_value as public_contact,
          connect_drupal.field_data_field_latitude.field_latitude_value as latitude,
          connect_drupal.field_data_field_longitude.field_longitude_value as longitude
      FROM
          connect_drupal.node
              LEFT OUTER JOIN connect_drupal.field_data_field_owner ON node.nid = field_data_field_owner.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_venue ON node.nid = field_data_field_venue.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_public_display ON node.nid = field_data_field_public_display.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_meeting_night ON node.nid = field_data_field_meeting_night.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_meeting_time ON node.nid = field_data_field_meeting_time.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_frequency ON node.nid = field_data_field_frequency.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_area ON node.nid = field_data_field_area.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_community ON node.nid = field_data_field_community.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_city ON node.nid = field_data_field_city.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_state_province ON node.nid = field_data_field_state_province.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_igroup_new_members ON node.nid = field_data_field_igroup_new_members.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_igroup_initiated_visit ON node.nid = field_data_field_igroup_initiated_visit.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_igroup_uninitiated_visit ON node.nid = field_data_field_igroup_uninitiated_visit.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_mixed_gender ON node.nid = field_data_field_mixed_gender.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_contact ON node.nid = field_data_field_contact.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_postal_code ON node.nid = field_data_field_postal_code.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_igroup_type ON node.nid = field_data_field_igroup_type.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_igroup_status ON node.nid = field_data_field_igroup_status.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_latitude ON node.nid = field_data_field_latitude.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_longitude ON node.nid = field_data_field_longitude.entity_id
              LEFT OUTER JOIN connect_drupal.field_data_field_public_contact ON node.nid = field_data_field_public_contact.entity_id
              LEFT OUTER JOIN connect_civicrm.civicrm_uf_match ON connect_drupal.field_data_field_contact.field_contact_uid = connect_civicrm.civicrm_uf_match.uf_id
              LEFT OUTER JOIN connect_civicrm.civicrm_contact ON connect_civicrm.civicrm_uf_match.contact_id = connect_civicrm.civicrm_contact.id
      WHERE
          node.type = 'igroups'
      ORDER BY
          igroup_name
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
      const exportData: ExportedIGroup = {
        mkp_connect_id: row.mkp_connect_id,
        igroup_name: row.igroup_name,
        igroup_type: row.igroup_type,
        igroup_status: row.igroup_status,
        owner: row.owner,
        format: row.format,
        meeting_night: row.meeting_night,
        meeting_time: row.meeting_time,
        meeting_frequency: row.meeting_frequency,
        area_name: row.area_name,
        community_name: row.community_name,
        city: row.city,
        state_province: row.state_province,
        postal_code: row.postal_code,
        is_accepting_new_members: row.is_accepting_new_members,
        is_ok_initiated_visitors: row.is_ok_initiated_visitors,
        is_ok_uninitiated_visitors: row.is_ok_uninitiated_visitors,
        is_public_display: row.is_public_display,
        is_mixed_gender: row.is_mixed_gender,
        mkp_connect_contact_uid: row.mkp_connect_contact_uid,
        mkp_connect_contact_name: row.mkp_connect_contact_name,
        public_contact: row.public_contact,
        latitude: row.latitude,
        longitude: row.longitude,
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
