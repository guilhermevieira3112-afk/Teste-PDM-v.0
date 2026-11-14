import type {
  SharePointIntegrationStatus,
  SiteGovernanceDelta,
} from '../../src/types/governanceSync.ts';
import {
  ApiHttpError,
  Env,
  GovernanceHealthResponse,
} from '../types.ts';
import {
  mergeConcurrentDeltas,
  sanitizeDeltaForStorage,
  validateIncomingDelta,
} from '../storage/contracts.ts';
import {
  isStage1DevBypassActive,
  requireGovernanceAccess,
} from '../middleware/authHook.ts';
import { PowerAutomateClient } from '../integrations/powerAutomateClient.ts';
import { jsonResponse, parseJsonBody } from '../utils/http.ts';

export interface GovernanceRouteDeps {
  powerAutomate: PowerAutomateClient;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildSharePointStatus(
  flags: { writeConfigured: boolean; readConfigured: boolean; emailConfigured: boolean },
  status: SharePointIntegrationStatus['lastSyncStatus'],
  message: string,
  lastSyncAt: string | null = new Date().toISOString()
): SharePointIntegrationStatus {
  return {
    ...flags,
    lastSyncAt,
    lastSyncStatus: status,
    lastSyncMessage: message,
  };
}

export async function handleGovernanceRoute(
  request: Request,
  url: URL,
  env: Env,
  deps: GovernanceRouteDeps
): Promise<Response> {
  const { pathname } = url;
  const method = request.method.toUpperCase();
  const flags = deps.powerAutomate.getConfigFlags();

  // Rota 1 — Saúde da integração (GET /api/governance/health)
  if (pathname === '/api/governance/health') {
    if (method !== 'GET') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET para /api/governance/health.');
    }

    const sharePointConfigured = flags.writeConfigured && flags.readConfigured;

    const payload: GovernanceHealthResponse = {
      ok: true,
      runtime: 'cloudflare-workers',
      environment: env.APP_ENV || 'production',
      timestamp: new Date().toISOString(),
      auth: {
        protected: !isStage1DevBypassActive(env),
        stage: 'STAGE_1_GUARD_READY',
        devBypassActive: isStage1DevBypassActive(env),
      },
      storage: {
        mode: 'CLIENT_LOCAL_ONLY',
        d1Enabled: false,
        r2Enabled: false,
        message:
          'Persistência D1 e armazenamento R2 desativados temporariamente; operando em modo local no navegador.',
      },
      sharePoint: {
        ...buildSharePointStatus(
          flags,
          sharePointConfigured ? 'IDLE' : 'LOCAL_ONLY',
          sharePointConfigured
            ? 'Power Automate configurado para leitura e gravação no SharePoint.'
            : 'SharePoint/Power Automate não configurado; operando apenas em modo local.',
          null
        ),
        listName: 'PDM_Governanca_Delta',
        masterRecordId: 1,
      },
      powerAutomate: flags,
    };

    return jsonResponse(payload, 200);
  }

