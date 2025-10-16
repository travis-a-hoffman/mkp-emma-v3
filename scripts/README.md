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

---

## MKP Connect Groups & Warriors Migration Pipeline

This section documents the complete workflow for migrating groups (I-Groups and F-Groups), group membership data, and warrior information from the legacy MKP Connect MariaDB database to Emma v3 Supabase.

### Overview

**Purpose**: Extract group entities, membership rosters, and warrior data from MKP Connect, transform into Emma v3 format with proper normalization, and import into PostgreSQL/Supabase.

**Key Features**:
- Exports I-Groups (Integration Groups) and F-Groups (Facilitation Groups) from MKP Connect
- Extracts group membership rosters linking groups to warriors
- Deduplicates and normalizes warrior data across all groups
- Transforms groups with proper area/community references and location data
- Maps group membership to warrior UUIDs with dual lookup (CiviCRM ID + email fallback)
- Normalizes latitude/longitude as database columns (not buried in JSONB)
- Renames problematic "class" field to "affiliation" (avoids TypeScript reserved word)
- Imports to two-table pattern: groups base table + i_groups/f_groups extension tables

**Data Flow**:
```
MKP Connect (MariaDB)
  → I-Group JSON files (metadata, location, meeting info)
  → Membership JSON files (group rosters)
  → Warrior extraction (deduplicated across all groups)
  → Warrior import (people + warriors tables)
  → Group transformation (normalize, resolve references)
  → Membership transformation (map to warrior UUIDs)
  → Group import (groups + i_groups/f_groups tables)
  → Emma v3 (Supabase)
```

### Scripts Involved

#### Export Scripts (from MKP Connect)

1. **`export-igroups.ts`**
   - Exports I-Groups (integration groups) from MKP Connect MariaDB
   - Source: Complex SQL join across multiple MKP Connect tables
   - Output: One JSON file per group in `scripts/data/{hostname}/igroups/`
   - Includes: All group metadata, address, meeting schedule, location (lat/lng), area/community names and IDs, contact info, flags
   - Usage: `pnpm export:igroups [.env file] [--pretty] [--host hostname]`
   - Example: `pnpm export:igroups .env.mkpconnect --pretty`

2. **`export-igroup-membership.ts`**
   - Exports group membership rosters from MKP Connect
   - Source: SQL join of groups, group members, and user data
   - Output: One JSON file per group in `scripts/data/{hostname}/igroups/membership/`
   - Includes: Group ID, group email, group type, array of member records (with CiviCRM ID, email, names, IEN, etc.)
   - Usage: `pnpm export:igroup-membership [.env file] [--pretty] [--host hostname]`
   - Example: `pnpm export:igroup-membership .env.mkpconnect --pretty`

**Environment variables required**:
```env
MKPCONNECT_DB_HOST=mkpconnect.org
MKPCONNECT_DB_USERNAME=your-username
MKPCONNECT_DB_PASSWORD=your-password
MKPCONNECT_CIVICRM_DB_NAME=connect_civicrm
```

#### Extract/Transform Scripts

3. **`extract-warriors-from-groups.ts`**
   - Extracts unique warriors from all group membership files
   - Deduplicates warriors across all groups (by CiviCRM ID and email)
   - Generates Person records with warrior-specific metadata
   - Output: One JSON file per warrior in `scripts/data/{hostname}/warriors/`
   - Includes: Person fields (name, email) + warrior fields (IEN, birth_date, CiviCRM ID, image_URL, etc.)
   - Creates lookup maps for later membership transformation
   - Usage: `pnpm extract:warriors [--source-host hostname] [--host hostname] [--pretty]`
   - Example: `pnpm extract:warriors --source-host mkpconnect.org --host mkp-emma-v3.vercel.app --pretty`

