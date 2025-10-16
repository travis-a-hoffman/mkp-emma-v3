#!/usr/bin/env tsx

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Source data structure from MKP Connect membership files
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

// Target data structure - Warrior<EventBasic>
interface EventBasic {
  id: string
  name: string
  event_type_id: string | null
  area_id: string | null
  community_id: string | null
  venue_id: string | null
  start_at: string | null
  end_at: string | null
  is_published: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface TranslatedWarrior {
  // Person fields
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string | null
  phone: string | null
  billing_address_id: string | null
  mailing_address_id: string | null
  physical_address_id: string | null
  notes: string | null
  photo_url: string | null
  birth_date: string | null
  deceased_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Warrior-specific fields
  log_id: string | null
  initiation_id: string | null
  initiation_on: string | null
  status: string
  training_events: string[]
  staffed_events: string[]
  lead_events: string[]
  mos_events: string[]
  area_id: string | null
  community_id: string | null
  inner_essence_name: string | null
  // Store raw data for reference
  mkpconnect_data: MkpConnectMember
}

interface Stats {
  totalMembershipsProcessed: number
  totalMembersProcessed: number
  uniqueWarriorsCreated: number
  duplicatesMerged: number
  warnings: {
    missingName: number
    missingEmail: number
    missingCivicrmId: number
    nameParsingFailed: number
  }
  skipped: number
}

// Helper Functions

function parseName(displayName: string | null, sortName: string | null): {
  first_name: string
  middle_name: string | null
  last_name: string
} | null {
  // Try display_name first (format: "First Middle Last")
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length === 1) {
      return {
        first_name: parts[0],
        middle_name: null,
        last_name: "",
      }
    } else if (parts.length === 2) {
      return {
        first_name: parts[0],
        middle_name: null,
        last_name: parts[1],
      }
    } else if (parts.length >= 3) {
      // Assume format: First Middle1 Middle2... Last
      return {
        first_name: parts[0],
        middle_name: parts.slice(1, -1).join(" "),
        last_name: parts[parts.length - 1],
      }
    }
  }

  // Try sort_name (format: "Last, First Middle")
  if (sortName && sortName.trim()) {
    const parts = sortName.trim().split(",")
    if (parts.length === 2) {
      const lastName = parts[0].trim()
      const firstAndMiddle = parts[1].trim().split(/\s+/)

      if (firstAndMiddle.length === 1) {
        return {
          first_name: firstAndMiddle[0],
          middle_name: null,
          last_name: lastName,
        }
      } else if (firstAndMiddle.length >= 2) {
        return {
          first_name: firstAndMiddle[0],
          middle_name: firstAndMiddle.slice(1).join(" "),
          last_name: lastName,
        }
      }
    } else if (parts.length === 1) {
      // No comma, treat as single name
      const singleParts = sortName.trim().split(/\s+/)
      if (singleParts.length === 1) {
        return {
          first_name: singleParts[0],
          middle_name: null,
          last_name: "",
        }
      } else if (singleParts.length === 2) {
        return {
          first_name: singleParts[0],
          middle_name: null,
          last_name: singleParts[1],
        }
      } else if (singleParts.length >= 3) {
        return {
          first_name: singleParts[0],
          middle_name: singleParts.slice(1, -1).join(" "),
          last_name: singleParts[singleParts.length - 1],
        }
      }
    }
  }

  return null
}

function sanitizeForFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50)
}

function translateMemberToWarrior(member: MkpConnectMember): TranslatedWarrior | null {
  // Parse name
  const parsedName = parseName(member.display_name, member.sort_name)
  if (!parsedName) {
    return null
  }

  // Determine status based on deceased_date
  let status = "active"
  if (member.deceased_date) {
    status = "deceased"
  }

  const now = new Date().toISOString()
  const uuid = randomUUID()

  const warrior: TranslatedWarrior = {
    // Person fields
    id: uuid,
    first_name: parsedName.first_name,
    middle_name: parsedName.middle_name,
    last_name: parsedName.last_name,
    email: member.member_email,
    phone: null,
    billing_address_id: null,
    mailing_address_id: null,
    physical_address_id: null,
    notes: null,
    photo_url: member.image_URL,
    birth_date: member.birth_date,
    deceased_date: member.deceased_date,
    is_active: status !== "deceased",
    created_at: now,
    updated_at: now,
    // Warrior-specific fields
    log_id: null,
    initiation_id: null,
    initiation_on: null,
    status: status,
    training_events: [],
    staffed_events: [],
    lead_events: [],
    mos_events: [],
    area_id: null,
    community_id: null,
    inner_essence_name: member.IEN,
    // Store raw data
    mkpconnect_data: member,
  }

  return warrior
}

