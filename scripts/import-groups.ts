#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { config } from "dotenv"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface EventTime {
  start: string
  end: string
}

interface ImportedGroup {
  // Core fields
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
  latitude: number | null
  longitude: number | null
  mkpconnect_data: any
}

interface ImportedIGroup extends ImportedGroup {
  is_accepting_initiated_visitors: boolean
  is_accepting_uninitiated_visitors: boolean
  is_requiring_contact_before_visiting: boolean
  schedule_events: EventTime[]
  schedule_description: string | null
  area_id: string | null
  community_id: string | null
  contact_email: string | null
  status: string | null
  affiliation: string | null
}

interface ImportedFGroup extends ImportedGroup {
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
  affiliation: string | null
}

interface ImportStats {
  iGroups: {
    imported: number
    updated: number
    skipped: number
    errors: number
  }
  fGroups: {
    imported: number
    updated: number
    skipped: number
    errors: number
  }
}

async function validateForeignKeys(
  group: ImportedIGroup | ImportedFGroup,
  supabase: any,
  filename: string
): Promise<string | null> {
  // Validate venue_id
  if (group.venue_id) {
    const { data: venue } = await supabase.from("venues").select("id").eq("id", group.venue_id).single()
    if (!venue) {
      return `Venue with id ${group.venue_id} not found in venues table`
    }
  }

  // Validate public_contact_id
  if (group.public_contact_id) {
    const { data: contact } = await supabase
      .from("people")
      .select("id")
      .eq("id", group.public_contact_id)
      .single()
    if (!contact) {
      return `Public contact with id ${group.public_contact_id} not found in people table`
    }
  }

  // Validate primary_contact_id
  if (group.primary_contact_id) {
    const { data: contact } = await supabase
      .from("people")
      .select("id")
      .eq("id", group.primary_contact_id)
      .single()
    if (!contact) {
      return `Primary contact with id ${group.primary_contact_id} not found in people table`
    }
  }

  // Validate area_id (IGroup/FGroup specific)
  if (group.area_id) {
    const { data: area } = await supabase.from("areas").select("id").eq("id", group.area_id).single()
    if (!area) {
      return `Area with id ${group.area_id} not found in areas table`
    }
  }

  // Validate community_id (IGroup/FGroup specific)
  if (group.community_id) {
    const { data: community } = await supabase
      .from("communities")
      .select("id")
      .eq("id", group.community_id)
      .single()
    if (!community) {
      return `Community with id ${group.community_id} not found in communities table`
    }
  }

  return null
}

