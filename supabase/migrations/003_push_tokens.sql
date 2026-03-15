-- ============================================================
-- Push notification device tokens
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

-- RLS: users manage their own tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_self_all" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Service role can read all tokens (needed by edge function)
CREATE POLICY "push_tokens_service_read" ON push_tokens
  FOR SELECT USING (true);
