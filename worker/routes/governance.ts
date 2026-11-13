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
  GovernanceStore,
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
  store: GovernanceStore;
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

    const d1Health = await deps.store.getHealthInfo();
    const sharePointConfigured = flags.writeConfigured && flags.readConfigured;

    const payload: GovernanceHealthResponse = {
      ok: d1Health.bound && d1Health.connected,
      runtime: 'cloudflare-workers',
      environment: env.APP_ENV || 'production',
      timestamp: new Date().toISOString(),
      version: d1Health.currentVersion,
      auth: {
        protected: !isStage1DevBypassActive(env),
        stage: 'STAGE_1_GUARD_READY',
        devBypassActive: isStage1DevBypassActive(env),
      },
      d1: d1Health,
      r2: {
        bound: Boolean(env.MEDIA_BUCKET),
        bucketName: 'pdm-governance-media',
      },
      sharePoint: {
        ...buildSharePointStatus(
          flags,
          sharePointConfigured ? 'IDLE' : 'LOCAL_ONLY',
          sharePointConfigured
            ? 'Power Automate configurado para leitura e gravação no SharePoint.'
            : 'SharePoint/Power Automate ainda não configurado nos Secrets do Worker.',
          d1Health.lastUpdatedAt
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
      const auth = await requireGovernanceAccess(request, env);
      const refreshFromSharePoint = url.searchParams.get('refresh') === '1';

      let currentState = await deps.store.getState();
      let sharePointStatus = buildSharePointStatus(
        flags,
        flags.writeConfigured ? 'IDLE' : 'LOCAL_ONLY',
        currentState
          ? `Estado v${currentState.version} carregado do Cloudflare D1.`
          : 'D1 conectado, sem estado de governança gravado ainda.',
        currentState?.updatedAt ?? null
      );

      if (refreshFromSharePoint) {
        if (!flags.readConfigured) {
          sharePointStatus = buildSharePointStatus(
            flags,
            'LOCAL_ONLY',
            'POWER_AUTOMATE_READ_URL não configurada; retornando versão do D1.'
          );
        } else {
          const readRes = await deps.powerAutomate.readLatestDelta();
          if (readRes.status === 'SYNCED' && readRes.remoteDelta) {
            const remoteVersion = Number(readRes.remoteDelta.version || 0);
            const localVersion = Number(currentState?.version || 0);

            // Nunca sobrescrever versão mais recente já presente no D1
            if (remoteVersion > localVersion) {
              const saved = await deps.store.saveStateWithConcurrency({
                incomingState: sanitizeDeltaForStorage(readRes.remoteDelta),
                baseVersion: localVersion,
                updatedBy: readRes.remoteDelta.updatedBy || auth.name,
                operation: 'SHAREPOINT_REFRESH',
              });
              currentState = saved.state;
              sharePointStatus = buildSharePointStatus(
                flags,
                'SYNCED',
                `Estado atualizado a partir do SharePoint (v${saved.state.version}).`
              );
            } else {
              sharePointStatus = buildSharePointStatus(
                flags,
                'SYNCED',
                `D1 já possui a versão mais recente (v${localVersion}; SharePoint v${remoteVersion}).`
              );
            }
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

      const saveResult = await deps.store.saveStateWithConcurrency({
        incomingState: validatedDelta,
        baseVersion,
        updatedBy,
        operation: 'PUT_STATE',
      });

      const writeRes = await deps.powerAutomate.writeDelta(saveResult.state, updatedBy);

      await Promise.all([
        deps.store.updateHistorySyncStatus(saveResult.state.version, writeRes.status),
        deps.store.recordSyncLog({
          version: saveResult.state.version,
          destination: 'SHAREPOINT_POWER_AUTOMATE',
          status: writeRes.status,
          message: writeRes.message,
          createdAt: new Date().toISOString(),
        }),
      ]);

      return jsonResponse({
        state: saveResult.state,
        mergedConcurrently: saveResult.mergedConcurrently,
        mergedFields: saveResult.mergedFields,
        sharePoint: buildSharePointStatus(flags, writeRes.status, writeRes.message),
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

    let d1State = await deps.store.getState();
    let hasChangesApplied = false;

    if (body.state !== undefined) {
      const validatedIncoming = validateIncomingDelta(body.state);
      const localVersion = Number(d1State?.version || 0);
      const incomingBaseVersion =
        typeof body.baseVersion === 'number' ? body.baseVersion : validatedIncoming.version;

      const serializedCurrent = d1State ? JSON.stringify({ ...d1State, updatedAt: '' }) : '';
      const serializedIncoming = JSON.stringify({
        ...validatedIncoming,
        version: d1State?.version || validatedIncoming.version,
        updatedAt: '',
      });

      if (!d1State || serializedCurrent !== serializedIncoming || incomingBaseVersion !== localVersion) {
        const saved = await deps.store.saveStateWithConcurrency({
          incomingState: validatedIncoming,
          baseVersion: incomingBaseVersion,
          updatedBy,
          operation: 'MANUAL_SYNC',
        });
        d1State = saved.state;
        hasChangesApplied = true;
      }
    }

    if (!d1State) {
      throw new ApiHttpError(
        400,
        'VALIDATION_ERROR',
        'Nenhum estado de governança encontrado no D1 ou enviado na requisição para sincronizar.'
      );
    }

    let stateToSync: SiteGovernanceDelta = d1State;

    // Consultar SharePoint se leitura estiver configurada (sem regredir D1)
    if (flags.readConfigured) {
      const readRes = await deps.powerAutomate.readLatestDelta();
      if (readRes.status === 'SYNCED' && readRes.remoteDelta) {
        const remoteVersion = Number(readRes.remoteDelta.version || 0);
        if (remoteVersion > stateToSync.version) {
          const merged = await deps.store.saveStateWithConcurrency({
            incomingState: sanitizeDeltaForStorage(readRes.remoteDelta),
            baseVersion: stateToSync.version,
            updatedBy: readRes.remoteDelta.updatedBy || updatedBy,
            operation: 'SHAREPOINT_REFRESH',
          });
          stateToSync = merged.state;
          hasChangesApplied = true;
        }
      }
    }

    const writeRes = await deps.powerAutomate.writeDelta(stateToSync, updatedBy);
    const now = new Date().toISOString();

    await Promise.all([
      deps.store.updateHistorySyncStatus(stateToSync.version, writeRes.status),
      deps.store.recordSyncLog({
        version: stateToSync.version,
        destination: 'SHAREPOINT_POWER_AUTOMATE',
        status: writeRes.status,
        message: writeRes.message,
        createdAt: now,
      }),
    ]);

    const sharePointStatus = buildSharePointStatus(flags, writeRes.status, writeRes.message, now);

    // Nunca reportar sincronização concluída se houve apenas gravação local ou falha externa
    const responseStatus = writeRes.status === 'ERROR' ? 502 : 200;
    return jsonResponse(
      {
        synced: writeRes.status === 'SYNCED',
        localPersisted: true,
        changesAppliedToD1: hasChangesApplied,
        version: stateToSync.version,
        syncedAt: now,
        state: stateToSync,
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
