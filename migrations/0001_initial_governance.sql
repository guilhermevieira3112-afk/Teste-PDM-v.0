-- Migração 0001: Estrutura principal do banco de governança PDM no Cloudflare D1
-- Regra obrigatória: NÃO armazena os ~13.130 registros originais do catálogo TOTVS.
-- Armazena exclusivamente o estado delta, histórico de governança, perfis de usuários (sem senhas em texto puro) e logs de sincronização.

CREATE TABLE IF NOT EXISTS governance_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  delta_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS governance_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL,
  operation TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  payload TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY'
);

CREATE INDEX IF NOT EXISTS idx_governance_history_version
  ON governance_history (version DESC);

CREATE INDEX IF NOT EXISTS idx_governance_history_updated_at
  ON governance_history (updated_at DESC);

CREATE TABLE IF NOT EXISTS governance_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (
    role IN ('MASTER_ADMIN', 'ALMOXARIFADO', 'MANUTENCAO_PRODUCAO', 'UNIT_MANAGER')
  ),
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (
    status IN ('ACTIVE', 'BLOCKED', 'PENDING_APPROVAL')
  ),
  name TEXT NOT NULL DEFAULT '',
  profile_title TEXT,
  tenant_name TEXT,
  approval_tier TEXT CHECK (
    approval_tier IS NULL OR approval_tier IN ('1', '2', '3', 'ALL')
  ),
  department TEXT,
  two_factor_enabled INTEGER NOT NULL DEFAULT 1,
  -- Segurança: armazenar apenas hash criptográfico (PBKDF2) na Etapa 3; nunca senha em texto puro.
  password_hash TEXT,
  totp_secret TEXT,
  approved_at TEXT,
  approved_by TEXT,
  blocked_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_users_status
  ON governance_users (status);

CREATE INDEX IF NOT EXISTS idx_governance_users_tenant
  ON governance_users (tenant_id);

CREATE TABLE IF NOT EXISTS governance_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL,
  destination TEXT NOT NULL DEFAULT 'SHAREPOINT_POWER_AUTOMATE',
  status TEXT NOT NULL CHECK (status IN ('SYNCED', 'LOCAL_ONLY', 'ERROR', 'IDLE')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_sync_log_version
  ON governance_sync_log (version DESC);

CREATE INDEX IF NOT EXISTS idx_governance_sync_log_created_at
  ON governance_sync_log (created_at DESC);

CREATE TABLE IF NOT EXISTS governance_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
