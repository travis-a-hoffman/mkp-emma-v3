# Scripts

This directory contains utility scripts for managing EMMA v3 data.

## Data Export/Import Scripts

Scripts for migrating data between Supabase PostgreSQL databases. Available for:
- **Addresses** - Physical and mailing addresses
- **Areas** - Geographic areas with admins
- **Communities** - Communities within areas
- **People** - Individual people/contacts (with optional filtering by relationship)
- **Venues** - Event venues with location and contact information

### Files

**Addresses:**
- **`export-addresses.ts`** - Exports addresses from a Supabase database to JSON files
- **`import-addresses.ts`** - Imports addresses from JSON files to a Supabase database
- **`data/addresses/`** - Directory where exported JSON files are stored (one file per address, named by city-state-postal + ID)

**Areas:**
- **`export-areas.ts`** - Exports areas from a Supabase database to JSON files
- **`import-areas.ts`** - Imports areas from JSON files to a Supabase database
- **`data/areas/`** - Directory where exported JSON files are stored (one file per area, named by area code)

**Communities:**
- **`export-communities.ts`** - Exports communities from a Supabase database to JSON files
- **`import-communities.ts`** - Imports communities from JSON files to a Supabase database
- **`data/communities/`** - Directory where exported JSON files are stored (one file per community, named by community code)

**People:**
- **`export-people.ts`** - Exports people from a Supabase database to JSON files (supports filtering by `--areas`, `--communities`, `--venues`)
- **`import-people.ts`** - Imports people from JSON files to a Supabase database
- **`data/people/`** - Directory where exported JSON files are stored (one file per person, named by lastname_firstname + ID)

**Venues:**
- **`export-venues.ts`** - Exports venues from a Supabase database to JSON files
- **`import-venues.ts`** - Imports venues from JSON files to a Supabase database
- **`data/venues/`** - Directory where exported JSON files are stored (one file per venue, named by sanitized venue name + ID)

### Prerequisites

Both scripts require a `.env` file with the following variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Export Scripts

Export data from a Supabase database to individual JSON files.

**Usage:**

```bash
# Addresses
pnpm export:addresses [.env file] [--pretty]

# Areas
pnpm export:areas [.env file] [--pretty]

# Communities
pnpm export:communities [.env file] [--pretty]

# People (with optional filtering)
pnpm export:people [.env file] [--pretty] [--areas] [--communities] [--venues]

# Venues
pnpm export:venues [.env file] [--pretty]

# Examples:
pnpm export:addresses .env.source --pretty
pnpm export:areas .env.source --pretty
pnpm export:communities .env.production
pnpm export:people .env.source --pretty
pnpm export:people .env.source --areas --communities  # Only people referenced by areas and communities
pnpm export:venues --pretty
```

**What each exports:**

- **Addresses:** All address fields (address_1, address_2, city, state, postal_code, country) and timestamps
- **Areas:** All area fields, timestamps, foreign keys (steward_id, finance_coordinator_id), geo_json, and related `area_admins` data
- **Communities:** All community fields, timestamps, foreign keys (area_id, coordinator_id), and geo_json
- **People:** All people fields, timestamps, foreign keys (billing_address_id, mailing_address_id, physical_address_id), notes, photo_url
  - **Filtering options** (additive):
    - `--areas`: Export only people referenced by areas (steward_id, finance_coordinator_id, area_admins)
    - `--communities`: Export only people referenced by communities (coordinator_id)
    - `--venues`: Export only people referenced by venues (primary_contact_id)
    - Multiple filters can be combined to export the union of all referenced people
    - Without filters: exports all people
- **Venues:** All venue fields, timestamps, foreign keys (area_id, community_id, mailing_address_id, physical_address_id, primary_contact_id), event_types, and location data

**Output:**
- Addresses: `scripts/data/addresses/{city}_{state}_{postal}_{id}.json`
- Areas: `scripts/data/areas/{area-code}.json`
- Communities: `scripts/data/communities/{community-code}.json`
- People: `scripts/data/people/{lastname}_{firstname}_{id}.json`
- Venues: `scripts/data/venues/{sanitized-name}_{id}.json`