async function importIGroup(
  igroup: ImportedIGroup,
  supabase: any,
  filename: string,
  force: boolean,
  stats: ImportStats
): Promise<void> {
  // Validate foreign keys
  const validationError = await validateForeignKeys(igroup, supabase, filename)
  if (validationError) {
    console.error(`  ✗ ${filename}: ${validationError}`)
    stats.iGroups.errors++
    return
  }

  // Check if group already exists
  const { data: existingGroup } = await supabase.from("groups").select("id, name").eq("id", igroup.id).single()

  if (existingGroup && !force) {
    console.log(`  ⊘ Skipped IGroup: ${filename} (${igroup.name}) - already exists (use --force to update)`)
    stats.iGroups.skipped++
    return
  }

  if (existingGroup && force) {
    // Update existing group
    const { error: updateGroupError } = await supabase
      .from("groups")
      .update({
        name: igroup.name,
        description: igroup.description,
        url: igroup.url,
        members: igroup.members,
        is_accepting_new_members: igroup.is_accepting_new_members,
        membership_criteria: igroup.membership_criteria,
        venue_id: igroup.venue_id,
        genders: igroup.genders,
        is_publicly_listed: igroup.is_publicly_listed,
        public_contact_id: igroup.public_contact_id,
        primary_contact_id: igroup.primary_contact_id,
        is_active: igroup.is_active,
        deleted_at: igroup.deleted_at,
        latitude: igroup.latitude,
        longitude: igroup.longitude,
        mkpconnect_data: igroup.mkpconnect_data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", igroup.id)

    if (updateGroupError) {
      console.error(`  ✗ Error updating group for ${filename}: ${updateGroupError.message}`)
      stats.iGroups.errors++
      return
    }

    // Update i_groups record
    const { error: updateIGroupError } = await supabase
      .from("i_groups")
      .update({
        is_accepting_initiated_visitors: igroup.is_accepting_initiated_visitors,
        is_accepting_uninitiated_visitors: igroup.is_accepting_uninitiated_visitors,
        is_requiring_contact_before_visiting: igroup.is_requiring_contact_before_visiting,
        schedule_events: igroup.schedule_events,
        schedule_description: igroup.schedule_description,
        area_id: igroup.area_id,
        community_id: igroup.community_id,
        contact_email: igroup.contact_email,
        status: igroup.status,
        affiliation: igroup.affiliation,
        is_active: igroup.is_active,
        deleted_at: igroup.deleted_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", igroup.id)

    if (updateIGroupError) {
      console.error(`  ✗ Error updating i_group for ${filename}: ${updateIGroupError.message}`)
      stats.iGroups.errors++
      return
    }

    console.log(`  ↻ Updated IGroup: ${filename} (${igroup.name})`)
    stats.iGroups.updated++
  } else {
    // Insert new group
    const { error: insertGroupError } = await supabase.from("groups").insert({
      id: igroup.id,
      name: igroup.name,
      description: igroup.description,
      url: igroup.url,
      members: igroup.members,
      is_accepting_new_members: igroup.is_accepting_new_members,
      membership_criteria: igroup.membership_criteria,
      venue_id: igroup.venue_id,
      genders: igroup.genders,
      is_publicly_listed: igroup.is_publicly_listed,
      public_contact_id: igroup.public_contact_id,
      primary_contact_id: igroup.primary_contact_id,
      is_active: igroup.is_active,
      created_at: igroup.created_at,
      updated_at: igroup.updated_at,
      deleted_at: igroup.deleted_at,
      latitude: igroup.latitude,
      longitude: igroup.longitude,
      mkpconnect_data: igroup.mkpconnect_data,
    })

    if (insertGroupError) {
      console.error(`  ✗ Error inserting group for ${filename}: ${insertGroupError.message}`)
      stats.iGroups.errors++
      return
    }

    // Insert i_groups record
    const { error: insertIGroupError } = await supabase.from("i_groups").insert({
      id: igroup.id,
      is_accepting_initiated_visitors: igroup.is_accepting_initiated_visitors,
      is_accepting_uninitiated_visitors: igroup.is_accepting_uninitiated_visitors,
      is_requiring_contact_before_visiting: igroup.is_requiring_contact_before_visiting,
      schedule_events: igroup.schedule_events,
      schedule_description: igroup.schedule_description,
      area_id: igroup.area_id,
      community_id: igroup.community_id,
      contact_email: igroup.contact_email,
      status: igroup.status,
      affiliation: igroup.affiliation,
      is_active: igroup.is_active,
      created_at: igroup.created_at,
      updated_at: igroup.updated_at,
      deleted_at: igroup.deleted_at,
    })

    if (insertIGroupError) {
      console.error(`  ✗ Error inserting i_group for ${filename}: ${insertIGroupError.message}`)
      stats.iGroups.errors++
      return
    }

    console.log(`  ✓ Imported IGroup: ${filename} (${igroup.name})`)
    stats.iGroups.imported++
  }
}

async function importFGroup(
  fgroup: ImportedFGroup,
  supabase: any,
  filename: string,
  force: boolean,
  stats: ImportStats
): Promise<void> {
  // Validate foreign keys
  const validationError = await validateForeignKeys(fgroup, supabase, filename)
  if (validationError) {
    console.error(`  ✗ ${filename}: ${validationError}`)
    stats.fGroups.errors++
    return
  }

  // Check if group already exists
  const { data: existingGroup } = await supabase.from("groups").select("id, name").eq("id", fgroup.id).single()

  if (existingGroup && !force) {
    console.log(`  ⊘ Skipped FGroup: ${filename} (${fgroup.name}) - already exists (use --force to update)`)
    stats.fGroups.skipped++
    return
  }

  if (existingGroup && force) {
    // Update existing group
    const { error: updateGroupError } = await supabase
      .from("groups")
      .update({
        name: fgroup.name,
        description: fgroup.description,
        url: fgroup.url,
        members: fgroup.members,
        is_accepting_new_members: fgroup.is_accepting_new_members,
        membership_criteria: fgroup.membership_criteria,
        venue_id: fgroup.venue_id,
        genders: fgroup.genders,
        is_publicly_listed: fgroup.is_publicly_listed,
        public_contact_id: fgroup.public_contact_id,
        primary_contact_id: fgroup.primary_contact_id,
        is_active: fgroup.is_active,
        deleted_at: fgroup.deleted_at,
        latitude: fgroup.latitude,
        longitude: fgroup.longitude,
        mkpconnect_data: fgroup.mkpconnect_data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fgroup.id)

    if (updateGroupError) {
      console.error(`  ✗ Error updating group for ${filename}: ${updateGroupError.message}`)
      stats.fGroups.errors++
      return
    }

    // Update f_groups record
    const { error: updateFGroupError } = await supabase
      .from("f_groups")
      .update({
        group_type: fgroup.group_type,
        is_accepting_new_facilitators: fgroup.is_accepting_new_facilitators,
        facilitators: fgroup.facilitators,
        is_accepting_initiated_visitors: fgroup.is_accepting_initiated_visitors,
        is_accepting_uninitiated_visitors: fgroup.is_accepting_uninitiated_visitors,
        is_requiring_contact_before_visiting: fgroup.is_requiring_contact_before_visiting,
        schedule_events: fgroup.schedule_events,
        schedule_description: fgroup.schedule_description,
        area_id: fgroup.area_id,
        community_id: fgroup.community_id,
        contact_email: fgroup.contact_email,
        status: fgroup.status,
        affiliation: fgroup.affiliation,
        is_active: fgroup.is_active,
        deleted_at: fgroup.deleted_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fgroup.id)

    if (updateFGroupError) {
      console.error(`  ✗ Error updating f_group for ${filename}: ${updateFGroupError.message}`)
      stats.fGroups.errors++
      return
    }

    console.log(`  ↻ Updated FGroup: ${filename} (${fgroup.name})`)
    stats.fGroups.updated++
  } else {
    // Insert new group
    const { error: insertGroupError } = await supabase.from("groups").insert({
      id: fgroup.id,
      name: fgroup.name,
      description: fgroup.description,
      url: fgroup.url,
      members: fgroup.members,
      is_accepting_new_members: fgroup.is_accepting_new_members,
      membership_criteria: fgroup.membership_criteria,
      venue_id: fgroup.venue_id,
      genders: fgroup.genders,
      is_publicly_listed: fgroup.is_publicly_listed,
      public_contact_id: fgroup.public_contact_id,
      primary_contact_id: fgroup.primary_contact_id,
      is_active: fgroup.is_active,
      created_at: fgroup.created_at,
      updated_at: fgroup.updated_at,
      deleted_at: fgroup.deleted_at,
      latitude: fgroup.latitude,
      longitude: fgroup.longitude,
      mkpconnect_data: fgroup.mkpconnect_data,
    })

    if (insertGroupError) {
      console.error(`  ✗ Error inserting group for ${filename}: ${insertGroupError.message}`)
      stats.fGroups.errors++
      return
    }

    // Insert f_groups record
    const { error: insertFGroupError } = await supabase.from("f_groups").insert({
      id: fgroup.id,
      group_type: fgroup.group_type,
      is_accepting_new_facilitators: fgroup.is_accepting_new_facilitators,
      facilitators: fgroup.facilitators,
      is_accepting_initiated_visitors: fgroup.is_accepting_initiated_visitors,
      is_accepting_uninitiated_visitors: fgroup.is_accepting_uninitiated_visitors,
      is_requiring_contact_before_visiting: fgroup.is_requiring_contact_before_visiting,
      schedule_events: fgroup.schedule_events,
      schedule_description: fgroup.schedule_description,
      area_id: fgroup.area_id,
      community_id: fgroup.community_id,
      contact_email: fgroup.contact_email,
      status: fgroup.status,
      affiliation: fgroup.affiliation,
      is_active: fgroup.is_active,
      created_at: fgroup.created_at,
      updated_at: fgroup.updated_at,
      deleted_at: fgroup.deleted_at,
    })

    if (insertFGroupError) {
      console.error(`  ✗ Error inserting f_group for ${filename}: ${insertFGroupError.message}`)
      stats.fGroups.errors++
      return
    }

    console.log(`  ✓ Imported FGroup: ${filename} (${fgroup.name})`)
    stats.fGroups.imported++
  }
}

function isIGroup(group: any): group is ImportedIGroup {
  // Check if it has IGroup-specific fields
  return "is_accepting_initiated_visitors" in group && !("group_type" in group)
}

function isFGroup(group: any): group is ImportedFGroup {
  // Check if it has FGroup-specific field
  return "group_type" in group
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let envFilePath = ".env"
  let force = false
  let hostOverride: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--force") {
      force = true
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

  // Load environment variables from specified .env file
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

  console.log(`Connecting to Supabase at: ${supabaseUrl}`)
  console.log(`Force mode: ${force ? "enabled (will update existing groups)" : "disabled (will skip duplicates)"}`)

  // Determine the input hostname
  const inputHostname = hostOverride || process.env.HOSTNAME || "mkp-emma-v3.vercel.app"
  console.log(`Input directory will be based on hostname: ${inputHostname}`)

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Initialize stats
  const stats: ImportStats = {
    iGroups: {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    fGroups: {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
  }

  // Process IGroups
  const iGroupsDir = path.join(__dirname, "data", inputHostname, "i-groups")
  console.log(`\nReading IGroup files from: ${iGroupsDir}`)

  let iGroupFiles: string[] = []
  try {
    iGroupFiles = await fs.readdir(iGroupsDir)
    iGroupFiles = iGroupFiles.filter((f) => f.endsWith(".json"))
    console.log(`Found ${iGroupFiles.length} IGroup files to import\n`)
  } catch (error: any) {
    console.warn(`Warning: Could not read IGroups directory: ${error.message}`)
  }

  for (const filename of iGroupFiles) {
    const filepath = path.join(iGroupsDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let igroup: ImportedIGroup
    try {
      igroup = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      stats.iGroups.errors++
      continue
    }

    if (!isIGroup(igroup)) {
      console.error(`  ✗ ${filename}: Not a valid IGroup structure`)
      stats.iGroups.errors++
      continue
    }

    await importIGroup(igroup, supabase, filename, force, stats)
  }

  // Process FGroups
  const fGroupsDir = path.join(__dirname, "data", inputHostname, "f-groups")
  console.log(`\nReading FGroup files from: ${fGroupsDir}`)

  let fGroupFiles: string[] = []
  try {
    fGroupFiles = await fs.readdir(fGroupsDir)
    fGroupFiles = fGroupFiles.filter((f) => f.endsWith(".json"))
    console.log(`Found ${fGroupFiles.length} FGroup files to import\n`)
  } catch (error: any) {
    console.warn(`Warning: Could not read FGroups directory: ${error.message}`)
  }

  for (const filename of fGroupFiles) {
    const filepath = path.join(fGroupsDir, filename)
    const content = await fs.readFile(filepath, "utf-8")

    let fgroup: ImportedFGroup
    try {
      fgroup = JSON.parse(content)
    } catch (error: any) {
      console.error(`  ✗ Error parsing ${filename}: ${error.message}`)
      stats.fGroups.errors++
      continue
    }

    if (!isFGroup(fgroup)) {
      console.error(`  ✗ ${filename}: Not a valid FGroup structure`)
      stats.fGroups.errors++
      continue
    }

    await importFGroup(fgroup, supabase, filename, force, stats)
  }

  // Print summary
  console.log(`\n${"=".repeat(60)}`)
  console.log(`📊 Import Summary`)
  console.log(`${"=".repeat(60)}`)
  console.log(`\n  IGroups:`)
  console.log(`    ✓ Imported: ${stats.iGroups.imported}`)
  if (stats.iGroups.updated > 0) console.log(`    ↻ Updated: ${stats.iGroups.updated}`)
  if (stats.iGroups.skipped > 0) console.log(`    ⊘ Skipped: ${stats.iGroups.skipped}`)
  if (stats.iGroups.errors > 0) console.log(`    ✗ Errors: ${stats.iGroups.errors}`)

  console.log(`\n  FGroups:`)
  console.log(`    ✓ Imported: ${stats.fGroups.imported}`)
  if (stats.fGroups.updated > 0) console.log(`    ↻ Updated: ${stats.fGroups.updated}`)
  if (stats.fGroups.skipped > 0) console.log(`    ⊘ Skipped: ${stats.fGroups.skipped}`)
  if (stats.fGroups.errors > 0) console.log(`    ✗ Errors: ${stats.fGroups.errors}`)

  const totalImported = stats.iGroups.imported + stats.fGroups.imported
  const totalUpdated = stats.iGroups.updated + stats.fGroups.updated
  const totalSkipped = stats.iGroups.skipped + stats.fGroups.skipped
  const totalErrors = stats.iGroups.errors + stats.fGroups.errors

  console.log(`\n  Total:`)
  console.log(`    ✓ Imported: ${totalImported}`)
  if (totalUpdated > 0) console.log(`    ↻ Updated: ${totalUpdated}`)
  if (totalSkipped > 0) console.log(`    ⊘ Skipped: ${totalSkipped}`)
  if (totalErrors > 0) console.log(`    ✗ Errors: ${totalErrors}`)

  console.log(`\n${"=".repeat(60)}`)
  console.log(`✅ Import complete!`)
  console.log(`${"=".repeat(60)}\n`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