function getWarriorKey(member: MkpConnectMember): string {
  // Use civicrm_user_id as primary key
  if (member.civicrm_user_id) {
    return `civicrm:${member.civicrm_user_id}`
  }

  // Fall back to email
  if (member.member_email) {
    return `email:${member.member_email.toLowerCase().trim()}`
  }

  // Fall back to drupal_user_id
  if (member.drupal_user_id) {
    return `drupal:${member.drupal_user_id}`
  }

  // Last resort: use display_name (not ideal)
  if (member.display_name) {
    return `name:${member.display_name.toLowerCase().trim()}`
  }

  return ""
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

  // Determine output hostname
  const outputHostname = hostOverride || "mkp-emma-v3.vercel.app"
  console.log(`Output directory will be based on hostname: ${outputHostname}`)

  // Define paths
  const sourceDir = path.join(__dirname, "data", "mkpconnect.org", "igroups", "membership")
  const outputDir = path.join(__dirname, "data", outputHostname, "warriors")

  console.log(`Reading membership files from: ${sourceDir}`)
  console.log(`Output directory: ${outputDir}`)

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true })

  // Read all membership files
  const membershipFiles = await fs.readdir(sourceDir)
  const jsonFiles = membershipFiles.filter((f) => f.endsWith(".json"))

  if (jsonFiles.length === 0) {
    console.log("No membership files found")
    process.exit(0)
  }

  console.log(`Found ${jsonFiles.length} membership files`)
  console.log(`\nProcessing memberships...\n`)

  // Statistics
  const stats: Stats = {
    totalMembershipsProcessed: 0,
    totalMembersProcessed: 0,
    uniqueWarriorsCreated: 0,
    duplicatesMerged: 0,
    warnings: {
      missingName: 0,
      missingEmail: 0,
      missingCivicrmId: 0,
      nameParsingFailed: 0,
    },
    skipped: 0,
  }

  // Map to deduplicate warriors by key
  const warriorsByKey = new Map<string, TranslatedWarrior>()

  // Process each membership file
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(sourceDir, file)
      const fileContent = await fs.readFile(filePath, "utf-8")
      const membership: MkpConnectIGroupMembership = JSON.parse(fileContent)

      stats.totalMembershipsProcessed++

      for (const member of membership.members) {
        stats.totalMembersProcessed++

        // Get unique key for this member
        const key = getWarriorKey(member)
        if (!key) {
          console.warn(`  ⚠️  Skipping member with no identifiable key: ${JSON.stringify(member)}`)
          stats.skipped++
          continue
        }

        // Track warnings
        if (!member.civicrm_user_id) {
          stats.warnings.missingCivicrmId++
        }
        if (!member.member_email) {
          stats.warnings.missingEmail++
        }
        if (!member.display_name && !member.sort_name) {
          stats.warnings.missingName++
        }

        // Check if we've already seen this warrior
        if (warriorsByKey.has(key)) {
          stats.duplicatesMerged++
          continue
        }

        // Translate member to warrior
        const warrior = translateMemberToWarrior(member)
        if (!warrior) {
          console.warn(`  ⚠️  Failed to parse name for member: ${member.display_name || member.sort_name}`)
          stats.warnings.nameParsingFailed++
          stats.skipped++
          continue
        }

        // Store warrior
        warriorsByKey.set(key, warrior)
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${file}: ${error}`)
      stats.skipped++
    }
  }

  console.log(`\nExtracted ${warriorsByKey.size} unique warriors`)
  console.log(`\nWriting warrior files...\n`)

  // Write each unique warrior to a file
  let writtenCount = 0
  for (const [key, warrior] of warriorsByKey) {
    try {
      // Generate filename
      const displayName = warrior.mkpconnect_data.display_name || warrior.mkpconnect_data.sort_name || "unnamed"
      const sanitizedName = sanitizeForFilename(displayName)
      const uuidPrefix = warrior.id.substring(0, 8)
      const filename = `${sanitizedName}_${uuidPrefix}.json`
      const outputPath = path.join(outputDir, filename)

      // Write file
      const jsonContent = pretty ? JSON.stringify(warrior, null, 2) : JSON.stringify(warrior)
      await fs.writeFile(outputPath, jsonContent, "utf-8")

      writtenCount++
      if (writtenCount % 100 === 0) {
        console.log(`  ✓ Wrote ${writtenCount} warriors...`)
      }
    } catch (error) {
      console.error(`  ✗ Error writing warrior ${key}: ${error}`)
      stats.skipped++
    }
  }

  stats.uniqueWarriorsCreated = writtenCount

  // Print statistics
  console.log(`\n${"=".repeat(60)}`)
  console.log(`✅ Extraction Complete!`)
  console.log(`${"=".repeat(60)}`)
  console.log(`   Membership files processed: ${stats.totalMembershipsProcessed}`)
  console.log(`   Total members found: ${stats.totalMembersProcessed}`)
  console.log(`   Unique warriors created: ${stats.uniqueWarriorsCreated}`)
  console.log(`   Duplicates merged: ${stats.duplicatesMerged}`)
  console.log(``)

  if (
    stats.warnings.missingCivicrmId > 0 ||
    stats.warnings.missingEmail > 0 ||
    stats.warnings.missingName > 0 ||
    stats.warnings.nameParsingFailed > 0 ||
    stats.skipped > 0
  ) {
    console.log(`   ⚠️  Warnings:`)
    if (stats.warnings.missingCivicrmId > 0) {
      console.log(`   - Missing CiviCRM ID: ${stats.warnings.missingCivicrmId} members`)
    }
    if (stats.warnings.missingEmail > 0) {
      console.log(`   - Missing email: ${stats.warnings.missingEmail} members`)
    }
    if (stats.warnings.missingName > 0) {
      console.log(`   - Missing name: ${stats.warnings.missingName} members`)
    }
    if (stats.warnings.nameParsingFailed > 0) {
      console.log(`   - Name parsing failed: ${stats.warnings.nameParsingFailed} members`)
    }
    if (stats.skipped > 0) {
      console.log(`   - Skipped/Failed: ${stats.skipped} members`)
    }
    console.log(``)
  }

  console.log(`   📁 Output directory: ${outputDir}`)
  console.log(`${"=".repeat(60)}\n`)

  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
