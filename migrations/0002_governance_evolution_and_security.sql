-- Migração 0002: Tabelas evolutivas de auditoria por item e suporte de sessões/rate-limit (Etapa 3)
-- Permite evolução contínua da governança sem exigir alterações nos 13.130 registros originais TOTVS.

CREATE TABLE IF NOT EXISTS governance_item_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  totvs_code TEXT,
  change_type TEXT NOT NULL,
  tenant_id TEXT,
  requested_by TEXT,
  approved_by TEXT,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_item_events_item
  ON governance_item_events (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_item_events_version
  ON governance_item_events (version DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES governance_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
  ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  blocked_until TEXT
);
