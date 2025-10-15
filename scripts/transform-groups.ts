#!/usr/bin/env tsx

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface MkpConnectIGroup {
  mkp_connect_id: number
  igroup_name: string | null
  about: string | null
  igroup_type: string | null
  igroup_status: string | null
  igroup_class: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  state_province: string | null
  country: string | null
  community_name: string | null
  area_name: string | null
  owner_name: string | null
  community_id: number | null
  area_id: number | null
  owner_id: number | null
  meeting_night: string | null
  meeting_time: string | null
  meeting_frequency: string | null
  latitude: string | null
  longitude: string | null
  is_accepting_initiated_visitors: string | null
  is_accepting_uninitiated_visitors: string | null
  is_accepting_new_members: string | null
  igroup_is_private: string | null
  is_public_display: string | null
  igroup_email: string | null
  igroup_is_mixed_gender: string | null
  igroup_mkpi: string | null
  mkp_connect_contact_uid: number | null
  mkp_connect_contact_name: string | null
  mkp_connect_contact_email: string | null
}

interface EventTime {
  start: string
  end: string
}

interface TranslatedGroup {
  id: string
  name: string
  description: string
  url: string | null
  members: string[]
  is_accepting_new_members: boolean
  membership_criteria: string | null
  venue_id: string | null
  genders: string | null
  is_publicly_listed: boolean
  public_contact_id: string | null
  primary_contact_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  mkpconnect_data: MkpConnectIGroup
}

interface TranslatedIGroup extends TranslatedGroup {
  is_accepting_initiated_visitors: boolean
  is_accepting_uninitiated_visitors: boolean
  is_requiring_contact_before_visiting: boolean
  schedule_events: EventTime[]
  schedule_description: string | null
  area_id: string | null
  community_id: string | null
  contact_email: string | null
  status: string | null
  class: string | null
}

interface TranslatedFGroup extends TranslatedGroup {
  group_type: "Men's" | "Mixed Gender" | "Open Men's" | "Closed Men's"
  is_accepting_new_facilitators: boolean
  facilitators: string[]
  is_accepting_initiated_visitors: boolean
  is_accepting_uninitiated_visitors: boolean
  is_requiring_contact_before_visiting: boolean
  schedule_events: EventTime[]
  schedule_description: string | null
  area_id: string | null
  community_id: string | null
  contact_email: string | null
  status: string | null
  class: string | null
}

interface AreaMapping {
  [key: string]: {
    uuid: string
    name: string
    code: string
    mkp_connect_id?: number
  }
}

interface CommunityMapping {
  [key: string]: {
    uuid: string
    name: string
    code: string
    mkp_connect_id?: number
  }
}

interface Stats {
  totalProcessed: number
  iGroupsCreated: number
  fGroupsCreated: number
  fGroupsByType: {
    mens: number
    mixedGender: number
    openMens: number
    closedMens: number
  }
  warnings: {
    missingAreaMapping: number
    missingCommunityMapping: number
    invalidData: number
  }
  skipped: number
}

// Helper Functions

function parseBoolean(value: string | number | null): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim()
    return normalized === "yes" || normalized === "1" || normalized === "true"
  }
  return false
}

function parseContactBoolean(value: string | number | null): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim()
    return normalized === "yes" || normalized === "contact" || normalized === "1" || normalized === "true"
  }
  return false
}

function parseRequiresContact(
  initiatedVisitors: string | null,
  uninitiatedVisitors: string | null,
): boolean {
  if (!initiatedVisitors && !uninitiatedVisitors) return false
  const initiated = initiatedVisitors?.toLowerCase().trim()
  const uninitiated = uninitiatedVisitors?.toLowerCase().trim()
  return initiated === "contact" || uninitiated === "contact"
}

function determineGroupType(data: MkpConnectIGroup): "IGroup" | "FGroup" {
  // Primary classification by igroup_type field
  if (data.igroup_type) {
    const type = data.igroup_type.toLowerCase()
    if (type.includes("i-group") || type === "i group") return "IGroup"
    if (type.includes("f-group") || type === "f group" || type.includes("circle")) return "FGroup"
  }

  // Secondary classification by name patterns
  const name = (data.igroup_name || "").toLowerCase()

  // FGroup patterns (check first as they're more specific)
  if (
    /men'?s\s+circle/i.test(name) ||
    /\bopen\s+circle\b/i.test(name) ||
    /\bclosed\s+circle\b/i.test(name) ||
    /\bcircle\b/i.test(name)
  ) {
    return "FGroup"
  }

  // IGroup patterns (broader, check after FGroup)
  if (/i[\s-]?group/i.test(name) || /\bgroup\b/i.test(name)) {
    return "IGroup"
  }

  // Default to IGroup if unclear
  return "IGroup"
}