### Import Scripts

Import data from JSON files to a Supabase database.

**Usage:**

```bash
# Addresses
pnpm import:addresses [.env file] [--force]

# Areas
pnpm import:areas [.env file] [--force]

# Communities
pnpm import:communities [.env file] [--force]

# People
pnpm import:people [.env file] [--force]

# Venues
pnpm import:venues [.env file] [--force]

# Examples:
pnpm import:addresses .env.target
pnpm import:areas .env.target --force
pnpm import:communities .env.staging
pnpm import:people .env.target
pnpm import:venues .env.target
```

**Features:**

- **Validation**: Checks that all foreign key references exist before importing:
  - **Addresses:** No foreign keys (standalone table)
  - **Areas:** steward_id, finance_coordinator_id, person_ids (in area_admins) → `people` table
  - **Communities:** area_id → `areas` table, coordinator_id → `people` table
  - **People:** billing_address_id, mailing_address_id, physical_address_id → `addresses` table
  - **Venues:** area_id → `areas`, community_id → `communities`, primary_contact_id → `people`, mailing_address_id/physical_address_id → `addresses`
- **Conflict handling**:
  - Default: Skips records that already exist with a warning
  - `--force` flag: Updates existing records with new data
  - **Areas/Communities:** Matched by `code` field
  - **Addresses/People/Venues:** Matched by `id` field (no unique code)
- **Related data**: For areas, imports `area_admins` relationships
- **Error reporting**: Clear feedback on imported, skipped, updated, and failed records

**Import Summary Example:**

```
📊 Import Summary:
  ✓ Imported: 25
  ↻ Updated: 3
  ⊘ Skipped: 2
  ✗ Errors: 0

✅ Import complete!
```

## Database Schema

The scripts work with the following tables:

### Addresses
- `addresses` - Standalone addresses table (no foreign keys)

**Addresses Table Structure:**
```sql
- id (uuid)
- address_1 (text)
- address_2 (text)
- city (text)
- state (text)
- postal_code (text)
- country (text)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp)
```

### Areas
- `areas` - Main areas table
- `area_admins` - Junction table linking areas to people who are admins
- `people` - Referenced by steward_id, finance_coordinator_id, and area_admins

**Areas Table Structure:**
```sql
- id (uuid)
- name (text)
- code (text, max 6 chars, unique)
- description (text)
- color (text)
- is_active (boolean)
- image_url (text)
- steward_id (uuid, FK to people)
- finance_coordinator_id (uuid, FK to people)
- geo_json (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp)
```

### Communities
- `communities` - Main communities table
- `areas` - Referenced by area_id
- `people` - Referenced by coordinator_id

**Communities Table Structure:**
```sql
- id (uuid)
- name (text)
- code (varchar(6), unique)
- description (text)
- area_id (uuid, FK to areas)
- coordinator_id (uuid, FK to people)
- image_url (text)
- is_active (boolean)
- geo_json (jsonb)
- color (text)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp)
```

### People
- `people` - Main people table
- `addresses` - Referenced by billing_address_id, mailing_address_id, physical_address_id

**People Table Structure:**
```sql
- id (uuid)
- first_name (text)
- middle_name (text)
- last_name (text)
- email (text)
- phone (text)
- billing_address_id (uuid, FK to addresses)
- mailing_address_id (uuid, FK to addresses)
- physical_address_id (uuid, FK to addresses)
- notes (text)
- photo_url (text)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp)
```

### Venues
- `venues` - Main venues table
- `areas` - Referenced by area_id
- `communities` - Referenced by community_id
- `people` - Referenced by primary_contact_id
- `addresses` - Referenced by mailing_address_id and physical_address_id