4. **`transform-groups.ts`**
   - Transforms MKP Connect group data into Emma v3 format
   - Separates groups into I-Groups vs F-Groups based on type/name
   - **Key transformations**:
     - Extracts `latitude` and `longitude` as normalized numeric fields (not in mkpconnect_data JSONB)
     - Renames `class` field to `affiliation` (avoids TypeScript reserved word)
     - Resolves area_id and community_id by looking up UUIDs from area/community files
     - Parses meeting schedule into description string
     - Converts MKP Connect boolean strings ("Yes"/"No"/"Contact") to proper booleans
     - Filters out lat/lng = 0 (placeholder values)
     - Validates coordinate ranges: lat [-90, 90], lng [-180, 180]
   - Output: Groups in `scripts/data/{hostname}/i-groups/` and `scripts/data/{hostname}/f-groups/`
   - Requires: Areas and communities must be imported first (for UUID lookup)
   - Usage: `pnpm transform:groups [--source-host hostname] [--host hostname] [--pretty]`
   - Example: `pnpm transform:groups --source-host mkpconnect.org --host mkp-emma-v3.vercel.app --pretty`

5. **`transform-igroup-membership.ts`**
   - Maps group membership to warrior UUIDs
   - Uses dual lookup strategy:
     - **Primary**: Match by CiviCRM user ID
     - **Fallback**: Match by email address
   - Populates `members` field in group JSON files
   - Output format: `members: [{id: "warrior-uuid"}, {id: "warrior-uuid"}, ...]` (array of objects, not strings)
   - Statistics: Reports matched warriors, not found, and groups without membership data
   - Usage: `pnpm transform:igroup-membership [--source-host hostname] [--host hostname]`
   - Example: `pnpm transform:igroup-membership --source-host mkpconnect.org --host mkp-emma-v3.vercel.app`

#### Import Scripts

6. **`import-warriors.ts`**
   - Imports warriors to Emma v3 people and warriors tables
   - Two-table pattern: Inserts into `people` first, then `warriors` (1:1 FK relationship)
   - **Validation**: Checks for existing records by ID
   - **Conflict handling**:
     - Default: Skips warriors that already exist
     - `--force`: Updates existing records
   - Usage: `pnpm import:warriors [.env file] [--force]`
   - Example: `pnpm import:warriors .env.emma-v3 --force`

7. **`import-groups.ts`**
   - Imports groups, i-groups, and f-groups to Emma v3
   - Three-table pattern: `groups` (base) + `i_groups` or `f_groups` (extension)
   - **Validation**: Checks all foreign keys before import:
     - area_id → areas
     - community_id → communities
     - venue_id → venues
     - public_contact_id, primary_contact_id → people
   - **Conflict handling**:
     - Default: Skips groups that already exist (matched by ID)
     - `--force`: Updates existing records
   - **Features**:
     - Imports latitude/longitude as numeric columns
     - Imports affiliation field (renamed from class)
     - Imports members array as JSONB
     - Stores full mkpconnect_data for reference
   - Usage: `pnpm import:groups [.env file] [--force]`
   - Example: `pnpm import:groups .env.emma-v3 --force`

### Database Schema

#### Groups Tables

**groups** (base table):
```sql
- id (uuid, primary key)
- name (text, required)
- description (text, required)
- url (text, nullable)
- members (jsonb, array of {id: uuid})
- is_accepting_new_members (boolean, default false)
- membership_criteria (text, nullable)
- venue_id (uuid, FK to venues)
- genders (text, nullable, e.g., "Men's", "Mixed Gender")
- is_publicly_listed (boolean, default false)
- public_contact_id (uuid, FK to people)
- primary_contact_id (uuid, FK to people)
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
- photo_url (text, nullable)
- latitude (numeric(10, 6), nullable)  -- NEW: normalized location
- longitude (numeric(10, 6), nullable) -- NEW: normalized location
- mkpconnect_data (jsonb, nullable)    -- Full MKP Connect record for reference
```

