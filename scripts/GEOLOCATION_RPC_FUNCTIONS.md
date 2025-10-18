# Required Supabase RPC Functions for Geolocation Stats

The geolocation stats endpoints (`/api/groups/stats` and `/api/i-groups/stats`) require the following PostgreSQL functions to be created in your Supabase database. These functions use PostGIS for spatial queries.

## Prerequisites

Ensure PostGIS extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Function 1: find_area_by_point

Finds the area(s) that contain a given geographic point. This function handles GeoJSON Features, FeatureCollections, and pure Geometry objects. It is robust against invalid GeoJSON data - it will skip any rows with malformed GeoJSON and continue processing.

```sql
CREATE OR REPLACE FUNCTION find_area_by_point(
  point_lon DOUBLE PRECISION,
  point_lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT
) AS $$
DECLARE
  area_rec RECORD;
  point_geom GEOMETRY;
  area_geom GEOMETRY;
  geojson_type TEXT;
  feature JSONB;
BEGIN
  -- Create the point geometry once
  point_geom := ST_SetSRID(ST_Point(point_lon, point_lat), 4326);

  -- Loop through all active areas with geo_json
  FOR area_rec IN
    SELECT a.id, a.name, a.code, a.geo_json
    FROM areas a
    WHERE a.geo_json IS NOT NULL
      AND a.is_active = TRUE
  LOOP
    BEGIN
      -- Determine the GeoJSON type
      geojson_type := area_rec.geo_json::JSONB->>'type';

      IF geojson_type = 'FeatureCollection' THEN
        -- Handle FeatureCollection: extract and combine all feature geometries
        area_geom := ST_Collect(
          ARRAY(
            SELECT ST_GeomFromGeoJSON(feat->'geometry')
            FROM jsonb_array_elements(area_rec.geo_json::JSONB->'features') AS feat
          )
        );

      ELSIF geojson_type = 'Feature' THEN
        -- Handle Feature: extract geometry from the feature
        area_geom := ST_GeomFromGeoJSON(area_rec.geo_json::JSONB->'geometry');

      ELSE
        -- Assume it's a pure Geometry object
        area_geom := ST_GeomFromGeoJSON(area_rec.geo_json::TEXT);
      END IF;

      -- Check if this area contains the point
      IF ST_Contains(area_geom, point_geom) THEN
        -- Found a match, return it
        id := area_rec.id;
        name := area_rec.name;
        code := area_rec.code;
        RETURN NEXT;
        RETURN; -- Exit after first match
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Skip this area if GeoJSON is invalid or processing fails
      -- Continue to next iteration
    END;
  END LOOP;

  RETURN; -- No match found
END;
$$ LANGUAGE plpgsql;
```

**Notes:**
- **Handles multiple GeoJSON formats**:
  - FeatureCollection: Extracts all features and combines geometries
  - Feature: Extracts geometry from feature object
  - Pure Geometry: Uses geometry directly
- Uses `ST_Contains` to check if the point is within the area's geometry
- SRID 4326 is the standard for latitude/longitude coordinates
- Coordinate order is (longitude, latitude) per PostGIS convention
- Returns only the first matching area
- Only returns active areas
- **Gracefully handles invalid GeoJSON** - skips bad data and continues processing
- Creates point geometry once for efficiency
- Compatible with Google Maps and geojson.io GeoJSON formats

## Function 2: find_community_by_point

Finds the community(ies) that contain a given geographic point. This function handles GeoJSON Features, FeatureCollections, and pure Geometry objects. It is robust against invalid GeoJSON data - it will skip any rows with malformed GeoJSON and continue processing.

```sql
CREATE OR REPLACE FUNCTION find_community_by_point(
  point_lon DOUBLE PRECISION,
  point_lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT
) AS $$
DECLARE
  community_rec RECORD;
  point_geom GEOMETRY;
  community_geom GEOMETRY;
  geojson_type TEXT;
  feature JSONB;
BEGIN
  -- Create the point geometry once
  point_geom := ST_SetSRID(ST_Point(point_lon, point_lat), 4326);

  -- Loop through all active communities with geo_json
  FOR community_rec IN
    SELECT c.id, c.name, c.code, c.geo_json
    FROM communities c
    WHERE c.geo_json IS NOT NULL
      AND c.is_active = TRUE
  LOOP
    BEGIN
      -- Determine the GeoJSON type
      geojson_type := community_rec.geo_json::JSONB->>'type';

      IF geojson_type = 'FeatureCollection' THEN
        -- Handle FeatureCollection: extract and combine all feature geometries
        community_geom := ST_Collect(
          ARRAY(
            SELECT ST_GeomFromGeoJSON(feat->'geometry')
            FROM jsonb_array_elements(community_rec.geo_json::JSONB->'features') AS feat
          )
        );

      ELSIF geojson_type = 'Feature' THEN
        -- Handle Feature: extract geometry from the feature
        community_geom := ST_GeomFromGeoJSON(community_rec.geo_json::JSONB->'geometry');

      ELSE
        -- Assume it's a pure Geometry object
        community_geom := ST_GeomFromGeoJSON(community_rec.geo_json::TEXT);
      END IF;

      -- Check if this community contains the point
      IF ST_Contains(community_geom, point_geom) THEN
        -- Found a match, return it
        id := community_rec.id;
        name := community_rec.name;
        code := community_rec.code;
        RETURN NEXT;
        RETURN; -- Exit after first match
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Skip this community if GeoJSON is invalid or processing fails
      -- Continue to next iteration
    END;
  END LOOP;

  RETURN; -- No match found
END;
$$ LANGUAGE plpgsql;
```