**Venues Table Structure:**
```sql
- id (uuid)
- name (text)
- description (text)
- email (text)
- phone (text)
- website (text)
- mailing_address_id (uuid, FK to addresses)
- physical_address_id (uuid, FK to addresses)
- event_types (jsonb)
- primary_contact_id (uuid, FK to people)
- latitude (numeric(10, 8))
- longitude (numeric(11, 8))
- is_nudity (boolean)
- is_rejected (boolean)
- is_active (boolean)
- area_id (uuid, FK to areas)
- community_id (uuid, FK to communities)
- nudity_note (text)
- rejected_note (text)
- timezone (varchar(50))
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp)
```

## Typical Workflow

### Migrating All Data

When migrating between databases, follow this order to respect foreign key dependencies:

1. **Export from source database:**
   ```bash
   pnpm export:addresses .env.production --pretty
   pnpm export:people .env.production --pretty
   pnpm export:areas .env.production --pretty
   pnpm export:communities .env.production --pretty
   pnpm export:venues .env.production --pretty
   ```

2. **Review exported JSON files** in `scripts/data/{addresses,people,areas,communities,venues}/`

3. **Import to target database** (in dependency order):
   ```bash
   # First: Addresses (no dependencies)
   pnpm import:addresses .env.staging

   # Second: People (depends on addresses)
   pnpm import:people .env.staging

   # Third: Areas (depends on people)
   pnpm import:areas .env.staging

   # Fourth: Communities (depends on areas and people)
   pnpm import:communities .env.staging

   # Fifth: Venues (depends on addresses, areas, communities, people)
   pnpm import:venues .env.staging
   ```

4. **Update existing records** (if needed):
   ```bash
   pnpm import:addresses .env.staging --force
   pnpm import:people .env.staging --force
   pnpm import:areas .env.staging --force
   pnpm import:communities .env.staging --force
   pnpm import:venues .env.staging --force
   ```

### Migrating Individual Entity Types

```bash
# Just addresses
pnpm export:addresses .env.source --pretty
pnpm import:addresses .env.target

# Just people (all)
pnpm export:people .env.source --pretty
pnpm import:people .env.target

# Just people referenced by areas and venues
pnpm export:people .env.source --areas --venues --pretty
pnpm import:people .env.target

# Just areas
pnpm export:areas .env.source --pretty
pnpm import:areas .env.target

# Just communities
pnpm export:communities .env.source
pnpm import:communities .env.target --force

# Just venues
pnpm export:venues .env.source
pnpm import:venues .env.target
```

---

## MKP Connect Data Migration & GeoJSON Enhancement Pipeline

This section documents the complete workflow for migrating zipcode, area, and community data from the legacy MKP Connect MariaDB database to Emma v3 Supabase, with GeoJSON polygon enhancement.

### Overview

**Purpose**: Extract geographic data from MKP Connect's legacy database, enhance it with high-quality GeoJSON polygons, aggregate zipcodes into Areas and Communities, and import into Emma v3.

**Key Features**:
- Extracts zipcode-to-area and zipcode-to-community mappings from MKP Connect
- Enriches data with county information and GeoJSON polygon boundaries
- Aggregates individual zipcode polygons into unified Area and Community polygons
- Generates properly formatted Emma v3 entities with valid GeoJSON FeatureCollections
- Maintains referential integrity (Communities reference Areas via area_id)

**Data Flow**:
```
MKP Connect (MariaDB)
  → Zipcode JSON files
  → County enrichment
  → GeoJSON enhancement
  → Area/Community generation
  → Emma v3 (Supabase)
```

### Scripts Involved

1. **`export-mkp-community-zipcodes.ts`**
   - Exports zipcodes that have community assignments from MKP Connect MariaDB
   - Source: Complex SQL join across `zip_county_lookup`, `civicrm_state_province`, and `State, Area, Community, County, Zip` tables
   - Output: One JSON file per zipcode in `scripts/data/{hostname}/mkp-community-zipcodes/`
   - Includes: zipcode, county, state, area, community, latitude, longitude