function determineFGroupType(data: MkpConnectIGroup): "Men's" | "Mixed Gender" | "Open Men's" | "Closed Men's" {
  const name = (data.igroup_name || "").toLowerCase()
  const isMixedGender = parseBoolean(data.igroup_is_mixed_gender)
  const status = (data.igroup_status || "").toLowerCase()

  // Mixed gender takes precedence
  if (isMixedGender) return "Mixed Gender"

  // Check name patterns
  if (name.includes("open")) return "Open Men's"
  if (name.includes("closed") || status === "closed") return "Closed Men's"

  // Default
  return "Men's"
}

function buildScheduleDescription(
  night: string | null,
  time: string | null,
  frequency: string | null,
): string | null {
  const parts: string[] = []

  if (frequency) parts.push(frequency)
  if (night) parts.push(`on ${night}`)
  if (time) parts.push(`at ${time}`)

  return parts.length > 0 ? parts.join(" ") : null
}

function parseScheduleEvents(
  night: string | null,
  time: string | null,
  frequency: string | null,
): EventTime[] {
  // For now, return empty array
  // TODO: Future enhancement to parse recurring schedule into EventTime objects
  return []
}

function sanitizeForFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50)
}

function lookupAreaId(
  areaName: string | null,
  areaId: number | null,
  areasMap: AreaMapping,
): string | null {
  if (!areaName && !areaId) return null

  // Try lookup by name first
  if (areaName) {
    const entry = areasMap[areaName.toLowerCase().trim()]
    if (entry) return entry.uuid
  }

  // Try lookup by MKP Connect ID
  if (areaId) {
    for (const [, value] of Object.entries(areasMap)) {
      if (value.mkp_connect_id === areaId) {
        return value.uuid
      }
    }
  }

  return null
}

function lookupCommunityId(
  communityName: string | null,
  communityId: number | null,
  communitiesMap: CommunityMapping,
): string | null {
  if (!communityName && !communityId) return null

  // Try lookup by name first
  if (communityName) {
    const entry = communitiesMap[communityName.toLowerCase().trim()]
    if (entry) return entry.uuid
  }

  // Try lookup by MKP Connect ID
  if (communityId) {
    for (const [, value] of Object.entries(communitiesMap)) {
      if (value.mkp_connect_id === communityId) {
        return value.uuid
      }
    }
  }

  return null
}

function createBaseGroup(data: MkpConnectIGroup): TranslatedGroup {
  const now = new Date().toISOString()

  return {
    id: randomUUID(),
    name: data.igroup_name || "Unnamed Group",
    description: data.about || buildScheduleDescription(data.meeting_night, data.meeting_time, data.meeting_frequency) || "",
    url: null,
    members: [],
    is_accepting_new_members: parseBoolean(data.is_accepting_new_members),
    membership_criteria: null,
    venue_id: null, // TODO: Will need venue lookup/creation
    genders: parseBoolean(data.igroup_is_mixed_gender) ? "Mixed Gender" : "Men's",
    is_publicly_listed: parseBoolean(data.is_public_display),
    public_contact_id: null, // TODO: Will need person lookup/creation
    primary_contact_id: null, // TODO: Will need person lookup/creation
    is_active: (data.igroup_status || "").toLowerCase() !== "closed",
    created_at: now,
    updated_at: now,
    deleted_at: null,
    mkpconnect_data: data,
  }
}

function translateToIGroup(
  data: MkpConnectIGroup,
  areasMap: AreaMapping,
  communitiesMap: CommunityMapping,
): TranslatedIGroup {
  const baseGroup = createBaseGroup(data)

  return {
    ...baseGroup,
    is_accepting_initiated_visitors: parseContactBoolean(data.is_accepting_initiated_visitors),
    is_accepting_uninitiated_visitors: parseContactBoolean(data.is_accepting_uninitiated_visitors),
    is_requiring_contact_before_visiting: parseRequiresContact(
      data.is_accepting_initiated_visitors,
      data.is_accepting_uninitiated_visitors,
    ),
    schedule_events: parseScheduleEvents(data.meeting_night, data.meeting_time, data.meeting_frequency),
    schedule_description: buildScheduleDescription(data.meeting_night, data.meeting_time, data.meeting_frequency),
    area_id: lookupAreaId(data.area_name, data.area_id, areasMap),
    community_id: lookupCommunityId(data.community_name, data.community_id, communitiesMap),
    contact_email: data.igroup_email,
    status: data.igroup_status,
    class: data.igroup_class,
  }
}

