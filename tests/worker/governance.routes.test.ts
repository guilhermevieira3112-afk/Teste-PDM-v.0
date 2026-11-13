import { describe, it, expect } from 'vitest';
import { handleWorkerRequest } from '../../worker/index.ts';
import { signSessionPayload } from '../../worker/middleware/authHook.ts';
import type { Env, GovernanceRole } from '../../worker/types.ts';
import type { SiteGovernanceDelta } from '../../src/types/governanceSync.ts';
import type { PowerAutomateClient } from '../../worker/integrations/powerAutomateClient.ts';

class MockD1Statement {
  private readonly sql: string;
  private readonly store: InMemoryD1Mock;
  private args: unknown[] = [];

  constructor(store: InMemoryD1Mock, sql: string) {
    this.store = store;
    this.sql = sql;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.args = values;
    return this as unknown as D1PreparedStatement;
  }

  async first<T = unknown>(): Promise<T | null> {
    return this.store.execFirst(this.sql, this.args) as T | null;
  }

  async run(): Promise<D1Result> {
    return this.store.execRun(this.sql, this.args);
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
  }

  async raw(): Promise<unknown[]> {
    return [];
  }
}

class InMemoryD1Mock {
  public schemaReady: boolean;
  public stateRow: {
    id: number;
    version: number;
    updated_at: string;
    updated_by: string | null;
    delta_json: string;
  } | null = null;
  public historyRows: Array<{
    version: number;
    operation: string;
    updated_at: string;
    updated_by: string;
    payload: string;
    sync_status: string;
  }> = [];
  public syncLogs: Array<{
    version: number;
    destination: string;
    status: string;
    message: string;
    created_at: string;
  }> = [];

  constructor(schemaReady = true) {
    this.schemaReady = schemaReady;
  }

  prepare(sql: string): D1PreparedStatement {
    return new MockD1Statement(this, sql) as unknown as D1PreparedStatement;
  }

  asBinding(): D1Database {
    return this as unknown as D1Database;
  }

  execFirst(sql: string, args: unknown[]): unknown {
    const normalized = sql.trim().toLowerCase();
    if (normalized.startsWith('select 1')) {
      return { ok: 1 };
    }
    if (normalized.includes('from sqlite_master')) {
      return this.schemaReady ? { name: String(args[0] || 'governance_state') } : null;
    }
    if (!this.schemaReady) {
      throw new Error('no such table: governance_state');
    }
    if (normalized.includes('select count(*) as total from governance_users')) {
      return { total: 0 };
    }
    if (normalized.includes('select count(*) as total from governance_history')) {
      return { total: this.historyRows.length };
    }
    if (normalized.includes('select count(*) as total from governance_sync_log')) {
      return { total: this.syncLogs.length };
    }
    if (normalized.includes('from governance_state')) {
      return this.stateRow;
    }
    return null;
  }

  execRun(sql: string, args: unknown[]): D1Result {
    if (!this.schemaReady) {
      throw new Error('no such table: governance_state');
    }

    const normalized = sql.trim().toLowerCase();
    let changes = 0;

    if (normalized.startsWith('insert into governance_state')) {
      const [version, updated_at, updated_by, delta_json] = args as [
        number,
        string,
        string,
        string,
      ];
      this.stateRow = { id: 1, version, updated_at, updated_by, delta_json };
      changes = 1;
    } else if (normalized.startsWith('update governance_state')) {
      const [nextVersion, updated_at, updated_by, delta_json, expectedVersion] = args as [
        number,
        string,
        string,
        string,
        number,
      ];
      if (this.stateRow && this.stateRow.version === expectedVersion) {
        this.stateRow = {
          id: 1,
          version: nextVersion,
          updated_at,
          updated_by,
          delta_json,
        };
        changes = 1;
      }
    } else if (normalized.startsWith('insert into governance_history')) {
      const [version, operation, updated_at, updated_by, payload, sync_status] = args as [
        number,
        string,
        string,
        string,
        string,
        string,
      ];
      this.historyRows.push({ version, operation, updated_at, updated_by, payload, sync_status });
      changes = 1;
    } else if (normalized.startsWith('update governance_history')) {
      const [sync_status, version] = args as [string, number];
      for (const row of this.historyRows) {
        if (row.version === version) {
          row.sync_status = sync_status;
          changes += 1;
        }
      }
    } else if (normalized.startsWith('insert into governance_sync_log')) {
      const [version, destination, status, message, created_at] = args as [
        number,
        string,
        string,
        string,
        string,
      ];
      this.syncLogs.push({ version, destination, status, message, created_at });
      changes = 1;
    }

    return {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: changes,
        last_row_id: changes,
        changed_db: changes > 0,
        changes,
      },
    };
  }
}