2. **`export-mkp-area-zipcodes.ts`**
   - Exports zipcodes that do NOT have community assignments (area-only zipcodes)
   - Source: SQL query filtering for NULL community values
   - Output: One JSON file per zipcode in `scripts/data/{hostname}/mkp-area-zipcodes/`
   - Purpose: Ensures all area zipcodes are captured, even those without community mappings

3. **`fill-mkp-area-counties.ts`**
   - Fills in missing county values for zipcodes
   - Uses: `zipcodes-us` npm package (free, MIT licensed, based on GeoNames data)
   - Processes: Both area-zipcodes and community-zipcodes files
   - Updates: Only records where `county` is `null`

4. **`add-zipcode-geojson.ts`**
   - Adds GeoJSON polygon geometry to zipcode files
   - Source: Downloads 100m resolution data from ndrezn/zip-code-geojson GitHub repository
   - Data file: `scripts/geojson-data/usa_zip_codes_geo_100m.json` (100MB, gitignored)
   - Adds: `geo_json` field with polygon coordinates to each zipcode
   - Processes: Selectable via `--areas` and/or `--communities` flags

5. **`generate-areas-from-zipcodes.ts`** *(Legacy - use for initial zipcode-based generation)*
   - Aggregates zipcodes by area name to create Area entities from MKP Connect data
   - Groups: All zipcodes sharing the same `area` value
   - Merges: Uses `@turf/dissolve` to combine all zipcode polygons into single Area polygon
   - Wraps: Geometry in proper GeoJSON FeatureCollection format
   - Generates: Complete Area objects with id, name, code=null, geo_json, timestamps
   - Output: `scripts/data/{hostname}/areas/{area-code}.json`
   - **Use case**: Initial migration from MKP Connect zipcode data

6. **`generate-communities-from-zipcodes.ts`** *(Legacy - use for initial zipcode-based generation)*
   - Aggregates zipcodes by community name to create Community entities from MKP Connect data
   - Groups: All zipcodes sharing the same `community` value
   - Merges: Uses `@turf/dissolve` to combine all zipcode polygons into single Community polygon
   - Wraps: Geometry in proper GeoJSON FeatureCollection format
   - Links: Sets `area_id` by looking up generated Area entities
   - Generates: Complete Community objects with id, name, code=null, area_id, geo_json, timestamps
   - Output: `scripts/data/{hostname}/communities/{community-code}.json`
   - **Use case**: Initial migration from MKP Connect zipcode data

7. **`assign-area-codes.ts`**
   - Interactive script to assign short codes (≤6 chars) to Areas
   - Suggests: State abbreviations, airport codes, or acronyms
   - Prompts: Accept (Enter), Override, Skip (s), Quit (q)
   - Updates: Area JSON files with assigned codes
   - **Use case**: After generating areas, before importing to database

8. **`assign-community-codes.ts`**
   - Interactive script to assign short codes (≤6 chars) to Communities
   - Suggests: Airport codes or acronyms
   - Prompts: Accept (Enter), Override, Skip (s), Quit (q)
   - Updates: Community JSON files with assigned codes
   - **Use case**: After generating communities, before importing to database

9. **`define-areas.ts`**
   - Interactive script to define geographic boundaries for Areas using states, counties, and zipcodes
   - Downloads GeoJSON data for states, counties, and zipcodes if missing
   - Validates: User input against GeoJSON data
   - Supports: Add (+) and subtract (-) operators (e.g., `+Colorado`, `-Montezuma, CO`, `+79901`)
   - **LSAD Qualifiers**: Optional LSAD (Legal/Statistical Area Description) qualifier for counties
     - Format: `+County Name (LSAD), ST` or `-County Name (LSAD), ST`
     - Example: `+St. Louis (County), MO` or `+St. Louis (city), MO`
     - Required when multiple entries exist with same name (e.g., St. Louis County vs St. Louis city)
     - Script prompts with available options if LSAD needed but not provided
     - Common LSAD values: County, city, Parish, Borough, CA (Census Area)
   - Updates: Area JSON files with `geo_definition` field
   - **Use case**: After assigning codes, to manually define/refine area boundaries
   - **Format**:
     ```json
     {
       "geo_definition": {
         "states": ["+Colorado"],
         "counties": ["-Montezuma (County), CO", "-La Plata (County), CO"],
         "zipcodes": ["+79901", "+79902"]
       }
     }
     ```