function translateToFGroup(
  data: MkpConnectIGroup,
  areasMap: AreaMapping,
  communitiesMap: CommunityMapping,
): TranslatedFGroup {
  const baseGroup = createBaseGroup(data)

  return {
    ...baseGroup,
    group_type: determineFGroupType(data),
    is_accepting_new_facilitators: parseBoolean(data.is_accepting_new_members),
    facilitators: [],
    is_accepting_initiated_visitors: parseContactBoolean(data.is_accepting_initiated_visitors),
    is_accepting_uninitiated_visitors: parseContactBoolean(data.is_accepting_uninitiated_visitors),
    is_requiring_contact_before_visiting: parseRequiresContact(
      data.is_accepting_initiated_visitors,
      data.is_accepting_uninitiated_visitors,
    ),
    schedule_events: parseScheduleEvents(data.meeting_night, data.meeting_time, data.meeting_frequency),
    schedule_description: buildScheduleDescription(data.meeting_night, data.meeting_time, data.meeting_frequency),
    area_id: lookupAreaId(data.area_name, data.area_id, areasMap),
    community_id: lookupCommunityId(data.community_name, data.community_id, communitiesMap),
    contact_email: data.igroup_email,
    status: data.igroup_status,
    class: data.igroup_class,
  }
}

async function loadMappings(
  targetHost: string,
): Promise<{ areasMap: AreaMapping; communitiesMap: CommunityMapping }> {
  const areasMap: AreaMapping = {}
  const communitiesMap: CommunityMapping = {}

  // Load areas
  const areasDir = path.join(__dirname, "data", targetHost, "areas")
  try {
    const areaFiles = await fs.readdir(areasDir)
    for (const file of areaFiles) {
      if (!file.endsWith(".json")) continue
      const filePath = path.join(areasDir, file)
      const content = await fs.readFile(filePath, "utf-8")
      const area = JSON.parse(content)
      const key = area.name.toLowerCase().trim()
      areasMap[key] = {
        uuid: area.id,
        name: area.name,
        code: area.code,
        mkp_connect_id: area.mkpconnect_data?.area_id || undefined,
      }
    }
    console.log(`  Loaded ${Object.keys(areasMap).length} area mappings`)
  } catch (error) {
    console.warn(`  Warning: Could not load area mappings: ${error}`)
  }

  // Load communities
  const communitiesDir = path.join(__dirname, "data", targetHost, "communities")
  try {
    const communityFiles = await fs.readdir(communitiesDir)
    for (const file of communityFiles) {
      if (!file.endsWith(".json")) continue
      const filePath = path.join(communitiesDir, file)
      const content = await fs.readFile(filePath, "utf-8")
      const community = JSON.parse(content)
      const key = community.name.toLowerCase().trim()
      communitiesMap[key] = {
        uuid: community.id,
        name: community.name,
        code: community.code,
        mkp_connect_id: community.mkpconnect_data?.community_id || undefined,
      }
    }
    console.log(`  Loaded ${Object.keys(communitiesMap).length} community mappings`)
  } catch (error) {
    console.warn(`  Warning: Could not load community mappings: ${error}`)
  }

  return { areasMap, communitiesMap }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let pretty = false
  let dryRun = false
  let targetHost = "mkp-emma-v3.vercel.app"
  let sourceHost = "mkpconnect.org"

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--host") {
      if (i + 1 < args.length) {
        targetHost = args[i + 1]
        i++
      }
    } else if (arg === "--source-host") {
      if (i + 1 < args.length) {
        sourceHost = args[i + 1]
        i++
      }
    } else if (!arg.startsWith("--")) {
      envFilePath = arg
    }
  }

  // Load environment (if needed for future use)
  const envPath = path.isAbsolute(envFilePath) ? envFilePath : path.resolve(process.cwd(), envFilePath)
  config({ path: envPath })

  console.log(`\n🔄 MKP Connect to Emma v3 Group Translation`)
  console.log(`   Source: ${sourceHost}`)
  console.log(`   Target: ${targetHost}`)
  if (dryRun) console.log(`   Mode: DRY RUN (no files will be written)\n`)
  else console.log("")

  // Load area and community mappings
  console.log("Loading reference data...")
  const { areasMap, communitiesMap } = await loadMappings(targetHost)

  // Initialize stats
  const stats: Stats = {
    totalProcessed: 0,
    iGroupsCreated: 0,
    fGroupsCreated: 0,
    fGroupsByType: {
      mens: 0,
      mixedGender: 0,
      openMens: 0,
      closedMens: 0,
    },
    warnings: {
      missingAreaMapping: 0,
      missingCommunityMapping: 0,
      invalidData: 0,
    },
    skipped: 0,
  }

  // Read source files
  const sourceDir = path.join(__dirname, "data", sourceHost, "igroups")
  console.log(`\nReading source files from: ${sourceDir}`)

  let sourceFiles: string[]
  try {
    sourceFiles = await fs.readdir(sourceDir)
    sourceFiles = sourceFiles.filter((f) => f.endsWith(".json"))
    console.log(`Found ${sourceFiles.length} source files\n`)
  } catch (error) {
    console.error(`Error reading source directory: ${error}`)
    process.exit(1)
  }

  // Create output directories
  const iGroupsDir = path.join(__dirname, "data", targetHost, "i-groups")
  const fGroupsDir = path.join(__dirname, "data", targetHost, "f-groups")

  if (!dryRun) {
    await fs.mkdir(iGroupsDir, { recursive: true })
    await fs.mkdir(fGroupsDir, { recursive: true })
  }

  // Process each file
  console.log("Processing groups...")
  for (const file of sourceFiles) {
    try {
      const filePath = path.join(sourceDir, file)
      const content = await fs.readFile(filePath, "utf-8")
      const data: MkpConnectIGroup = JSON.parse(content)

      stats.totalProcessed++

      // Determine group type
      const groupType = determineGroupType(data)

      let translated: TranslatedIGroup | TranslatedFGroup
      let outputDir: string
      let typeLabel: string

      if (groupType === "IGroup") {
        translated = translateToIGroup(data, areasMap, communitiesMap)
        outputDir = iGroupsDir
        typeLabel = "IGroup"
        stats.iGroupsCreated++
      } else {
        translated = translateToFGroup(data, areasMap, communitiesMap)
        outputDir = fGroupsDir
        typeLabel = "FGroup"
        stats.fGroupsCreated++

        // Track FGroup sub-types
        const fgroup = translated as TranslatedFGroup
        switch (fgroup.group_type) {
          case "Men's":
            stats.fGroupsByType.mens++
            break
          case "Mixed Gender":
            stats.fGroupsByType.mixedGender++
            break
          case "Open Men's":
            stats.fGroupsByType.openMens++
            break
          case "Closed Men's":
            stats.fGroupsByType.closedMens++
            break
        }
      }

      // Track warnings
      if (data.area_name && !translated.area_id) {
        stats.warnings.missingAreaMapping++
      }
      if (data.community_name && !translated.community_id) {
        stats.warnings.missingCommunityMapping++
      }

      // Generate filename
      const sanitizedName = sanitizeForFilename(data.igroup_name || "unnamed")
      const uuidPrefix = translated.id.substring(0, 8)
      const filename = `${sanitizedName}_${uuidPrefix}.json`
      const outputPath = path.join(outputDir, filename)

      // Write file
      if (!dryRun) {
        const jsonContent = pretty ? JSON.stringify(translated, null, 2) : JSON.stringify(translated)
        await fs.writeFile(outputPath, jsonContent, "utf-8")
      }

      console.log(`  ✓ ${typeLabel}: ${data.igroup_name} → ${filename}`)
    } catch (error) {
      console.error(`  ✗ Error processing ${file}: ${error}`)
      stats.skipped++
    }
  }

  // Print statistics
  console.log(`\n${"=".repeat(60)}`)
  console.log(`✅ Translation Complete!`)
  console.log(`${"=".repeat(60)}`)
  console.log(`   Total files processed: ${stats.totalProcessed}`)
  console.log(``)
  console.log(`   IGroups created: ${stats.iGroupsCreated}`)
  console.log(`   FGroups created: ${stats.fGroupsCreated}`)
  console.log(``)
  console.log(`   FGroup breakdown:`)
  console.log(`   - Men's: ${stats.fGroupsByType.mens}`)
  console.log(`   - Mixed Gender: ${stats.fGroupsByType.mixedGender}`)
  console.log(`   - Open Men's: ${stats.fGroupsByType.openMens}`)
  console.log(`   - Closed Men's: ${stats.fGroupsByType.closedMens}`)
  console.log(``)

  if (
    stats.warnings.missingAreaMapping > 0 ||
    stats.warnings.missingCommunityMapping > 0 ||
    stats.skipped > 0
  ) {
    console.log(`   ⚠️  Warnings:`)
    if (stats.warnings.missingAreaMapping > 0) {
      console.log(`   - Missing area mapping: ${stats.warnings.missingAreaMapping} groups`)
    }
    if (stats.warnings.missingCommunityMapping > 0) {
      console.log(`   - Missing community mapping: ${stats.warnings.missingCommunityMapping} groups`)
    }
    if (stats.skipped > 0) {
      console.log(`   - Skipped/Failed: ${stats.skipped} files`)
    }
    console.log(``)
  }

  if (!dryRun) {
    console.log(`   📁 Output directories:`)
    console.log(`   - IGroups: ${iGroupsDir}`)
    console.log(`   - FGroups: ${fGroupsDir}`)
  } else {
    console.log(`   (Dry run - no files were written)`)
  }

  console.log(`${"=".repeat(60)}\n`)

  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
