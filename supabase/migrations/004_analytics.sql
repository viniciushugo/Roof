-- ============================================================
-- Analytics events table
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  event       TEXT         NOT NULL,
  properties  JSONB        DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_analytics_event   ON analytics_events(event);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can insert events
CREATE POLICY "analytics_insert_all"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

-- Users can only read their own events
CREATE POLICY "analytics_read_own"
  ON analytics_events FOR SELECT
  USING (auth.uid() = user_id);