10. **`generate-areas-geojson.ts`** *(Recommended - use after defining geo_definition)*
    - Generates `geo_json` field from `geo_definition` in Area JSON files
    - Reads: Area JSON files with `geo_definition`
    - Processes: States, counties, and zipcodes with +/- operators
    - **LSAD Support**: Parses optional LSAD qualifiers for counties
      - Recognizes format: `+County Name (LSAD), ST`
      - Filters county data by LSAD when qualifier provided
      - Warns if LSAD not found and lists available options
      - Defaults to first match if multiple entries exist without qualifier
    - Merges: Uses two-stage `@turf/dissolve` algorithm to create clean boundaries
      - Stage 1: Flatten and union each MultiPolygon into single geometry
      - Stage 1.5: Flatten any remaining MultiPolygons into Polygons
      - Stage 2: Dissolve all polygons together into area boundary
    - Wraps: Geometry in proper GeoJSON FeatureCollection format
    - Updates: Area JSON files with generated `geo_json`
    - **Use case**: After defining geo_definition, to generate final area boundaries
    - **Advantages**: More flexible than zipcode-only approach, supports state/county-level definitions

11. **Standard Import Scripts**
    - `import-areas.ts` - Imports generated Area files to Supabase
    - `import-communities.ts` - Imports generated Community files to Supabase

### Complete Workflow

There are two approaches to generating Area GeoJSON data:

1. **Zipcode-based approach (Legacy)**: Aggregate zipcodes from MKP Connect into areas
2. **Definition-based approach (Recommended)**: Define areas using states/counties/zipcodes with +/- operators

---

## Approach 1: Zipcode-based Generation (Legacy)

Use this for **initial migration** from MKP Connect zipcode data.

#### Phase 1: Export from MKP Connect

```bash
# Export zipcodes with community assignments
pnpm export:mkp-community-zipcodes .env.mkpconnect

# Export zipcodes without community assignments (area-only)
pnpm export:mkp-area-zipcodes .env.mkpconnect
```

**Output**:
- `scripts/data/mkpconnect.org/mkp-community-zipcodes/*.json` (~3,000 files)
- `scripts/data/mkpconnect.org/mkp-area-zipcodes/*.json` (~40,000 files)

**Environment variables required**:
```env
MKPCONNECT_DB_HOST=mkpconnect.org
MKPCONNECT_DB_USERNAME=your-username
MKPCONNECT_DB_PASSWORD=your-password
MKPCONNECT_CIVICRM_DB_NAME=connect_civicrm
```

#### Phase 2: Data Enhancement

```bash
# Fill in missing county names
pnpm fill:mkp-area-counties .env.mkpconnect

# Add GeoJSON polygons to zipcode files
# Downloads 100m resolution data if not present
pnpm add:zipcode-geojson --areas --communities
```

**What happens**:
- County enhancement: Looks up county names via zipcodes-us package, updates files in-place
- GeoJSON enhancement: Adds `geo_json` field with polygon coordinates to each zipcode

**Options**:
```bash
# Preview without writing
pnpm fill:mkp-area-counties --dry-run
pnpm add:zipcode-geojson --dry-run

# Process only specific datasets
pnpm add:zipcode-geojson --areas          # Only area-zipcodes
pnpm add:zipcode-geojson --communities    # Only community-zipcodes

# Custom hostname
pnpm fill:mkp-area-counties --host mkpconnect.org
```

#### Phase 3: Generate Emma Entities (from Zipcodes)

```bash
# Generate Areas (must run first - Communities depend on Areas)
pnpm generate:areas

# Generate Communities (references Areas via area_id)
pnpm generate:communities
```

**Output**:
- `scripts/data/mkp-emma-v3.vercel.app/areas/*.json` (21 area files)
- `scripts/data/mkp-emma-v3.vercel.app/communities/*.json` (122 community files)

