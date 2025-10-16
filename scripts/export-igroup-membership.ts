#!/usr/bin/env tsx

import mariadb from "mariadb"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface MkpConnectMember {
  drupal_user_id: number
  member_email: string | null
  user_name: string | null
  civicrm_user_id: number | null
  do_not_email: number | null
  do_not_mail: number | null
  do_not_phone: number | null
  do_not_sms: number | null
  do_not_trade: number | null
  is_opt_out: number | null
  sort_name: string | null
  display_name: string | null
  nick_name: string | null
  legal_name: string | null
  image_URL: string | null
  preferred_language: string | null
  preferred_mail_format: string | null
  IEN: string | null
  birth_date: string | null
  deceased_date: string | null
}

interface MkpConnectIGroupMembership {
  group_id: number
  group_email: string | null
  group_type: string | null
  members: MkpConnectMember[]
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

    console.log("Fetching I-Group memberships from database...")

    // Execute the query
    const rows = await conn.query(`
      SELECT
          og_google_groups.nid as group_id,
          og_google_groups.email as group_email,
          og_google_groups.type as group_type,
          og_membership.etid as drupal_user_id,
          og_google_groups_users.email as member_email,
          connect_drupal.users.name as user_name,
          civicrm_warrior_contact.civicrm_user_id,
          do_not_email,
          do_not_mail,
          do_not_phone,
          do_not_sms,
          do_not_trade,
          is_opt_out,
          sort_name,
          display_name,
          nick_name,
          legal_name,
          image_URL,
          preferred_language,
          preferred_mail_format,
          IEN,
          birth_date,
          deceased_date
      FROM
          connect_drupal.og_google_groups
              INNER JOIN connect_drupal.og_membership ON og_google_groups.nid = og_membership.gid
              INNER JOIN connect_drupal.og_google_groups_users ON og_google_groups_users.uid = og_membership.etid
              INNER JOIN connect_drupal.users ON og_membership.etid = connect_drupal.users.uid
              INNER JOIN (
                  SELECT
                      connect_civicrm.civicrm_contact.id as civicrm_user_id,
                      connect_civicrm.civicrm_contact.do_not_email,
                      connect_civicrm.civicrm_contact.do_not_mail,
                      connect_civicrm.civicrm_contact.do_not_phone,
                      connect_civicrm.civicrm_contact.do_not_sms,
                      connect_civicrm.civicrm_contact.do_not_trade,
                      connect_civicrm.civicrm_contact.is_opt_out,
                      connect_civicrm.civicrm_contact.sort_name as sort_name,
                      connect_civicrm.civicrm_contact.display_name as display_name,
                      connect_civicrm.civicrm_contact.nick_name as nick_name,
                      connect_civicrm.civicrm_contact.legal_name as legal_name,
                      connect_civicrm.civicrm_contact.image_URL as image_URL,
                      connect_civicrm.civicrm_contact.preferred_language as preferred_language,
                      connect_civicrm.civicrm_contact.preferred_mail_format as preferred_mail_format,
                      connect_civicrm.civicrm_value_warrior_data_1.animal_name_2 as IEN,
                      connect_civicrm.civicrm_value_warrior_data_1.search_email_238 as search_email,
                      connect_civicrm.civicrm_value_warrior_data_1.birth_date_432 as birth_date,
                      connect_civicrm.civicrm_value_warrior_data_1.date_of_death_758 as deceased_date
                  FROM
                      connect_civicrm.civicrm_contact
                          LEFT JOIN connect_civicrm.civicrm_value_warrior_data_1 ON civicrm_contact.id = civicrm_value_warrior_data_1.entity_id
                  WHERE
                      connect_civicrm.civicrm_contact.contact_type = 'Individual'
              ) as civicrm_warrior_contact ON civicrm_warrior_contact.search_email = connect_drupal.users.mail
      WHERE og_google_groups.type = 'igroups'
        AND og_google_groups_users.email != 'mkpconnect_admin@mkpusa.org'
        AND og_google_groups_users.email != 'staff-groups@mkpusa.org'
      GROUP BY og_membership.etid, og_google_groups.nid
      ORDER BY og_google_groups.nid
    `)

    if (!rows || rows.length === 0) {
      console.log("No I-Group memberships found in database")
      return
    }

    console.log(`Found ${rows.length} I-Group membership records`)

    // Group members by group_id
    const membershipByGroup = new Map<number, MkpConnectIGroupMembership>()

    for (const row of rows) {
      const groupId = row.group_id

      if (!membershipByGroup.has(groupId)) {
        membershipByGroup.set(groupId, {
          group_id: groupId,
          group_email: row.group_email,
          group_type: row.group_type,
          members: [],
        })
      }

      const membership = membershipByGroup.get(groupId)!
      membership.members.push({
        drupal_user_id: row.drupal_user_id,
        member_email: row.member_email,
        user_name: row.user_name,
        civicrm_user_id: row.civicrm_user_id,
        do_not_email: row.do_not_email,
        do_not_mail: row.do_not_mail,
        do_not_phone: row.do_not_phone,
        do_not_sms: row.do_not_sms,
        do_not_trade: row.do_not_trade,
        is_opt_out: row.is_opt_out,
        sort_name: row.sort_name,
        display_name: row.display_name,
        nick_name: row.nick_name,
        legal_name: row.legal_name,
        image_URL: row.image_URL,
        preferred_language: row.preferred_language,
        preferred_mail_format: row.preferred_mail_format,
        IEN: row.IEN,
        birth_date: row.birth_date,
        deceased_date: row.deceased_date,
      })
    }

    console.log(`Grouped into ${membershipByGroup.size} I-Groups`)

    // Ensure output directory exists (with hostname-based path)
    const outputDir = path.join(__dirname, "data", outputHostname, "igroups", "membership")
    await fs.mkdir(outputDir, { recursive: true })

    // Export each I-Group's membership as a separate JSON file
    let exportedCount = 0

    for (const [groupId, membership] of membershipByGroup) {
      // Use group_id in filename to ensure uniqueness
      const filename = `${groupId}.json`
      const filepath = path.join(outputDir, filename)

      const jsonContent = pretty ? JSON.stringify(membership, null, 2) : JSON.stringify(membership)

      await fs.writeFile(filepath, jsonContent, "utf-8")

      console.log(`  ✓ Exported: ${filename} (Group ${groupId}, ${membership.members.length} members)`)
      exportedCount++
    }

    console.log(`\n✅ Successfully exported ${exportedCount} I-Group membership files to ${outputDir}`)
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
