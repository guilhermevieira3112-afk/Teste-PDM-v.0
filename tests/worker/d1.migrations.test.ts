import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteD1TestDatabase } from '../helpers/sqliteD1.ts';
import { D1GovernanceAdapter } from '../../worker/storage/d1Adapter.ts';
import { handleWorkerRequest } from '../../worker/index.ts';
import { signSessionPayload } from '../../worker/middleware/authHook.ts';
import type { Env } from '../../worker/types.ts';
import type { SiteGovernanceDelta } from '../../src/types/governanceSync.ts';

const TEST_SECRET = 'test-stage2-d1-secret-key-premierpet';

describe('Etapa 2 — Migrações SQL D1 e Persistência Real SQLite', () => {
  let testDb: SqliteD1TestDatabase;

  beforeEach(() => {
    testDb = new SqliteD1TestDatabase();
  });

  afterEach(() => {
    testDb.close();
  });

  it('Aplica migrações 0001 e 0002 sem criar tabelas do catálogo TOTVS e sem coluna de senha em texto puro', () => {
    const applied = testDb.applyAllMigrations();
    expect(applied).toEqual([
      '0001_initial_governance.sql',
      '0002_governance_evolution_and_security.sql',
    ]);

    const tables = testDb.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('governance_state');
    expect(tableNames).toContain('governance_history');
    expect(tableNames).toContain('governance_users');
    expect(tableNames).toContain('governance_sync_log');
    expect(tableNames).toContain('governance_settings');
    expect(tableNames).toContain('governance_item_events');
    expect(tableNames).toContain('auth_sessions');
    expect(tableNames).toContain('auth_rate_limits');

    // Garante que os 13.130 registros TOTVS não são armazenados no D1
    expect(tableNames.some((n) => n.includes('totvs') || n.includes('catalog'))).toBe(false);

    // Garante que governance_users possui todas as colunas exigidas e não possui coluna "password" em texto puro
    const userCols = testDb.sqlite
      .prepare('PRAGMA table_info(governance_users)')
      .all() as Array<{ name: string }>;
    const colNames = userCols.map((c) => c.name);

    for (const requiredCol of [
      'id',
      'username',
      'email',
      'role',
      'tenant_id',
      'status',
      'created_at',
      'updated_at',
    ]) {
      expect(colNames).toContain(requiredCol);
    }
    expect(colNames).toContain('password_hash');
    expect(colNames).not.toContain('password');
  });

  it('D1GovernanceAdapter grava estado, histórico, usuários (sem senha), eventos de item e logs no SQLite real', async () => {
    testDb.applyAllMigrations();
    const adapter = new D1GovernanceAdapter(testDb.asBinding());

    const healthBefore = await adapter.getHealthInfo();
    expect(healthBefore.bound).toBe(true);
    expect(healthBefore.connected).toBe(true);
    expect(healthBefore.schemaReady).toBe(true);
    expect(healthBefore.currentVersion).toBe(0);

    const delta: SiteGovernanceDelta = {
      version: 0,
      updatedAt: '2026-11-13T14:00:00.000Z',
      updatedBy: 'Carlos Silva',
      users: [
        {
          id: 'usr-d1-01',
          username: 'ana.souza',
          name: 'Ana Souza',
          email: 'ana.souza@premierpet.com.br',
          password: 'PLAIN_PASSWORD_MUST_BE_STRIPPED',
          totpSecret: 'SECRET_MUST_BE_STRIPPED',
          role: 'ALMOXARIFADO',
          tenantId: 'dourado-sp',
          tenantName: 'Unidade Dourado / SP',
          approvalTier: 1,
          status: 'ACTIVE',
          createdAt: '2026-11-13T13:00:00.000Z',
        },
      ],
      global2FARequired: true,
      pdmLevels: [],
      customPdmItems: [],
      itemOverrides: {
        'totvs-9001': {
          itemId: 'totvs-9001',
          totvsCode: '5040-9001',
          shortDescription: 'CORREIA DENTADA HTD 8M',
          ncm: '40103900',
          updatedAt: '2026-11-13T14:00:00.000Z',
          changeHistory: [
            {
              id: 'chg-1',
              actionType: 'EDITED',
              actionLabel: 'Alteração NCM',
              requestedByUser: 'Ana Souza',
              approvedByUser: 'Carlos Silva',
              status: 'APPROVED',
              timestamp: '2026-11-13T14:00:00.000Z',
              changes: [],
            },
          ],
        },
      },
      movements: [],
    };

    const env: Env = {
      DB: testDb.asBinding(),
      AUTH_SESSION_SECRET: TEST_SECRET,
      APP_ENV: 'production',
    };

    const token = await signSessionPayload(
      {
        userId: 'usr-master',
        username: 'carlos.silva',
        name: 'Carlos Silva',
        role: 'MASTER_ADMIN',
        tenantId: 'dourado-sp',
        approvalTier: 'ALL',
        exp: Date.now() + 60_000,
      },
      TEST_SECRET
    );

    const putRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: delta, baseVersion: 0, updatedBy: 'Carlos Silva' }),
      }),
      env
    );

    expect(putRes.status).toBe(200);

    // Verifica persistência nas 4 tabelas principais + tabela evolutiva
    const stateRow = testDb.sqlite
      .prepare('SELECT id, version, updated_by, delta_json FROM governance_state WHERE id = 1')
      .get() as { id: number; version: number; updated_by: string; delta_json: string };
    expect(stateRow.version).toBe(1);
    expect(stateRow.updated_by).toBe('Carlos Silva');
    expect(stateRow.delta_json).not.toContain('PLAIN_PASSWORD_MUST_BE_STRIPPED');
    expect(stateRow.delta_json).not.toContain('SECRET_MUST_BE_STRIPPED');

    const userRow = testDb.sqlite
      .prepare('SELECT id, username, email, role, tenant_id, status, password_hash FROM governance_users WHERE id = ?')
      .get('usr-d1-01') as {
      id: string;
      username: string;
      email: string;
      role: string;
      tenant_id: string;
      status: string;
      password_hash: string | null;
    };
    expect(userRow.username).toBe('ana.souza');
    expect(userRow.tenant_id).toBe('dourado-sp');
    expect(userRow.status).toBe('ACTIVE');
    expect(userRow.password_hash).toBeNull();

    const historyRows = testDb.sqlite
      .prepare('SELECT version, operation, sync_status FROM governance_history')
      .all() as Array<{ version: number; operation: string; sync_status: string }>;
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].operation).toBe('PUT_STATE');
    expect(historyRows[0].sync_status).toBe('LOCAL_ONLY');

    const syncLogRows = testDb.sqlite
      .prepare('SELECT version, destination, status FROM governance_sync_log')
      .all() as Array<{ version: number; destination: string; status: string }>;
    expect(syncLogRows).toHaveLength(1);
    expect(syncLogRows[0].destination).toBe('SHAREPOINT_POWER_AUTOMATE');
    expect(syncLogRows[0].status).toBe('LOCAL_ONLY');

    const itemEvents = testDb.sqlite
      .prepare('SELECT item_id, totvs_code, change_type, version FROM governance_item_events')
      .all() as Array<{ item_id: string; totvs_code: string; change_type: string; version: number }>;
    expect(itemEvents).toHaveLength(1);
    expect(itemEvents[0].item_id).toBe('totvs-9001');
    expect(itemEvents[0].totvs_code).toBe('5040-9001');

    // Confirma que /api/governance/health reflete exatamente as contagens no D1
    const healthAfter = await adapter.getHealthInfo();
    expect(healthAfter.currentVersion).toBe(1);
    expect(healthAfter.counts).toEqual({
      users: 1,
      history: 1,
      syncLogs: 1,
    });
  });

  it('Enforce CHECK constraint para papel/status inválido e constraint de linha única id=1 em governance_state', () => {
    testDb.applyAllMigrations();

    expect(() =>
      testDb.sqlite
        .prepare("INSERT INTO governance_state (id, version, updated_at, delta_json) VALUES (2, 1, '2026-11-13', '{}')")
        .run()
    ).toThrow();

    expect(() =>
      testDb.sqlite
        .prepare(
          "INSERT INTO governance_users (id, username, email, role, tenant_id, status, created_at, updated_at) VALUES ('u1', 'x', 'x@p.com', 'ROLE_INVALIDA', 'dourado-sp', 'ACTIVE', '2026-11-13', '2026-11-13')"
        )
        .run()
    ).toThrow();
  });
});