**What happens**:
1. **Areas**:
   - Groups all zipcodes by area name
   - Merges polygons using turf.js dissolve
   - Wraps in FeatureCollection format
   - Generates UUIDs, code=null, timestamps

2. **Communities**:
   - Groups all zipcodes by community name
   - Merges polygons using turf.js dissolve
   - Wraps in FeatureCollection format
   - Looks up area_id from generated Area files
   - Generates UUIDs, code=null, timestamps

**Options**:
```bash
# Preview without writing
pnpm generate:areas --dry-run
pnpm generate:communities --dry-run

# Pretty formatted JSON
pnpm generate:areas --pretty
pnpm generate:communities --pretty

# Custom source and target hosts
pnpm generate:areas --source-host mkpconnect.org --target-host mkp-emma-v3.vercel.app
pnpm generate:communities --source-host mkpconnect.org --target-host mkp-emma-v3.vercel.app
```

#### Phase 4: Assign Codes

```bash
# Assign codes to areas (interactive)
pnpm assign:area-codes --host mkp-emma-v3.vercel.app

# Assign codes to communities (interactive)
pnpm assign:community-codes --host mkp-emma-v3.vercel.app
```

**What happens**:
- Script walks through each area/community
- Suggests code based on name (state abbreviation, airport code, or acronym)
- Prompts: Accept (Enter), Override, Skip (s), Quit (q)
- Updates JSON files with assigned codes

#### Phase 5: Import to Emma v3

```bash
# Import Areas first (Communities depend on them)
pnpm import:areas .env.emma-v3

# Import Communities (references Areas)
pnpm import:communities .env.emma-v3
```

**Environment variables required**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HOSTNAME=mkp-emma-v3.vercel.app
```

**Import features**:
- Validates foreign key references (Communities → Areas)
- Skips duplicates by default (match on `code` field)
- Use `--force` to update existing records

---

## Approach 2: Definition-based Generation (Recommended)

Use this for **manual refinement** or **new areas** defined by states/counties/zipcodes.

### Prerequisites

Area JSON files must already exist (either from Approach 1 or created manually).

### Workflow

#### Step 1: Define Area Boundaries (Interactive)

```bash
# Define all areas
pnpm define:areas --host mkp-emma-v3.vercel.app

# Define specific area
pnpm define:areas --area colorado --host mkp-emma-v3.vercel.app
```

**What happens**:
- Script downloads GeoJSON data for states, counties, and zipcodes (if missing)
- Walks through each area interactively
- Prompts for states, counties, and zipcodes to include (+) or exclude (-)
- Saves `geo_definition` field to area JSON files

**Example interaction**:
```
Area: Colorado (COLO)
Current geo_definition: (none)

Modify geo_definition? (y/n): y

--- STATES ---
Enter state names with "+" to add or "-" to subtract
Type "done" when finished, "clear" to reset
State: +Colorado
  ✓ Added: +Colorado
State: done

--- COUNTIES ---
Enter counties as "County Name, ST" with "+" to add or "-" to subtract
Optional: Include LSAD qualifier like "County Name (County), ST" or "County Name (city), ST"
Type "done" when finished, "clear" to reset
County: -Montezuma (County), CO
  ✓ Added: -Montezuma (County), CO
County: -La Plata (County), CO
  ✓ Added: -La Plata (County), CO
County: done

--- ZIPCODES ---
Enter 5-digit zipcodes with "+" to add or "-" to subtract
Type "done" when finished, "clear" to reset
Zipcode: done

✓ Saved geo_definition:
  States: +Colorado
  Counties: -Montezuma, CO, -La Plata, CO
  Zipcodes: (none)
```

**Result**:
```json
{
  "geo_definition": {
    "states": ["+Colorado"],
    "counties": ["-Montezuma (County), CO", "-La Plata (County), CO"],
    "zipcodes": []
  }
}
```

#### Step 2: Generate GeoJSON from Definition

```bash
# Generate geo_json for all areas with geo_definition
pnpm generate:areas-geojson --host mkp-emma-v3.vercel.app