**Notes:**
- **Handles multiple GeoJSON formats**:
  - FeatureCollection: Extracts all features and combines geometries
  - Feature: Extracts geometry from feature object
  - Pure Geometry: Uses geometry directly
- Uses `ST_Contains` to check if the point is within the community's geometry
- SRID 4326 is the standard for latitude/longitude coordinates
- Coordinate order is (longitude, latitude) per PostGIS convention
- Returns only the first matching community
- Only returns active communities
- **Gracefully handles invalid GeoJSON** - skips bad data and continues processing
- Creates point geometry once for efficiency
- Compatible with Google Maps and geojson.io GeoJSON formats

## Function 3: find_groups_within_radius

Finds all groups within a specified radius (in meters) of a given point.

```sql
CREATE OR REPLACE FUNCTION find_groups_within_radius(
  point_lon DOUBLE PRECISION,
  point_lat DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  deleted_at TIMESTAMP WITH TIME ZONE,
  latitude NUMERIC,
  longitude NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.is_active,
    g.deleted_at,
    g.latitude,
    g.longitude
  FROM groups g
  WHERE
    g.latitude IS NOT NULL
    AND g.longitude IS NOT NULL
    AND ST_DistanceSphere(
      ST_MakePoint(g.longitude::DOUBLE PRECISION, g.latitude::DOUBLE PRECISION),
      ST_MakePoint(point_lon, point_lat)
    ) <= radius_meters;
END;
$$ LANGUAGE plpgsql;
```

**Notes:**
- Uses `ST_DistanceSphere` for accurate distance calculation on Earth's surface
- Distance is calculated in meters
- Returns all groups (active and inactive, including soft-deleted)
- The API layer filters by `is_active` and `deleted_at` after retrieval
- Coordinate order is (longitude, latitude)

## Function 4: find_igroups_within_radius

Finds all integration groups within a specified radius (in meters) of a given point.

```sql
CREATE OR REPLACE FUNCTION find_igroups_within_radius(
  point_lon DOUBLE PRECISION,
  point_lat DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  is_active BOOLEAN,
  is_accepting_initiated_visitors BOOLEAN,
  is_accepting_uninitiated_visitors BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ig.id,
    ig.is_active,
    ig.is_accepting_initiated_visitors,
    ig.is_accepting_uninitiated_visitors
  FROM i_groups ig
  INNER JOIN groups g ON ig.id = g.id
  WHERE
    g.latitude IS NOT NULL
    AND g.longitude IS NOT NULL
    AND g.deleted_at IS NULL
    AND ST_DistanceSphere(
      ST_MakePoint(g.longitude::DOUBLE PRECISION, g.latitude::DOUBLE PRECISION),
      ST_MakePoint(point_lon, point_lat)
    ) <= radius_meters;
END;
$$ LANGUAGE plpgsql;
```

**Notes:**
- Joins `i_groups` with `groups` to access latitude/longitude
- Excludes soft-deleted groups (`deleted_at IS NULL`)
- Returns `is_active`, `is_accepting_initiated_visitors`, and `is_accepting_uninitiated_visitors` for filtering
- Uses `ST_DistanceSphere` for distance calculation

## Deployment Instructions

1. Open Supabase SQL Editor
2. Run each function creation script above in order
3. Verify functions exist:

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'find_%';
```

## Testing the Functions

### Test find_area_by_point

```sql
-- Example: Portland, Oregon coordinates
SELECT * FROM find_area_by_point(-122.6765, 45.5231);
```

### Test find_community_by_point

```sql
-- Example: Portland, Oregon coordinates
SELECT * FROM find_community_by_point(-122.6765, 45.5231);
```

### Test find_groups_within_radius

```sql
-- Example: Find groups within 50 miles (80,467 meters) of Portland
SELECT * FROM find_groups_within_radius(-122.6765, 45.5231, 80467);
```

### Test find_igroups_within_radius

```sql
-- Example: Find i-groups within 25 miles (40,234 meters) of Portland
SELECT * FROM find_igroups_within_radius(-122.6765, 45.5231, 40234);
```

## Distance Conversion Reference

- 1 mile = 1,609.34 meters
- 25 miles = 40,233.5 meters
- 50 miles = 80,467 meters
- 100 miles = 160,934 meters

## Common Issues

### Error: "function st_contains does not exist"

**Solution:** Enable PostGIS extension:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Error: "geometry contains non-closed rings"

**Problem:** GeoJSON polygon has invalid geometry

**Solution:** Validate and repair GeoJSON data before storing

### No results returned

**Possible causes:**
1. Point is outside all areas/communities
2. `geo_json` field is NULL or invalid
3. No active areas/communities
4. Groups don't have latitude/longitude values

**Debug query:**
```sql
-- Check if areas have valid geo_json
SELECT id, name, geo_json IS NOT NULL as has_geo, is_active
FROM areas;

-- Check if groups have coordinates
SELECT id, name, latitude, longitude
FROM groups
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```