**i_groups** (extension table for integration groups):
```sql
- id (uuid, primary key, FK to groups.id CASCADE)
- log_id (uuid, nullable)
- is_accepting_initiated_visitors (boolean, default false)
- is_accepting_uninitiated_visitors (boolean, default false)
- is_requiring_contact_before_visiting (boolean, default false)
- schedule_events (jsonb, array of event times)
- schedule_description (text, nullable, e.g., "Weekly on Tues at 7:00 PM")
- area_id (uuid, FK to areas)
- community_id (uuid, FK to communities)
- contact_email (text, nullable)        -- NEW
- status (varchar(50), nullable)        -- NEW, e.g., "Open", "Closed"
- affiliation (varchar(50), nullable)   -- NEW, renamed from "class"
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

**f_groups** (extension table for facilitation groups):
```sql
- id (uuid, primary key, FK to groups.id CASCADE)
- log_id (uuid, nullable)
- group_type (text, e.g., "Men's", "Mixed Gender", "Open Men's", "Closed Men's")
- is_accepting_new_facilitators (boolean, default false)
- facilitators (jsonb, array of warrior IDs)
- is_accepting_initiated_visitors (boolean, default false)
- is_accepting_uninitiated_visitors (boolean, default false)
- is_requiring_contact_before_visiting (boolean, default false)
- schedule_events (jsonb, array of event times)
- schedule_description (text, nullable)
- area_id (uuid, FK to areas)
- community_id (uuid, FK to communities)
- contact_email (text, nullable)        -- NEW
- status (varchar(50), nullable)        -- NEW
- affiliation (varchar(50), nullable)   -- NEW, renamed from "class"
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

#### Warriors Tables

**people** (extended by warriors):
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
- mkpconnect_data (jsonb)  -- NEW: stores warrior-specific MKP Connect data
```

**warriors** (extends people, 1:1 relationship):
```sql
- id (uuid, primary key, FK to people.id CASCADE)
- person_id (uuid, FK to people.id, unique)
- ien (text, nullable, Initiation Experience Number)
- initiation_event_id (uuid, FK to events, nullable)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp)
```

### Complete Workflow

Follow this order to respect foreign key dependencies:

#### Phase 1: Export from MKP Connect

```bash
# Export group metadata
pnpm export:igroups .env.mkpconnect --pretty