# Generate for specific area
pnpm generate:areas-geojson --area colorado --host mkp-emma-v3.vercel.app

# Preview without modifying files
pnpm generate:areas-geojson --dry-run --host mkp-emma-v3.vercel.app
```

**What happens**:
- Reads area JSON files with `geo_definition`
- Downloads GeoJSON data for states, counties, and zipcodes (if missing)
- Collects geometries based on +/- operators
- Parses optional LSAD qualifiers for counties (e.g., `(County)`, `(city)`)
- Merges geometries using three-stage dissolve algorithm:
  1. **Stage 1**: Flatten and union each MultiPolygon into single geometry
  2. **Stage 1.5**: Flatten any remaining MultiPolygons into Polygons
  3. **Stage 2**: Dissolve all polygons together into clean area boundary
- Updates `geo_json` field in area JSON files

**Example output**:
```
============================================================
Area: Colorado (COLO)
============================================================
  + Added state: Colorado
  - Excluded county: Montezuma (County), CO
  - Excluded county: La Plata (County), CO

  Processing 1 geometries...
  Stage 1: Unifying individual geometries...
  Stage 1.5: Flattening any MultiPolygons into Polygons...
  Stage 2: Dissolving 48 polygons into area boundary...
  ✓ Created boundary with 1 polygon(s)
  ✓ Updated: colorado.json
```

**Options**:
```bash
# Pretty formatted JSON output
pnpm generate:areas-geojson --pretty

# Preview without writing
pnpm generate:areas-geojson --dry-run

# Filter by area name
pnpm generate:areas-geojson --area "new york"

# Custom hostname
pnpm generate:areas-geojson --host mkp-emma-v3.vercel.app
```

#### Step 3: Import to Emma v3

```bash
# Import areas (with --force to update existing)
pnpm import:areas .env.emma-v3 --force

# Or import communities
pnpm import:communities .env.emma-v3 --force
```

### Advantages of Definition-based Approach

1. **More flexible**: Define areas by entire states, counties, or specific zipcodes
2. **Easier refinement**: Use subtract operator to exclude specific counties/zipcodes
3. **Cleaner boundaries**: No need to manage thousands of individual zipcode files
4. **Better version control**: Small, readable `geo_definition` in JSON files
5. **Reproducible**: Can regenerate `geo_json` from `geo_definition` at any time

### Technical Details

#### Directory Structure

Data is organized by hostname to support multiple environments:

```
scripts/data/
  ├── mkpconnect.org/               # Source data
  │   ├── mkp-area-zipcodes/        # Area-only zipcodes
  │   └── mkp-community-zipcodes/   # Community-assigned zipcodes
  └── mkp-emma-v3.vercel.app/       # Target data
      ├── areas/                     # Generated Area entities
      └── communities/               # Generated Community entities
