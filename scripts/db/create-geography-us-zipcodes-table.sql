-- Drop existing table
DROP TABLE IF EXISTS public.geography_us_zipcodes CASCADE;

-- Create geography_us_zipcodes table for SimpleMaps US Zipcodes data
CREATE TABLE IF NOT EXISTS public.geography_us_zipcodes (
  -- Primary identifier (5-digit zipcode)
  zip TEXT PRIMARY KEY,

  -- Geographic coordinates
  lat NUMERIC(10, 6) NOT NULL,
  lng NUMERIC(10, 6) NOT NULL,

  -- City information
  city TEXT NOT NULL,

  -- State information
  state_id TEXT NOT NULL,  -- 2-letter state code (e.g., "CA", "NY")
  state_name TEXT NOT NULL,

  -- ZCTA information
  zcta TEXT,  -- ZIP Code Tabulation Area
  parent_zcta TEXT,  -- Parent ZCTA for PO Box-only zips

  -- Population data
  population INTEGER,
  density NUMERIC,

  -- County information
  county_fips TEXT,
  county_name TEXT,
  county_weights TEXT,  -- Allocation factors for multiple counties
  county_names_all TEXT,  -- All counties (comma-separated)
  county_fips_all TEXT,  -- All county FIPS codes (comma-separated)

  -- Additional metadata
  imprecise BOOLEAN,  -- Whether coordinates are imprecise (e.g., PO Box only)
  military BOOLEAN,  -- Whether this is a military zipcode
  timezone TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_city ON public.geography_us_zipcodes (city);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_state_id ON public.geography_us_zipcodes (state_id);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_city_state ON public.geography_us_zipcodes (city, state_id);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_lat_lng ON public.geography_us_zipcodes (lat, lng);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_county_fips ON public.geography_us_zipcodes (county_fips);
CREATE INDEX IF NOT EXISTS idx_geography_us_zipcodes_population ON public.geography_us_zipcodes (population DESC NULLS LAST);

-- Add comment to table
COMMENT ON TABLE public.geography_us_zipcodes IS 'US Zipcodes data from SimpleMaps (simplemaps.com) - Basic edition v1.911';
