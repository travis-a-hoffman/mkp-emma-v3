-- Drop existing table
DROP TABLE IF EXISTS public.geography_us_cities CASCADE;

-- Create geography_us_cities table for SimpleMaps US Cities data
CREATE TABLE IF NOT EXISTS public.geography_us_cities (
  -- Primary identifier
  id TEXT PRIMARY KEY,

  -- City information
  city TEXT NOT NULL,
  city_ascii TEXT NOT NULL,

  -- State information
  state_id TEXT NOT NULL,  -- 2-letter state code (e.g., "CA", "NY")
  state_name TEXT NOT NULL,

  -- County information
  county_fips TEXT,
  county_name TEXT,

  -- Geographic coordinates
  lat NUMERIC(10, 6) NOT NULL,
  lng NUMERIC(10, 6) NOT NULL,

  -- Population data
  population INTEGER,
  density NUMERIC,

  -- Additional metadata
  source TEXT,
  military BOOLEAN,
  incorporated BOOLEAN,
  timezone TEXT,
  ranking INTEGER,
  zips TEXT,  -- Comma-separated list of zip codes

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_geography_us_cities_city ON public.geography_us_cities (city);
CREATE INDEX IF NOT EXISTS idx_geography_us_cities_state_id ON public.geography_us_cities (state_id);
CREATE INDEX IF NOT EXISTS idx_geography_us_cities_city_state ON public.geography_us_cities (city, state_id);
CREATE INDEX IF NOT EXISTS idx_geography_us_cities_lat_lng ON public.geography_us_cities (lat, lng);
CREATE INDEX IF NOT EXISTS idx_geography_us_cities_population ON public.geography_us_cities (population DESC NULLS LAST);

-- Add comment to table
COMMENT ON TABLE public.geography_us_cities IS 'US Cities data from SimpleMaps (simplemaps.com) - Basic edition v1.91';