class InMemoryR2Mock {
  private readonly objects = new Map<
    string,
    { data: ArrayBuffer; contentType: string; etag: string }
  >();

  async put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<void> {
    this.objects.set(key, {
      data: value,
      contentType: options?.httpMetadata?.contentType || 'application/octet-stream',
      etag: `"etag-${key}"`,
    });
  }

  async get(key: string): Promise<unknown | null> {
    const entry = this.objects.get(key);
    if (!entry) return null;
    return {
      body: entry.data,
      size: entry.data.byteLength,
      httpEtag: entry.etag,
      httpMetadata: { contentType: entry.contentType },
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  asBinding(): R2Bucket {
    return this as unknown as R2Bucket;
  }
}

const TEST_SECRET = 'test-stage1-hmac-secret-key-premierpet';

async function makeAuthHeaders(
  role: GovernanceRole = 'MASTER_ADMIN',
  tenantId = 'dourado-sp'
): Promise<Record<string, string>> {
  const token = await signSessionPayload(
    {
      userId: `usr-${role.toLowerCase()}`,
      username: `user.${role.toLowerCase()}`,
      name: `Teste ${role}`,
      role,
      tenantId,
      approvalTier: role === 'MASTER_ADMIN' ? 'ALL' : 1,
      exp: Date.now() + 60 * 60 * 1000,
    },
    TEST_SECRET
  );

  return {
    Authorization: `Bearer ${token}`,
  };
}

function createBaseDelta(overrides: Partial<SiteGovernanceDelta> = {}): SiteGovernanceDelta {
  return {
    version: 0,
    updatedAt: '2026-11-13T12:00:00.000Z',
    updatedBy: 'Teste Unitário',
    users: [],
    global2FARequired: true,
    pdmLevels: [],
    customPdmItems: [],
    itemOverrides: {},
    movements: [],
    ...overrides,
  };
}

function createFakePowerAutomate(
  opts: {
    writeStatus?: 'SYNCED' | 'LOCAL_ONLY' | 'ERROR';
    readStatus?: 'SYNCED' | 'LOCAL_ONLY' | 'ERROR';
    remoteDelta?: SiteGovernanceDelta | null;
    emailSent?: boolean;
  } = {}
): PowerAutomateClient {
  const writeConfigured = (opts.writeStatus ?? 'LOCAL_ONLY') !== 'LOCAL_ONLY';
  const readConfigured = (opts.readStatus ?? 'LOCAL_ONLY') !== 'LOCAL_ONLY';
  const emailConfigured = opts.emailSent !== undefined;

  return {
    getConfigFlags: () => ({ writeConfigured, readConfigured, emailConfigured }),
    async readLatestDelta() {
      const status = opts.readStatus ?? 'LOCAL_ONLY';
      return {
        status,
        message:
          status === 'SYNCED'
            ? 'Leitura simulada OK'
            : status === 'ERROR'
              ? 'Power Automate READ indisponível'
              : 'Não configurado',
        remoteDelta: opts.remoteDelta ?? null,
      };
    },
    async writeDelta(delta) {
      const status = opts.writeStatus ?? 'LOCAL_ONLY';
      return {
        status,
        message:
          status === 'SYNCED'
            ? `Sincronizado v${delta.version}`
            : status === 'ERROR'
              ? 'Falha HTTP 500 no Power Automate WRITE'
              : 'Salvo apenas no D1 (SharePoint não configurado).',
      };
    },
    async sendApprovalEmail() {
      if (!emailConfigured) {
        return {
          sentViaPowerAutomate: false,
          message: 'POWER_AUTOMATE_EMAIL_URL não configurada.',
        };
      }
      return {
        sentViaPowerAutomate: Boolean(opts.emailSent),
        message: opts.emailSent ? 'E-mail enviado.' : 'Falha no conector Outlook.',
      };
    },
  };
}

describe('Etapa 1 — Cloudflare Worker Native Routes & Contracts', () => {
  it('GET /api/governance/health reporta D1 não vinculado quando env.DB está ausente', async () => {
    const env: Env = { APP_ENV: 'production' };
    const req = new Request('https://pdm.premierpet.test/api/governance/health');
    const res = await handleWorkerRequest(req, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      runtime: string;
      d1: { bound: boolean; schemaReady: boolean };
      auth: { protected: boolean };
    };

    expect(body.runtime).toBe('cloudflare-workers');
    expect(body.ok).toBe(false);
    expect(body.d1.bound).toBe(false);
    expect(body.d1.schemaReady).toBe(false);
    expect(body.auth.protected).toBe(true);
  });

  it('GET /api/governance/health distingue D1 conectado sem migrações SQL (Etapa 2)', async () => {
    const d1 = new InMemoryD1Mock(false);
    const env: Env = { DB: d1.asBinding(), APP_ENV: 'production' };
    const req = new Request('https://pdm.premierpet.test/api/governance/health');
    const res = await handleWorkerRequest(req, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      d1: { bound: boolean; connected: boolean; schemaReady: boolean };
    };

    expect(body.ok).toBe(true);
    expect(body.d1.bound).toBe(true);
    expect(body.d1.connected).toBe(true);
    expect(body.d1.schemaReady).toBe(false);
  });

  it('Bloqueia endpoints de governança e arquivos sem autenticação (401)', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };

    const protectedRequests = [
      new Request('https://pdm.premierpet.test/api/governance/state'),
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta() }),
      }),
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      new Request('https://pdm.premierpet.test/api/governance/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      new Request('https://pdm.premierpet.test/api/files/items/foto.png'),
    ];

