import type {
  SharePointIntegrationStatus,
  SiteGovernanceDelta,
} from '../../src/types/governanceSync.ts';
import { Env } from '../types.ts';

export interface PowerAutomateClient {
  getConfigFlags(): {
    writeConfigured: boolean;
    readConfigured: boolean;
    emailConfigured: boolean;
  };
  readLatestDelta(): Promise<{
    status: SharePointIntegrationStatus['lastSyncStatus'];
    message: string;
    remoteDelta: SiteGovernanceDelta | null;
  }>;
  writeDelta(
    delta: SiteGovernanceDelta,
    updatedBy: string
  ): Promise<{
    status: 'SYNCED' | 'LOCAL_ONLY' | 'ERROR';
    message: string;
  }>;
  sendApprovalEmail(payload: {
    to: string;
    userName: string;
    username: string;
    roleLabel: string;
    tenantName: string;
    loginUrl: string;
    subject: string;
  }): Promise<{
    sentViaPowerAutomate: boolean;
    statusCode?: number;
    message: string;
  }>;
}

export function buildPowerAutomateWritePayload(delta: SiteGovernanceDelta, updatedBy: string) {
  const changeEvents: Array<{
    itemCode: string;
    itemDescription: string;
    actionLabel: string;
    requestedByUser: string;
    approvedByUser: string;
    status: string;
    timestamp: string;
    reason: string;
  }> = [];

  for (const ov of Object.values(delta.itemOverrides || {})) {
    for (const ch of ov.changeHistory || []) {
      changeEvents.push({
        itemCode: ov.totvsCode || ov.itemId,
        itemDescription: ov.shortDescription || '',
        actionLabel: ch.actionLabel || ch.actionType || 'EDITED',
        requestedByUser: ch.requestedByUser || '',
        approvedByUser: ch.approvedByUser || '',
        status: ch.status,
        timestamp: ch.timestamp,
        reason: ch.reason || ch.rejectionReason || '',
      });
    }
  }

  for (const item of delta.customPdmItems || []) {
    for (const ch of item.changeHistory || []) {
      changeEvents.push({
        itemCode: item.totvsCode || item.pdmCode,
        itemDescription: item.shortDescription || '',
        actionLabel: ch.actionLabel || ch.actionType || 'CREATED',
        requestedByUser: ch.requestedByUser || '',
        approvedByUser: ch.approvedByUser || '',
        status: ch.status,
        timestamp: ch.timestamp,
        reason: ch.reason || ch.rejectionReason || '',
      });
    }
  }

  changeEvents.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return {
    schemaVersion: '1.0',
    source: 'PremieRpet-PDM-Industrial',
    eventType: 'GOVERNANCE_STATE_SYNC',
    sharePointListName: 'PDM_Governanca_Delta',
    masterItemId: 1,
    version: delta.version,
    updatedAt: delta.updatedAt,
    updatedBy: updatedBy || delta.updatedBy || 'Sistema PDM',
    summary: {
      totalUsers: delta.users?.length || 0,
      pendingUsers: (delta.users || []).filter((u) => u.status === 'PENDING_APPROVAL').length,
      customPdmItems: delta.customPdmItems?.length || 0,
      modifiedBaseItems: Object.keys(delta.itemOverrides || {}).length,
      totalChangeLogs: changeEvents.length,
      pdmLevelsCount: delta.pdmLevels?.length || 0,
      siteMovementsCount: delta.movements?.length || 0,
    },
    deltaJson: JSON.stringify(delta),
    delta,
    latestChangeEvents: changeEvents.slice(0, 50),
  };
}

export function parsePowerAutomateReadResponse(payload: unknown): SiteGovernanceDelta | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  if (typeof obj.deltaJson === 'string' && obj.deltaJson.trim()) {
    try {
      return JSON.parse(obj.deltaJson) as SiteGovernanceDelta;
    } catch {
      return null;
    }
  }
  if (typeof obj.DeltaJSON === 'string' && obj.DeltaJSON.trim()) {
    try {
      return JSON.parse(obj.DeltaJSON) as SiteGovernanceDelta;
    } catch {
      return null;
    }
  }
  if (obj.delta && typeof obj.delta === 'object') {
    return obj.delta as SiteGovernanceDelta;
  }
  if (obj.body && typeof obj.body === 'object') {
    return parsePowerAutomateReadResponse(obj.body);
  }
  if (Array.isArray(obj.users) || typeof obj.version === 'number') {
    return obj as unknown as SiteGovernanceDelta;
  }
  return null;
}

