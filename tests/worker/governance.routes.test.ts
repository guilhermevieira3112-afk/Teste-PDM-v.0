import { describe, it, expect } from 'vitest';
import { handleWorkerRequest } from '../../worker/index.ts';
import { signSessionPayload } from '../../worker/middleware/authHook.ts';
import type { Env, GovernanceRole } from '../../worker/types.ts';
import type { SiteGovernanceDelta } from '../../src/types/governanceSync.ts';
import type { PowerAutomateClient } from '../../worker/integrations/powerAutomateClient.ts';

const TEST_SECRET = 'test-hmac-secret-key-premierpet';

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
              : 'Operando apenas localmente (SharePoint não configurado).',
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

describe('Cloudflare Worker — Rotas sem D1 e sem R2', () => {
  it('GET /api/governance/health responde 200 reportando D1 e R2 desativados temporariamente', async () => {
    const env: Env = { APP_ENV: 'production' };
    const req = new Request('https://pdm.premierpet.test/api/governance/health');
    const res = await handleWorkerRequest(req, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      runtime: string;
      storage: { mode: string; d1Enabled: boolean; r2Enabled: boolean };
      auth: { protected: boolean };
    };

    expect(body.ok).toBe(true);
    expect(body.runtime).toBe('cloudflare-workers');
    expect(body.storage.mode).toBe('CLIENT_LOCAL_ONLY');
    expect(body.storage.d1Enabled).toBe(false);
    expect(body.storage.r2Enabled).toBe(false);
    expect(body.auth.protected).toBe(true);
  });

  it('Bloqueia endpoints protegidos sem autenticação (401)', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };

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

  it('Bloqueia perfis sem autorização administrativa em sync e notify-email (403)', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MANUTENCAO_PRODUCAO');

    const syncRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta() }),
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

  it('GET /api/governance/state retorna null em modo local e carrega do SharePoint quando refresh=1', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    const localRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state', { headers }),
      env
    );
    expect(localRes.status).toBe(200);
    const localBody = (await localRes.json()) as {
      state: SiteGovernanceDelta | null;
      sharePoint: { lastSyncStatus: string };
    };
    expect(localBody.state).toBeNull();
    expect(localBody.sharePoint.lastSyncStatus).toBe('LOCAL_ONLY');

    const remoteRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/state?refresh=1', { headers }),
      env,
      {
        powerAutomate: createFakePowerAutomate({
          readStatus: 'SYNCED',
          remoteDelta: createBaseDelta({
            version: 4,
            users: [
              {
                id: 'u-sp',
                username: 'sp.user',
                name: 'SP User',
                email: 'sp@premierpet.com.br',
                password: 'MUST_BE_STRIPPED',
                totpSecret: 'MUST_BE_STRIPPED',
                role: 'ALMOXARIFADO',
                tenantId: 'dourado-sp',
                tenantName: 'Unidade Dourado / SP',
                status: 'ACTIVE',
                createdAt: '2026-11-13T10:00:00Z',
              },
            ],
          }),
        }),
      }
    );
    expect(remoteRes.status).toBe(200);
    const remoteBody = (await remoteRes.json()) as { state: SiteGovernanceDelta };
    expect(remoteBody.state.version).toBe(4);
    expect(remoteBody.state.users[0].password).toBeUndefined();
    expect(remoteBody.state.users[0].totpSecret).toBeUndefined();
  });

  it('PUT /api/governance/state sanitiza credenciais e incrementa versão em modo local', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    const payload = createBaseDelta({
      version: 2,
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
        body: JSON.stringify({ state: payload, baseVersion: 2, updatedBy: 'Master' }),
      }),
      env
    );

    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as {
      state: SiteGovernanceDelta;
      sharePoint: { lastSyncStatus: string };
    };
    expect(putBody.state.version).toBe(3);
    expect(putBody.state.users[0].password).toBeUndefined();
    expect(putBody.state.users[0].totpSecret).toBeUndefined();
    expect(putBody.sharePoint.lastSyncStatus).toBe('LOCAL_ONLY');
  });

  it('POST /api/governance/sync retorna LOCAL_ONLY, ERROR 502 e SYNCED via Power Automate', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('MASTER_ADMIN');

    const resLocal = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta({ version: 1 }) }),
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

    const resErr = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta({ version: 1 }) }),
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

    const resOk = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/governance/sync', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createBaseDelta({ version: 1 }) }),
      }),
      env,
      { powerAutomate: createFakePowerAutomate({ writeStatus: 'SYNCED' }) }
    );
    expect(resOk.status).toBe(200);
    const okBody = (await resOk.json()) as { synced: boolean };
    expect(okBody.synced).toBe(true);
  });

  it('POST /api/governance/notify-email valida entrada e envia quando autorizado', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
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

  it('Rotas /api/files/* retornam 503 STORAGE_DISABLED enquanto o R2 estiver desativado', async () => {
    const env: Env = { AUTH_SESSION_SECRET: TEST_SECRET };
    const headers = await makeAuthHeaders('ALMOXARIFADO');

    const uploadRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/files/upload', {
        method: 'POST',
        headers,
      }),
      env
    );
    expect(uploadRes.status).toBe(503);
    expect(((await uploadRes.json()) as { code: string }).code).toBe('STORAGE_DISABLED');

    const getRes = await handleWorkerRequest(
      new Request('https://pdm.premierpet.test/api/files/items/foto.png', { headers }),
      env
    );
    expect(getRes.status).toBe(503);
    expect(((await getRes.json()) as { code: string }).code).toBe('STORAGE_DISABLED');
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
