-- ============================================================
-- Roof — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- LISTINGS  (scraped from Pararius, Kamernet, Funda, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS listings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   TEXT        UNIQUE NOT NULL,   -- stable hash of source + URL
  title         TEXT        NOT NULL,
  neighborhood  TEXT,
  city          TEXT        NOT NULL,
  price         INTEGER     NOT NULL,           -- €/month
  type          TEXT,                           -- 'Private room' | 'Studio' | 'Apartment' | 'Shared room'
  size          INTEGER,                        -- m²
  rooms         INTEGER,
  furnished     TEXT,                           -- 'furnished' | 'unfurnished' | 'upholstered'
  source        TEXT        NOT NULL,           -- 'Pararius' | 'Kamernet' | 'Funda' | 'HousingAnywhere'
  url           TEXT        NOT NULL,
  image_url     TEXT,
  available_from TEXT,
  description   TEXT,
  is_new        BOOLEAN     DEFAULT false,
  is_active     BOOLEAN     DEFAULT true,       -- set false when listing disappears
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feed queries
CREATE INDEX IF NOT EXISTS listings_city_idx       ON listings (city);
CREATE INDEX IF NOT EXISTS listings_price_idx      ON listings (price);
CREATE INDEX IF NOT EXISTS listings_type_idx       ON listings (type);
CREATE INDEX IF NOT EXISTS listings_is_new_idx     ON listings (is_new);
CREATE INDEX IF NOT EXISTS listings_is_active_idx  ON listings (is_active);
CREATE INDEX IF NOT EXISTS listings_source_idx     ON listings (source);


-- ============================================================
-- PROFILES  (extends Supabase Auth users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name         TEXT,
  cities       TEXT[]      DEFAULT '{}',
  housing_type TEXT        DEFAULT 'any',   -- matches onboarding housingType
  budget_min   INTEGER     DEFAULT 0,
  budget_max   INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Add gender column to profiles (collected during onboarding)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add notification preferences column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"instantAlerts":true,"emailAlerts":true,"dailyDigest":false}';


-- ============================================================
-- PUSH TOKENS  (device tokens for APNs / FCM)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        NOT NULL DEFAULT 'ios',  -- 'ios' | 'android' | 'web'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);


-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES profiles (id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  cities        TEXT[]      DEFAULT '{}',
  housing_type  TEXT        DEFAULT 'all',   -- 'all' | 'room' | 'studio' | 'apartment'
  budget_min    INTEGER     DEFAULT 0,
  budget_max    INTEGER     DEFAULT 0,
  filters       JSONB       DEFAULT '{}',    -- ActiveFilters (size, rooms, furnished, neighborhoods)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON alerts (user_id);


-- ============================================================
-- SAVED LISTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_listings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES profiles (id) ON DELETE CASCADE,
  listing_id UUID        REFERENCES listings (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS saved_user_id_idx ON saved_listings (user_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- listings: public read, no direct user writes (scraper uses service key)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_public_read" ON listings FOR SELECT USING (true);

-- profiles: each user can only read/write their own row
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- alerts: each user can only manage their own alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_self_all"   ON alerts FOR ALL USING (auth.uid() = user_id);

-- saved_listings: each user can only manage their own saves
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_self_all" ON saved_listings FOR ALL USING (auth.uid() = user_id);

-- push_tokens: each user can manage their own tokens; service role can read all
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_tokens_self_all" ON push_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "push_tokens_service_read" ON push_tokens FOR SELECT USING (true);

-- ============================================================
-- Storage: listing-images bucket (run ONCE in SQL Editor)
-- ============================================================
-- Creates a public bucket for scraped listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public reads
CREATE POLICY "listing_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

-- Allow service role to upload (scraper uses service_role key)
CREATE POLICY "listing_images_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listing-images');


-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  event       TEXT         NOT NULL,
  properties  JSONB        DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event   ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_insert_all" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_read_own"   ON analytics_events FOR SELECT USING (auth.uid() = user_id);


-- ============================================================
-- REALTIME: enable for listings table (needed for in-app notifications)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE listings;