export function createPowerAutomateClient(
  env: Env,
  fetchFn: typeof fetch = fetch
): PowerAutomateClient {
  const timeoutMs = Math.max(2000, Number(env.POWER_AUTOMATE_TIMEOUT_MS || 10000));

  return {
    getConfigFlags() {
      return {
        writeConfigured: Boolean(env.POWER_AUTOMATE_WRITE_URL?.trim()),
        readConfigured: Boolean(env.POWER_AUTOMATE_READ_URL?.trim()),
        emailConfigured: Boolean(env.POWER_AUTOMATE_EMAIL_URL?.trim()),
      };
    },

    async readLatestDelta() {
      const readUrl = env.POWER_AUTOMATE_READ_URL?.trim();
      if (!readUrl) {
        return {
          status: 'LOCAL_ONLY',
          message: 'POWER_AUTOMATE_READ_URL não configurada; utilizando apenas D1.',
          remoteDelta: null,
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchFn(readUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            source: 'PremieRpet-PDM-Industrial',
            action: 'READ_LATEST_DELTA',
            sharePointListName: 'PDM_Governanca_Delta',
            masterItemId: 1,
            requestedAt: new Date().toISOString(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return {
            status: 'ERROR',
            message: `Power Automate READ retornou HTTP ${response.status}.`,
            remoteDelta: null,
          };
        }

        const json = (await response.json()) as unknown;
        const remoteDelta = parsePowerAutomateReadResponse(json);
        if (!remoteDelta) {
          return {
            status: 'IDLE',
            message: 'SharePoint conectado, sem pacote delta anterior registrado.',
            remoteDelta: null,
          };
        }

        return {
          status: 'SYNCED',
          message: `Leitura concluída do SharePoint (versão v${remoteDelta.version ?? 0}).`,
          remoteDelta,
        };
      } catch (err) {
        return {
          status: 'ERROR',
          message:
            err instanceof Error
              ? err.message
              : 'Falha ao consultar Power Automate READ.',
          remoteDelta: null,
        };
      } finally {
        clearTimeout(timer);
      }
    },

    async writeDelta(delta, updatedBy) {
      const writeUrl = env.POWER_AUTOMATE_WRITE_URL?.trim();
      if (!writeUrl) {
        return {
          status: 'LOCAL_ONLY',
          message:
            'Persistido no D1. Configure POWER_AUTOMATE_WRITE_URL para replicar no SharePoint.',
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const payload = buildPowerAutomateWritePayload(delta, updatedBy);
        const response = await fetchFn(writeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          return {
            status: 'ERROR',
            message: `Power Automate WRITE retornou HTTP ${response.status}.`,
          };
        }

        return {
          status: 'SYNCED',
          message: `Sincronizado com SharePoint via Power Automate (versão v${delta.version}).`,
        };
      } catch (err) {
        return {
          status: 'ERROR',
          message:
            err instanceof Error
              ? err.message
              : 'Falha ao enviar pacote delta ao Power Automate WRITE.',
        };
      } finally {
        clearTimeout(timer);
      }
    },

    async sendApprovalEmail(payload) {
      const emailUrl = env.POWER_AUTOMATE_EMAIL_URL?.trim();
      if (!emailUrl) {
        return {
          sentViaPowerAutomate: false,
          message: 'POWER_AUTOMATE_EMAIL_URL não configurada nos Secrets do Worker.',
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchFn(emailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'PremieRpet-PDM-Industrial',
            sentAt: new Date().toISOString(),
            ...payload,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return {
            sentViaPowerAutomate: false,
            statusCode: response.status,
            message: `Power Automate E-mail retornou HTTP ${response.status}.`,
          };
        }

        return {
          sentViaPowerAutomate: true,
          statusCode: response.status,
          message: 'E-mail corporativo disparado via Power Automate / Outlook.',
        };
      } catch (err) {
        return {
          sentViaPowerAutomate: false,
          message:
            err instanceof Error
              ? err.message
              : 'Falha ao acionar fluxo de e-mail no Power Automate.',
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
