-- Add geocoding columns to listings table for map view
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS lat float8,
  ADD COLUMN IF NOT EXISTS lng float8,
  ADD COLUMN IF NOT EXISTS address_raw text,
  ADD COLUMN IF NOT EXISTS address_precision text
    CHECK (address_precision IN ('exact','postcode','neighbourhood','city')),
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_attempts int DEFAULT 0;

-- Spatial indexes for map viewport queries
CREATE INDEX IF NOT EXISTS listings_latlong_idx ON listings (lat, lng);
CREATE INDEX IF NOT EXISTS listings_active_latlong_idx ON listings (is_active, lat, lng);
