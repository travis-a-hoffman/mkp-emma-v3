#!/usr/bin/env tsx

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Membership data structures
interface MembershipRecord {
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

interface MembershipData {
  group_id: number
  group_email: string | null
  group_type: string | null
  members: MembershipRecord[]
}

// Warrior data structure (minimal - just what we need)
interface WarriorData {
  id: string
  mkpconnect_data: {
    civicrm_user_id: number | null
    member_email: string | null
  }
}

// I-Group data structure
interface IGroupData {
  id: string
  name: string
  members: { id: string }[]
  mkpconnect_data: {
    mkp_connect_id: number
    [key: string]: any
  }
  [key: string]: any
}

interface Stats {
  igroupsProcessed: number
  igroupsUpdated: number
  membersMatched: number
  membersNotFound: number
  igroupsWithNoMembership: number
  igroupsSkipped: number
  warnings: string[]
}

// Build lookup maps from all warrior files
async function buildWarriorLookupMaps(
  warriorsDir: string
): Promise<{ byCivicrmId: Map<number, string>; byEmail: Map<string, string> }> {
  console.log(`\nBuilding warrior lookup maps from: ${warriorsDir}`)

  const byCivicrmId = new Map<number, string>()
  const byEmail = new Map<string, string>()

  const warriorFiles = await fs.readdir(warriorsDir)
  const jsonFiles = warriorFiles.filter((f) => f.endsWith(".json"))

  console.log(`Loading ${jsonFiles.length} warrior files...`)

  let loaded = 0
  for (const file of jsonFiles) {
    try {
      const filepath = path.join(warriorsDir, file)
      const content = await fs.readFile(filepath, "utf-8")
      const warrior: WarriorData = JSON.parse(content)

      // Map by civicrm_user_id (primary key)
      if (warrior.mkpconnect_data?.civicrm_user_id) {
        byCivicrmId.set(warrior.mkpconnect_data.civicrm_user_id, warrior.id)
      }

      // Map by email (fallback key)
      if (warrior.mkpconnect_data?.member_email) {
        const email = warrior.mkpconnect_data.member_email.toLowerCase().trim()
        byEmail.set(email, warrior.id)
      }

      loaded++
      if (loaded % 1000 === 0) {
        console.log(`  Loaded ${loaded} warriors...`)
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to load warrior file ${file}: ${error}`)
    }
  }

  console.log(`✓ Loaded ${loaded} warriors`)
  console.log(`  - ${byCivicrmId.size} mapped by CiviCRM ID`)
  console.log(`  - ${byEmail.size} mapped by email`)

  return { byCivicrmId, byEmail }
}

// Load all membership data
async function loadMembershipData(membershipDir: string): Promise<Map<number, MembershipData>> {
  console.log(`\nLoading membership data from: ${membershipDir}`)

  const membershipMap = new Map<number, MembershipData>()
  const membershipFiles = await fs.readdir(membershipDir)
  const jsonFiles = membershipFiles.filter((f) => f.endsWith(".json"))

  console.log(`Loading ${jsonFiles.length} membership files...`)

  let loaded = 0
  for (const file of jsonFiles) {
    try {
      const filepath = path.join(membershipDir, file)
      const content = await fs.readFile(filepath, "utf-8")
      const membership: MembershipData = JSON.parse(content)

      membershipMap.set(membership.group_id, membership)

      loaded++
      if (loaded % 100 === 0) {
        console.log(`  Loaded ${loaded} membership files...`)
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to load membership file ${file}: ${error}`)
    }
  }

  console.log(`✓ Loaded ${loaded} membership files`)

  return membershipMap
}

// Process a single i-group file
async function processIGroup(
  igroupFile: string,
  igroupsDir: string,
  membershipMap: Map<number, MembershipData>,
  warriorByCivicrmId: Map<number, string>,
  warriorByEmail: Map<string, string>,
  stats: Stats,
  dryRun: boolean
): Promise<void> {
  const filepath = path.join(igroupsDir, igroupFile)

  try {
    // Read i-group file
    const content = await fs.readFile(filepath, "utf-8")
    const igroup: IGroupData = JSON.parse(content)

    stats.igroupsProcessed++

    // Get mkp_connect_id from the igroup
    const mkpConnectId = igroup.mkpconnect_data?.mkp_connect_id
    if (!mkpConnectId) {
      stats.warnings.push(`${igroupFile}: Missing mkp_connect_id in mkpconnect_data`)
      stats.igroupsSkipped++
      return
    }

    // Look up membership data
    const membership = membershipMap.get(mkpConnectId)
    if (!membership) {
      console.log(`  ⊘ ${igroupFile}: No membership data found for group ${mkpConnectId}`)
      stats.igroupsWithNoMembership++
      return
    }

    // Build members array
    const members: { id: string }[] = []
    const notFoundMembers: string[] = []

    for (const member of membership.members) {
      let warriorId: string | undefined

      // Try lookup by civicrm_user_id first (primary)
      if (member.civicrm_user_id) {
        warriorId = warriorByCivicrmId.get(member.civicrm_user_id)
      }

      // Fall back to email lookup
      if (!warriorId && member.member_email) {
        const email = member.member_email.toLowerCase().trim()
        warriorId = warriorByEmail.get(email)
      }

      if (warriorId) {
        members.push({ id: warriorId })
        stats.membersMatched++
      } else {
        const identifier =
          member.civicrm_user_id
            ? `civicrm:${member.civicrm_user_id}`
            : member.member_email
              ? `email:${member.member_email}`
              : `drupal:${member.drupal_user_id}`
        notFoundMembers.push(identifier)
        stats.membersNotFound++
      }
    }

    // Update i-group with members
    igroup.members = members

    if (!dryRun) {
      // Write updated i-group file
      const jsonContent = JSON.stringify(igroup, null, 2)
      await fs.writeFile(filepath, jsonContent, "utf-8")
    }

    console.log(
      `  ✓ ${igroupFile}: ${members.length}/${membership.members.length} members matched${dryRun ? " (dry run)" : ""}`
    )

    if (notFoundMembers.length > 0) {
      stats.warnings.push(
        `${igroupFile}: ${notFoundMembers.length} members not found: ${notFoundMembers.slice(0, 3).join(", ")}${notFoundMembers.length > 3 ? "..." : ""}`
      )
    }

    stats.igroupsUpdated++
  } catch (error) {
    console.error(`  ✗ Error processing ${igroupFile}: ${error}`)
    stats.igroupsSkipped++
  }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let pretty = false
  let sourceHostOverride: string | null = null
  let destHostOverride: string | null = null
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--source-host") {
      if (i + 1 < args.length) {
        sourceHostOverride = args[i + 1]
        i++
      } else {
        console.error("Error: --source-host flag requires a hostname argument")
        process.exit(1)
      }
    } else if (arg === "--dest-host") {
      if (i + 1 < args.length) {
        destHostOverride = args[i + 1]
        i++
      } else {
        console.error("Error: --dest-host flag requires a hostname argument")
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

  // Determine hostnames
  const sourceHostname = sourceHostOverride || "mkpconnect.org"
  const destHostname = destHostOverride || "mkp-emma-v3.vercel.app"

  console.log(`Source hostname: ${sourceHostname}`)
  console.log(`Destination hostname: ${destHostname}`)
  if (dryRun) {
    console.log(`🔍 DRY RUN MODE - No files will be modified`)
  }

  // Define paths
  const membershipDir = path.join(__dirname, "data", sourceHostname, "igroups", "membership")
  const warriorsDir = path.join(__dirname, "data", destHostname, "warriors")
  const igroupsDir = path.join(__dirname, "data", destHostname, "i-groups")

  // Initialize stats
  const stats: Stats = {
    igroupsProcessed: 0,
    igroupsUpdated: 0,
    membersMatched: 0,
    membersNotFound: 0,
    igroupsWithNoMembership: 0,
    igroupsSkipped: 0,
    warnings: [],
  }

  try {
    // Step 1: Build warrior lookup maps
    const { byCivicrmId: warriorByCivicrmId, byEmail: warriorByEmail } = await buildWarriorLookupMaps(warriorsDir)

    // Step 2: Load membership data
    const membershipMap = await loadMembershipData(membershipDir)

    // Step 3: Process all i-group files
    console.log(`\nProcessing i-group files from: ${igroupsDir}\n`)

    const igroupFiles = await fs.readdir(igroupsDir)
    const jsonFiles = igroupFiles.filter((f) => f.endsWith(".json"))

    console.log(`Found ${jsonFiles.length} i-group files to process\n`)

    for (const file of jsonFiles) {
      await processIGroup(file, igroupsDir, membershipMap, warriorByCivicrmId, warriorByEmail, stats, dryRun)
    }

    // Print summary
    console.log(`\n${"=".repeat(60)}`)
    console.log(`✅ Transform Complete!`)
    console.log(`${"=".repeat(60)}`)
    console.log(`   I-Groups processed: ${stats.igroupsProcessed}`)
    console.log(`   I-Groups updated: ${stats.igroupsUpdated}`)
    console.log(`   I-Groups with no membership: ${stats.igroupsWithNoMembership}`)
    console.log(`   I-Groups skipped: ${stats.igroupsSkipped}`)
    console.log(``)
    console.log(`   Members matched: ${stats.membersMatched}`)
    console.log(`   Members not found: ${stats.membersNotFound}`)

    if (stats.warnings.length > 0) {
      console.log(``)
      console.log(`   ⚠️  Warnings (${stats.warnings.length}):`)
      // Show first 10 warnings
      for (const warning of stats.warnings.slice(0, 10)) {
        console.log(`      ${warning}`)
      }
      if (stats.warnings.length > 10) {
        console.log(`      ... and ${stats.warnings.length - 10} more warnings`)
      }
    }

    if (dryRun) {
      console.log(``)
      console.log(`   🔍 DRY RUN - No files were modified`)
    }

    console.log(`${"=".repeat(60)}\n`)

    process.exit(0)
  } catch (error) {
    console.error("Fatal error:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