```

#### GeoJSON Format

**Zipcode files** (intermediate data):
```json
{
  "geo_json": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], ...]]
  }
}
```

**Area/Community files** (final format):
```json
{
  "geo_json": {
    "type": "FeatureCollection",
    "features": [{
      "type": "Feature",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[[lon, lat], ...]]]
      },
      "properties": {}
    }]
  }
}
```

The FeatureCollection format is the proper GeoJSON standard and matches Emma v2's format.

#### Polygon Union with Turf.js

- Uses `@turf/union` to merge multiple zipcode polygons
- Handles both contiguous (single polygon) and non-contiguous (multi-polygon) areas
- Automatically simplifies overlapping boundaries
- Preserves coordinate precision

#### Generated Entity Fields

**Areas**:
```typescript
{
  id: string              // Generated UUID
  name: string            // From zipcode.area (e.g., "Northwest")
  code: string            // Sanitized name (e.g., "northwest")
  description: null       // No source data
  color: null             // No source data
  is_active: true         // Default
  image_url: null         // No source data
  steward_id: null        // No source data
  finance_coordinator_id: null  // No source data
  geo_json: {...}      // Merged FeatureCollection
  created_at: string      // Current timestamp
  updated_at: string      // Current timestamp
  deleted_at: null        // No source data
  area_admins: []         // No source data
}
```

**Communities**:
```typescript
{
  id: string              // Generated UUID
  name: string            // From zipcode.community (e.g., "Portland OR")
  code: string            // Sanitized name (e.g., "portland-or")
  description: null       // No source data
  image_url: null         // No source data
  color: null             // No source data
  is_active: true         // Default
  area_id: string         // Looked up from Area by name
  coordinator_id: null    // No source data
  geo_json: {...}      // Merged FeatureCollection
  created_at: string      // Current timestamp
  updated_at: string      // Current timestamp
  deleted_at: null        // No source data
}
```

#### File Naming Conventions

- **Zipcodes**: `{zipcode}.json` (e.g., `97004.json`, `10001.json`)
- **Areas**: `{sanitized-name}.json` (e.g., `northwest.json`, `new-england.json`)
- **Communities**: `{sanitized-name}.json` (e.g., `portland-or.json`, `south-pioneer-valley.json`)

Code sanitization: lowercase, replace non-alphanumeric with hyphens, trim edge hyphens

### Common Options

Most scripts support these flags:

- **`--dry-run`**: Preview changes without writing files
- **`--pretty`**: Format JSON output with indentation
- **`--host`**: Override hostname for single-host scripts
- **`--source-host`**: Override source hostname for generation scripts
- **`--target-host`**: Override target hostname for generation scripts
- **`--areas`**: Process only area-zipcodes dataset
- **`--communities`**: Process only community-zipcodes dataset
- **`--force`**: Update existing records during import

### Data Statistics

Based on current MKP Connect data:

- **Community Zipcodes**: ~3,000 zipcodes across 122 communities in 21 areas
- **Area Zipcodes**: ~40,000 zipcodes not assigned to communities
- **Areas**: 21 unique geographic areas
- **Communities**: 122 unique communities
- **States Covered**: US only, excluding Puerto Rico, Virgin Islands, American Samoa

### Troubleshooting

**Missing county data**:
- Run `pnpm fill:mkp-area-counties` to populate
- Uses free zipcodes-us package with 40,000+ ZIP codes
- Some new/rural zipcodes may not have county data available

**GeoJSON data not found**:
- Script will download automatically from GitHub on first run
- File: `scripts/geojson-data/usa_zip_codes_geo_100m.json` (100MB)
- Source: https://github.com/ndrezn/zip-code-geojson
- Add to `.gitignore` (already configured)

**Area_id not found for Community**:
- Ensure Areas are generated and imported before Communities
- Communities lookup area_id by matching area names
- Warning displayed if area not found, sets area_id to null

**Polygon union failures**:
- Script continues with best-effort result
- Warnings logged for individual polygon merge failures
- Final merged polygon still created from successful unions

### Dependencies

**npm packages**:
- `@turf/dissolve` - Polygon dissolving operations (used in generate-areas-geojson.ts)
- `@turf/flatten` - Flatten MultiPolygon geometries into individual Polygons
- `@turf/union` - Polygon merging and union operations
- `@turf/helpers` - GeoJSON helper functions (featureCollection, etc.)
- `zipcodes-us` - US ZIP code to county/location lookup
- `mariadb` - MariaDB database connection
- `@supabase/supabase-js` - Supabase database connection
- `dotenv` - Environment variable management
- `readline` - Interactive command-line prompts (used in define-areas.ts)
- `https` - HTTP client for downloading GeoJSON data

**External data**:
- eric.clst.org - 5m resolution US state and county boundaries (used in define-areas.ts, generate-areas-geojson.ts)
  - States: `gz_2010_us_040_00_5m.json`
  - Counties: `gz_2010_us_050_00_5m.json`
- ndrezn/zip-code-geojson - 100m resolution US ZIP code boundaries (MIT/Creative Commons)
  - File: `usa_zip_codes_geo_100m.json`