# Export group membership rosters
pnpm export:igroup-membership .env.mkpconnect --pretty
```

**Output**:
- `scripts/data/mkpconnect.org/igroups/*.json` (~1,900 group files)
- `scripts/data/mkpconnect.org/igroups/membership/*.json` (~1,900 membership files)

#### Phase 2: Extract Warriors

```bash
# Extract unique warriors from all membership files
pnpm extract:warriors --source-host mkpconnect.org --host mkp-emma-v3.vercel.app --pretty
```

**Output**:
- `scripts/data/mkp-emma-v3.vercel.app/warriors/*.json` (~15,000-20,000 warrior files)
- Deduplication: Warriors appearing in multiple groups only exported once
- Creates lookup maps: by CiviCRM ID and by email

**What happens**:
- Reads all membership files
- Extracts unique warriors (deduplicated by CiviCRM ID + email)
- Generates Person fields from member data
- Adds warrior-specific metadata (IEN, birth_date, etc.)
- Stores full MKP Connect data in mkpconnect_data field

#### Phase 3: Import Warriors (Prerequisite for Groups)

```bash
# Import warriors to people and warriors tables
pnpm import:warriors .env.emma-v3
```

**Why first**: Groups reference warriors via the `members` field, so warriors must exist before importing groups.

**Import summary example**:
```
📊 Import Summary:
  ✓ Imported (people): 18,234
  ✓ Imported (warriors): 18,234
  ⊘ Skipped: 0
  ✗ Errors: 0
```

#### Phase 4: Transform Groups

**Prerequisites**: Areas and communities must already be imported (for area_id/community_id lookup).

```bash
# Transform groups from MKP Connect format to Emma v3 format
pnpm transform:groups --source-host mkpconnect.org --host mkp-emma-v3.vercel.app --pretty
```

**Output**:
- `scripts/data/mkp-emma-v3.vercel.app/i-groups/*.json` (~1,800 integration group files)
- `scripts/data/mkp-emma-v3.vercel.app/f-groups/*.json` (~100 facilitation group files)

**Transformation details**:
- **Group type detection**:
  - I-Groups: Default, or has "I-Group" in name
  - F-Groups: Has "F-Group" or "Facilitation" in name, or igroup_type = "MKP F-Group"
- **Latitude/longitude**:
  - Extracted from mkpconnect_data.latitude/longitude
  - Parsed as numbers and validated (lat: -90 to 90, lng: -180 to 180)
  - Values of 0 filtered out (placeholder data)
- **Field renaming**:
  - `class` → `affiliation` (avoids TypeScript reserved word collision)
- **Area/Community resolution**:
  - Looks up area_id by matching area_name against imported area files
  - Looks up community_id by matching community_name against imported community files
  - Warns if not found, sets to null

#### Phase 5: Transform Group Membership

```bash
# Map group membership to warrior UUIDs
pnpm transform:igroup-membership --source-host mkpconnect.org --host mkp-emma-v3.vercel.app
```

**What happens**:
- Reads warrior files to build lookup maps (by CiviCRM ID and email)
- Reads membership files for each group
- For each member:
  1. Try lookup by civicrm_user_id (primary)
  2. Fall back to email address if CiviCRM ID not found
  3. Add `{id: warrior-uuid}` to group's members array
- Updates group JSON files in-place
- Reports statistics: matched, not found, groups without membership data

**Output format**:
```json
{
  "id": "group-uuid",
  "name": "Portland Monday I-Group",
  "members": [
    {"id": "warrior-uuid-1"},
    {"id": "warrior-uuid-2"},
    {"id": "warrior-uuid-3"}
  ],
  ...
}
```

**Statistics example**:
```
📊 Membership Transformation Summary:
  ✓ Groups processed: 1,876
  ✓ Members matched by CiviCRM ID: 14,532
  ✓ Members matched by email: 1,203
  ⚠ Members not found: 47
  ⊘ Groups with no membership data: 12
```

#### Phase 6: Import Groups

```bash
# Import groups to Emma v3 (i-groups and f-groups)
pnpm import:groups .env.emma-v3
```

**Import features**:
- Validates all foreign keys:
  - area_id → areas
  - community_id → communities
  - venue_id → venues (if set)
  - public_contact_id, primary_contact_id → people (if set)
  - members[].id → people (implicitly validated via warriors)
- Two-table insert:
  1. Insert into `groups` base table
  2. Insert into `i_groups` or `f_groups` extension table (based on file source)
- Stores latitude/longitude as numeric columns
- Stores members as JSONB array
- Full mkpconnect_data preserved for reference

**Import summary example**:
```
📊 Import Summary - I-Groups:
  ✓ Imported: 1,804
  ↻ Updated: 0
  ⊘ Skipped: 72 (use --force to update)
  ✗ Errors: 0

📊 Import Summary - F-Groups:
  ✓ Imported: 98
  ↻ Updated: 0
  ⊘ Skipped: 5
  ✗ Errors: 0
```

### Complete Migration Order

When migrating all data from MKP Connect to Emma v3, follow this order:

```bash
# 1. Export areas/communities from MKP Connect (if not already done)
# (See "MKP Connect Data Migration & GeoJSON Enhancement Pipeline" section above)

# 2. Import areas and communities
pnpm import:areas .env.emma-v3
pnpm import:communities .env.emma-v3

# 3. Export groups and membership from MKP Connect
pnpm export:igroups .env.mkpconnect --pretty
pnpm export:igroup-membership .env.mkpconnect --pretty

# 4. Extract and import warriors
pnpm extract:warriors --source-host mkpconnect.org --host mkp-emma-v3.vercel.app --pretty
pnpm import:warriors .env.emma-v3

# 5. Transform groups and membership
pnpm transform:groups --source-host mkpconnect.org --host mkp-emma-v3.vercel.app --pretty
pnpm transform:igroup-membership --source-host mkpconnect.org --host mkp-emma-v3.vercel.app

# 6. Import groups
pnpm import:groups .env.emma-v3
```

### Key Features & Design Decisions

#### Normalized Latitude/Longitude

**Decision**: Extract lat/lng as top-level numeric columns instead of burying in mkpconnect_data JSONB.

**Rationale**:
- Enables efficient database queries and indexing
- Supports PostGIS spatial operations
- Avoids exposing internal MKP Connect data structure to API consumers
- Simplifies frontend map rendering

**Implementation**:
- Parsed from string ("43.070000") to numeric (43.07)
- Values of 0 filtered out (used as placeholder in source data)
- Validation: lat ∈ [-90, 90], lng ∈ [-180, 180]
- Storage: numeric(10, 6) for 6 decimal places (~0.11m precision)

#### Field Renaming: class → affiliation

**Decision**: Rename "class" field to "affiliation" throughout the entire pipeline.

**Rationale**:
- "class" is a reserved word in TypeScript/JavaScript
- Causes syntax errors and maintenance issues
- "affiliation" better describes the semantic meaning (e.g., "MKPI", "Independent")

**Impact**:
- Updated in type definitions (src/types/group.ts)
- Updated in transform script (scripts/transform-groups.ts)
- Updated in import script (scripts/import-groups.ts)
- Updated in database schemas (06-create-i-groups-table.sql, 07-create-f-groups-table.sql)
- All downstream code uses "affiliation" field name

#### Members Field Format

**Decision**: Store members as `[{id: "uuid"}, {id: "uuid"}, ...]` instead of `["uuid", "uuid", ...]`

**Rationale**:
- Allows future expansion (e.g., role, joined_at, status)
- Consistent with other relationship patterns in Emma v3
- More explicit and self-documenting

**Example**:
```json
{
  "members": [
    {"id": "123e4567-e89b-12d3-a456-426614174000"},
    {"id": "987fcdeb-51a2-43d7-8f9e-0123456789ab"}
  ]
}
```

#### Dual Lookup Strategy

**Decision**: Match warriors by CiviCRM ID first, fall back to email if not found.

**Rationale**:
- CiviCRM ID is the primary key in MKP Connect
- Email addresses may change or have typos
- Some warriors may not have CiviCRM IDs (legacy data)
- Maximizes successful matches while maintaining data integrity

**Statistics** (typical):
- ~92% matched by CiviCRM ID
- ~7% matched by email fallback
- ~1% not found (data quality issues)

### Troubleshooting

**Issue**: Warriors not found during membership transformation

**Causes**:
- Warrior doesn't exist in warriors/ directory (not extracted)
- CiviCRM ID mismatch between membership and user data
- Email address differs or missing

**Solutions**:
- Re-run `extract:warriors` to ensure all warriors extracted
- Check membership file for valid CiviCRM IDs and emails
- Manually investigate not-found warriors in MKP Connect database

---

**Issue**: Foreign key validation errors during group import

**Causes**:
- area_id or community_id references area/community that doesn't exist
- Area/community not imported yet
- UUID mismatch (transformed with different area/community files)

**Solutions**:
- Import areas and communities before importing groups
- Re-run `transform:groups` if areas/communities were reimported with new UUIDs
- Check transform script output for warnings about missing area/community lookups

---

**Issue**: Latitude/longitude = 0 in source data

**Behavior**: These are intentionally filtered out during transformation.

**Rationale**: MKP Connect uses "0.000000" as placeholder for missing location data. These represent invalid locations (would be in the Gulf of Guinea) and are excluded to prevent map display issues.

---

**Issue**: Duplicate warriors with different CiviCRM IDs

**Cause**: Same person registered multiple times in MKP Connect with different accounts.

**Solution**: Manual data cleanup required in MKP Connect, or use email-based deduplication by modifying extract-warriors.ts to prioritize email matching over CiviCRM ID.

### Data Statistics

Based on current MKP Connect data (as of October 2024):

- **I-Groups**: ~1,800 integration groups
- **F-Groups**: ~100 facilitation groups
- **Warriors**: ~18,000 unique warriors (deduplicated across all groups)
- **Average group size**: 8-12 members
- **Groups with location data**: ~475 groups have valid latitude/longitude
- **Groups with membership**: ~99% have at least one member
- **Membership matches**:
  - CiviCRM ID matches: ~92%
  - Email fallback matches: ~7%
  - Not found: ~1%

### File Naming Conventions

- **I-Groups**: `{sanitized-name}_{id-prefix}.json` (e.g., `Portland_Monday_I-Group_a1b2c3d4.json`)
- **F-Groups**: `{sanitized-name}_{id-prefix}.json` (e.g., `Rocky_Mountain_F-Group_e5f6g7h8.json`)
- **Warriors**: `{lastname}_{firstname}_{id-prefix}.json` (e.g., `Smith_John_i9j0k1l2.json`)
- **Membership**: `{group-id}.json` (e.g., `879288.json` matches group with mkp_connect_id=879288)