  // Rota 2 — Consultar estado da governança (GET /api/governance/state)
  if (pathname === '/api/governance/state') {
    if (method === 'GET') {
      await requireGovernanceAccess(request, env);
      const refreshFromSharePoint = url.searchParams.get('refresh') === '1';

      let currentState: SiteGovernanceDelta | null = null;
      let sharePointStatus = buildSharePointStatus(
        flags,
        flags.writeConfigured ? 'IDLE' : 'LOCAL_ONLY',
        'Operando sem banco D1 (desativado temporariamente); estado mantido localmente no navegador.',
        null
      );

      if (refreshFromSharePoint) {
        if (!flags.readConfigured) {
          sharePointStatus = buildSharePointStatus(
            flags,
            'LOCAL_ONLY',
            'POWER_AUTOMATE_READ_URL não configurada; utilizando estado local do navegador.'
          );
        } else {
          const readRes = await deps.powerAutomate.readLatestDelta();
          if (readRes.status === 'SYNCED' && readRes.remoteDelta) {
            currentState = sanitizeDeltaForStorage(readRes.remoteDelta);
            sharePointStatus = buildSharePointStatus(
              flags,
              'SYNCED',
              `Estado carregado do SharePoint (v${currentState.version}).`
            );
          } else {
            sharePointStatus = buildSharePointStatus(flags, readRes.status, readRes.message);
          }
        }
      }

      return jsonResponse({
        state: currentState,
        sharePoint: sharePointStatus,
      });
    }

    // Rota 3 — Atualizar estado da governança (PUT /api/governance/state)
    if (method === 'PUT') {
      const auth = await requireGovernanceAccess(request, env);
      const body = await parseJsonBody<{
        state?: unknown;
        baseVersion?: number;
        updatedBy?: string;
      }>(request);

      const validatedDelta = validateIncomingDelta(body.state);
      const updatedBy =
        (typeof body.updatedBy === 'string' && body.updatedBy.trim()) ||
        auth.name ||
        auth.username;

      const baseVersion =
        typeof body.baseVersion === 'number' && Number.isFinite(body.baseVersion)
          ? body.baseVersion
          : validatedDelta.version;

      const nextState: SiteGovernanceDelta = {
        ...validatedDelta,
        version: Math.max(1, Math.floor(baseVersion) + 1),
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      const writeRes = await deps.powerAutomate.writeDelta(nextState, updatedBy);

      return jsonResponse({
        state: nextState,
        mergedConcurrently: false,
        mergedFields: [],
        sharePoint: buildSharePointStatus(
          flags,
          writeRes.status,
          flags.writeConfigured
            ? writeRes.message
            : 'Alterações validadas e mantidas localmente no navegador (D1 desativado temporariamente).'
        ),
      });
    }

    throw new ApiHttpError(
      405,
      'METHOD_NOT_ALLOWED',
      'Use GET ou PUT para /api/governance/state.'
    );
  }

  // Rota 4 — Sincronização manual (POST /api/governance/sync)
  if (pathname === '/api/governance/sync') {
    if (method !== 'POST') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Use POST para /api/governance/sync.');
    }

    const auth = await requireGovernanceAccess(request, env, ['MASTER_ADMIN', 'ALMOXARIFADO', 'UNIT_MANAGER']);
    const body = await parseJsonBody<{
      state?: unknown;
      baseVersion?: number;
      updatedBy?: string;
    }>(request);

    const updatedBy =
      (typeof body.updatedBy === 'string' && body.updatedBy.trim()) ||
      auth.name ||
      auth.username;

    let stateToSync: SiteGovernanceDelta | null =
      body.state !== undefined ? validateIncomingDelta(body.state) : null;

    if (!stateToSync && !flags.readConfigured) {
      throw new ApiHttpError(
        400,
        'VALIDATION_ERROR',
        'Envie o campo "state" na requisição para sincronizar enquanto o D1 estiver desativado.'
      );
    }

    if (flags.readConfigured) {
      const readRes = await deps.powerAutomate.readLatestDelta();
      if (readRes.status === 'SYNCED' && readRes.remoteDelta) {
        const sanitizedRemote = sanitizeDeltaForStorage(readRes.remoteDelta);
        if (!stateToSync) {
          stateToSync = sanitizedRemote;
        } else if (Number(sanitizedRemote.version || 0) > Number(stateToSync.version || 0)) {
          const merged = mergeConcurrentDeltas(sanitizedRemote, stateToSync);
          stateToSync = {
            ...merged.merged,
            version: Math.max(sanitizedRemote.version, stateToSync.version) + 1,
            updatedBy,
          };
        }
      }
    }

    if (!stateToSync) {
      throw new ApiHttpError(
        400,
        'VALIDATION_ERROR',
        'Nenhum estado de governança disponível para sincronizar.'
      );
    }

    const now = new Date().toISOString();
    const preparedState: SiteGovernanceDelta = {
      ...stateToSync,
      version: Math.max(1, Number(stateToSync.version || 0)),
      updatedAt: now,
      updatedBy,
    };

    const writeRes = await deps.powerAutomate.writeDelta(preparedState, updatedBy);
    const sharePointStatus = buildSharePointStatus(
      flags,
      writeRes.status,
      flags.writeConfigured
        ? writeRes.message
        : 'Estado salvo localmente no navegador (D1 e SharePoint desativados).',
      now
    );

    const responseStatus = writeRes.status === 'ERROR' ? 502 : 200;
    return jsonResponse(
      {
        synced: writeRes.status === 'SYNCED',
        localPersisted: true,
        version: preparedState.version,
        syncedAt: now,
        state: preparedState,
        sharePoint: sharePointStatus,
      },
      responseStatus
    );
  }

  // Rota 5 — Notificação por e-mail (POST /api/governance/notify-email)
  if (pathname === '/api/governance/notify-email') {
    if (method !== 'POST') {
      throw new ApiHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        'Use POST para /api/governance/notify-email.'
      );
    }

    await requireGovernanceAccess(request, env, ['MASTER_ADMIN']);

    const body = await parseJsonBody<{
      to?: string;
      subject?: string;
      userName?: string;
      username?: string;
      roleLabel?: string;
      tenantName?: string;
      loginUrl?: string;
    }>(request);

    const to = body.to?.trim() || '';
    const subject = body.subject?.trim() || '';
    const userName = body.userName?.trim() || '';
    const username = body.username?.trim() || '';
    const roleLabel = body.roleLabel?.trim() || '';
    const tenantName = body.tenantName?.trim() || '';
    const loginUrl = body.loginUrl?.trim() || '';

    if (!to || !EMAIL_REGEX.test(to)) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'E-mail de destino ("to") inválido.');
    }
    if (!subject || subject.length < 3 || subject.length > 200) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Assunto ("subject") inválido.');
    }
    if (!userName || !username || !roleLabel || !tenantName) {
      throw new ApiHttpError(
        400,
        'VALIDATION_ERROR',
        'Campos obrigatórios ausentes: userName, username, roleLabel e tenantName.'
      );
    }
    if (!loginUrl || (!loginUrl.startsWith('https://') && !loginUrl.startsWith('http://'))) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Campo "loginUrl" deve ser uma URL válida.');
    }

    const emailResult = await deps.powerAutomate.sendApprovalEmail({
      to,
      subject,
      userName,
      username,
      roleLabel,
      tenantName,
      loginUrl,
    });

    if (!emailResult.sentViaPowerAutomate) {
      const httpStatus = flags.emailConfigured ? 502 : 503;
      return jsonResponse(
        {
          sentViaPowerAutomate: false,
          message: emailResult.message,
        },
        httpStatus
      );
    }

    return jsonResponse({
      sentViaPowerAutomate: true,
      message: emailResult.message,
    });
  }

  throw new ApiHttpError(404, 'NOT_FOUND', `Rota de governança desconhecida: ${pathname}`);
}