    for (const req of protectedRequests) {
      const res = await handleWorkerRequest(req, env);
      expect(res.status).toBe(401);
    }
  });

  it('Bloqueia perfis sem autorização administrativa em notify-email e sync (403)', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MANUTENCAO_PRODUCAO');

    const syncRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(syncRes.status).toBe(403);

    const emailRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/notify-email', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env
    );
    expect(emailRes.status).toBe(403);
  });

  it('Retorna 503 quando D1 não está vinculado ou schema não foi migrado (sem fallback em memória)', async () => {
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    const noDbEnv: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
    const resNoDb = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', { headers }),
      noDbEnv
    );
    expect(resNoDb.status).toBe(503);
    expect(((await resNoDb.json()) as { code: string }).code).toBe('D1_NOT_BOUND');

    const unmigratedD1 = new InMemoryD1Mock(false);
    const unmigratedEnv: Env = { DB: unmigratedD1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const resNoSchema = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', { headers }),
      unmigratedEnv
    );
    expect(resNoSchema.status).toBe(503);
    expect(((await resNoSchema.json()) as { code: string }).code).toBe(
      'D1_SCHEMA_NOT_INITIALIZED'
    );
  });

  it('PUT /api/governance/state grava no D1, remove senhas/segredos TOTP e incrementa versão', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    const payload = createBaseDelta({
      users: [
        {
          id: 'u-1',
          username: 'joao.silva',
          name: 'João Silva',
          email: 'joao.silva@premierpet.com.br',
          password: 'SUPER_SECRET_PASSWORD',
          totpSecret: 'JBSWY3DPEHPK3PXP',
          role: 'ALMOXARIFADO',
          tenantId: 'dourado-sp',
          tenantName: 'Unidade Dourado / SP',
          status: 'ACTIVE',
          createdAt: '2026-11-13T10:00:00Z',
        },
      ],
    });

    const putRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: payload, baseVersion: 0, updatedBy: 'Master' }),
      }),
      env
    );

    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as { state: SiteGovernanceDelta };
    expect(putBody.state.version).toBe(1);
    expect(putBody.state.users[0].password).toBeUndefined();
    expect(putBody.state.users[0].totpSecret).toBeUndefined();
    expect(d1.stateRow?.delta_json).not.toContain('SUPER_SECRET_PASSWORD');
    expect(d1.stateRow?.delta_json).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('Concorrência: preserva alterações em registros independentes e bloqueia conflito no mesmo item (409)', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headersA = await makeAuthHeaders('ALMOXARIFADO', 'dourado-sp');
    const headersB = await makeAuthHeaders('ALMOXARIFADO', 'porto-amazonas-pr');

    // Estado inicial v1
    await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headersA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta(), baseVersion: 0 }),
      }),
      env
    );

    // Unidade A altera item-100 a partir da v1 -> v2
    const unitADelta = createBaseDelta({
      version: 1,
      itemOverrides: {
        'item-100': {
          itemId: 'item-100',
          shortDescription: 'ROLAMENTO SKF 6205',
          updatedAt: '2026-11-13T12:01:00Z',
        },
      },
    });
    const resA = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headersA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: unitADelta, baseVersion: 1 }),
      }),
      env
    );
    expect(resA.status).toBe(200);

    // Unidade B altera item-200 ainda partindo da v1 -> merge automático sem perda -> v3
    const unitBDelta = createBaseDelta({
      version: 1,
      itemOverrides: {
        'item-200': {
          itemId: 'item-200',
          ncm: '84821010',
          updatedAt: '2026-11-13T12:01:30Z',
        },
      },
    });
    const resB = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headersB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: unitBDelta, baseVersion: 1 }),
      }),
      env
    );
    expect(resB.status).toBe(200);
    const bodyB = (await resB.json()) as {
      state: SiteGovernanceDelta;
      mergedConcurrently: boolean;
    };
    expect(bodyB.mergedConcurrently).toBe(true);
    expect(bodyB.state.version).toBe(3);
    expect(bodyB.state.itemOverrides['item-100']?.shortDescription).toBe('ROLAMENTO SKF 6205');
    expect(bodyB.state.itemOverrides['item-200']?.ncm).toBe('84821010');

    // Agora Unidade B tenta sobrescrever o MESMO item-100 partindo de versão desatualizada (v1) -> 409 CONFLICT
    const conflictingDelta = createBaseDelta({
      version: 1,
      itemOverrides: {
        'item-100': {
          itemId: 'item-100',
          shortDescription: 'ROLAMENTO CONFLITANTE',
          updatedAt: '2026-11-13T12:02:00Z',
        },
      },
    });
    const resConflict = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headersB, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: conflictingDelta, baseVersion: 1 }),
      }),
      env
    );
    expect(resConflict.status).toBe(409);
    const conflictBody = (await resConflict.json()) as { code: string };
    expect(conflictBody.code).toBe('VERSION_CONFLICT');
  });

  it('GET /api/governance/state?refresh=1 não sobrescreve versão mais nova do D1', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    // Grava v1 e v2 no D1
    await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta(), baseVersion: 0 }),
      }),
      env
    );
    await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: createBaseDelta({
            version: 1,
            itemOverrides: { 'item-1': { itemId: 'item-1', ncm: '40103900', updatedAt: '2026-11-13T12:00:00Z' } },
          }),
          baseVersion: 1,
        }),
      }),
      env
    );

    const staleSharePoint = createFakePowerAutomate({
      readStatus: 'SYNCED',
      remoteDelta: createBaseDelta({ version: 1 }),
    });

    const res = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state?refresh=1', { headers }),
      env,
      { powerAutomate: staleSharePoint }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: SiteGovernanceDelta };
    expect(body.state.version).toBe(2);
    expect(body.state.itemOverrides['item-1']?.ncm).toBe('40103900');
  });

  it('POST /api/governance/sync retorna status real (LOCAL_ONLY, ERROR 502 e SYNCED)', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    // 1. Apenas local -> synced: false, lastSyncStatus: LOCAL_ONLY
    const resLocal = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta(), baseVersion: 0 }),
      }),
      env,
      { powerAutomate: createFakePowerAutomate({ writeStatus: 'LOCAL_ONLY' }) }
    );
    expect(resLocal.status).toBe(200);
    const localBody = (await resLocal.json()) as {
      synced: boolean;
      sharePoint: { lastSyncStatus: string };
    };
    expect(localBody.synced).toBe(false);
    expect(localBody.sharePoint.lastSyncStatus).toBe('LOCAL_ONLY');

    // 2. Falha no Power Automate -> 502, synced: false, lastSyncStatus: ERROR, registra log
    const resErr = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env,
      { powerAutomate: createFakePowerAutomate({ writeStatus: 'ERROR' }) }
    );
    expect(resErr.status).toBe(502);
    const errBody = (await resErr.json()) as {
      synced: boolean;
      sharePoint: { lastSyncStatus: string };
    };
    expect(errBody.synced).toBe(false);
    expect(errBody.sharePoint.lastSyncStatus).toBe('ERROR');
    expect(d1.syncLogs.some((l) => l.status === 'ERROR')).toBe(true);
  });

  it('POST /api/governance/notify-email valida entrada e envia quando autorizado', async () => {
    const d1 = new InMemoryD1Mock(true);
    const env: Env = { DB: d1.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    const badEmailRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/notify-email', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'email-invalido',
          subject: 'Acesso Liberado',
          userName: 'Maria',
          username: 'maria.silva',
          roleLabel: 'Almoxarifado',
          tenantName: 'Dourado',
          loginUrl: 'https://pdm.premierpet.com.br',
        }),
      }),
      env
    );
    expect(badEmailRes.status).toBe(400);

    const okRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/notify-email', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'maria.silva@premierpet.com.br',
          subject: 'Acesso Liberado - Portal PDM',
          userName: 'Maria Silva',
          username: 'maria.silva',
          roleLabel: 'Almoxarifado',
          tenantName: 'Unidade Dourado / SP',
          loginUrl: 'https://pdm.premierpet.com.br',
        }),
      }),
      env,
      { powerAutomate: createFakePowerAutomate({ emailSent: true }) }
    );
    expect(okRes.status).toBe(200);
    const okBody = (await okRes.json()) as { sentViaPowerAutomate: boolean };
    expect(okBody.sentViaPowerAutomate).toBe(true);
  });

  it('R2 (/api/files/upload e GET /api/files/:key) armazena imagem e rejeita MIME inválido', async () => {
    const r2 = new InMemoryR2Mock();
    const env: Env = { MEDIA_BUCKET: r2.asBinding(), AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('ALMOXARIFADO');

    const badForm = new FormData();
    badForm.append('file', new File(['<script>alert(1)</script>'], 'xss.html', { type: 'text/html' }));
    const badRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/files/upload', {
        method: 'POST',
        headers,
        body: badForm,
      }),
      env
    );
    expect(badRes.status).toBe(415);

    const okForm = new FormData();
    okForm.append('category', 'items');
    okForm.append('itemId', 'totvs-1042');
    okForm.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'peca.png', { type: 'image/png' }));

    const uploadRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/files/upload', {
        method: 'POST',
        headers,
        body: okForm,
      }),
      env
    );
    expect(uploadRes.status).toBe(201);
    const uploadBody = (await uploadRes.json()) as { file: { url: string; contentType: string } };
    expect(uploadBody.file.url).toMatch(/^\/api\/files\/items\/totvs-1042\//);

    const getRes = await handleWorkerRequest(
      new Request(`https://pdm.premierpet.test${uploadBody.file.url}`, { headers }),
      env
    );
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('Content-Type')).toBe('image/png');
  });

  it('Rota /api/* inexistente retorna JSON 404 (não cai no fallback SPA)', async () => {
    const env: Env = {};
    const res = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/rota-inexistente'),
      env
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });
});
