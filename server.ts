import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  SharePointIntegrationStatus,
  SiteGovernanceDelta,
} from './src/types/governanceSync.ts';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DELTA_FILE = path.join(DATA_DIR, 'governance-delta.json');

let cachedDelta: SiteGovernanceDelta | null = null;

const integrationStatus: SharePointIntegrationStatus = {
  writeConfigured: Boolean(process.env.POWER_AUTOMATE_WRITE_URL?.trim()),
  readConfigured: Boolean(process.env.POWER_AUTOMATE_READ_URL?.trim()),
  emailConfigured: Boolean(process.env.POWER_AUTOMATE_EMAIL_URL?.trim()),
  lastSyncAt: null,
  lastSyncStatus: process.env.POWER_AUTOMATE_WRITE_URL?.trim() ? 'IDLE' : 'LOCAL_ONLY',
  lastSyncMessage: process.env.POWER_AUTOMATE_WRITE_URL?.trim()
    ? 'Aguardando primeira sincronização com Power Automate.'
    : 'Persistência compartilhada ativa no servidor (Power Automate ainda não configurado).',
};

function refreshEnvFlags() {
  integrationStatus.writeConfigured = Boolean(process.env.POWER_AUTOMATE_WRITE_URL?.trim());
  integrationStatus.readConfigured = Boolean(process.env.POWER_AUTOMATE_READ_URL?.trim());
  integrationStatus.emailConfigured = Boolean(process.env.POWER_AUTOMATE_EMAIL_URL?.trim());
}

async function readLocalSnapshot(): Promise<SiteGovernanceDelta | null> {
  if (cachedDelta) return cachedDelta;
  try {
    const raw = await fs.readFile(DELTA_FILE, 'utf-8');
    cachedDelta = JSON.parse(raw) as SiteGovernanceDelta;
    return cachedDelta;
  } catch {
    return null;
  }
}

async function writeLocalSnapshot(delta: SiteGovernanceDelta): Promise<void> {
  cachedDelta = delta;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DELTA_FILE, JSON.stringify(delta, null, 2), 'utf-8');
}

function buildPowerAutomateWritePayload(delta: SiteGovernanceDelta, updatedBy?: string) {
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

function parsePowerAutomateReadResponse(payload: unknown): SiteGovernanceDelta | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  if (typeof obj.deltaJson === 'string' && obj.deltaJson.trim()) {
    try {
      return JSON.parse(obj.deltaJson) as SiteGovernanceDelta;
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

async function pullFromPowerAutomate(): Promise<SiteGovernanceDelta | null> {
  refreshEnvFlags();
  const readUrl = process.env.POWER_AUTOMATE_READ_URL?.trim();
  if (!readUrl) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(readUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        source: 'PremieRpet-PDM-Industrial',
        action: 'READ_LATEST_DELTA',
        requestedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Power Automate READ retornou HTTP ${response.status}`);
    }

    const json = (await response.json()) as unknown;
    const remoteDelta = parsePowerAutomateReadResponse(json);
    if (remoteDelta) {
      const local = await readLocalSnapshot();
      const shouldAdoptRemote =
        !local ||
        (remoteDelta.version || 0) > (local.version || 0) ||
        ((remoteDelta.version || 0) === (local.version || 0) &&
          (remoteDelta.updatedAt || '') > (local.updatedAt || ''));

      if (shouldAdoptRemote) {
        await writeLocalSnapshot(remoteDelta);
      }
      integrationStatus.lastSyncAt = new Date().toISOString();
      integrationStatus.lastSyncStatus = 'SYNCED';
      integrationStatus.lastSyncMessage = 'Leitura concluída do SharePoint via Power Automate.';
      return remoteDelta;
    }

    integrationStatus.lastSyncAt = new Date().toISOString();
    integrationStatus.lastSyncStatus = 'IDLE';
    integrationStatus.lastSyncMessage = 'SharePoint conectado, sem pacote delta anterior registrado.';
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao consultar Power Automate';
    integrationStatus.lastSyncAt = new Date().toISOString();
    integrationStatus.lastSyncStatus = 'ERROR';
    integrationStatus.lastSyncMessage = msg;
    return null;
  }
}

async function pushToPowerAutomate(delta: SiteGovernanceDelta, updatedBy?: string): Promise<boolean> {
  refreshEnvFlags();
  const writeUrl = process.env.POWER_AUTOMATE_WRITE_URL?.trim();
  if (!writeUrl) {
    integrationStatus.lastSyncAt = new Date().toISOString();
    integrationStatus.lastSyncStatus = 'LOCAL_ONLY';
    integrationStatus.lastSyncMessage =
      'Salvo no servidor local. Configure POWER_AUTOMATE_WRITE_URL para gravar no SharePoint.';
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const payload = buildPowerAutomateWritePayload(delta, updatedBy);
    const response = await fetch(writeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Power Automate WRITE retornou HTTP ${response.status}`);
    }

    integrationStatus.lastSyncAt = new Date().toISOString();
    integrationStatus.lastSyncStatus = 'SYNCED';
    integrationStatus.lastSyncMessage = `Sincronizado com SharePoint (versão v${delta.version}).`;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha no envio ao Power Automate';
    integrationStatus.lastSyncAt = new Date().toISOString();
    integrationStatus.lastSyncStatus = 'ERROR';
    integrationStatus.lastSyncMessage = msg;
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/governance/health', (_req: Request, res: Response) => {
    refreshEnvFlags();
    res.json({ ok: true, sharePoint: integrationStatus });
  });

  app.get('/api/governance/state', async (req: Request, res: Response) => {
    refreshEnvFlags();
    const forceRefresh = req.query.refresh === '1';
    if (forceRefresh && integrationStatus.readConfigured) {
      await pullFromPowerAutomate();
    } else if (!cachedDelta && integrationStatus.readConfigured) {
      await pullFromPowerAutomate();
    }

    const state = await readLocalSnapshot();
    res.json({
      state,
      sharePoint: integrationStatus,
    });
  });

  app.put('/api/governance/state', async (req: Request, res: Response) => {
    refreshEnvFlags();
    const body = req.body as { state?: SiteGovernanceDelta; updatedBy?: string };
    if (!body?.state) {
      res.status(400).json({ error: 'Campo "state" obrigatório.' });
      return;
    }

    const current = await readLocalSnapshot();
    const nextVersion = Math.max(current?.version || 0, body.state.version || 0) + 1;
    const nextState: SiteGovernanceDelta = {
      ...body.state,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || body.state.updatedBy,
    };

    await writeLocalSnapshot(nextState);
    await pushToPowerAutomate(nextState, body.updatedBy);

    res.json({
      state: nextState,
      sharePoint: integrationStatus,
    });
  });

  app.post('/api/governance/sync', async (req: Request, res: Response) => {
    refreshEnvFlags();
    const body = req.body as { state?: SiteGovernanceDelta; updatedBy?: string };

    if (integrationStatus.readConfigured) {
      await pullFromPowerAutomate();
    }

    let state = await readLocalSnapshot();
    if (!state && body?.state) {
      state = {
        ...body.state,
        version: Math.max(1, body.state.version || 1),
        updatedAt: new Date().toISOString(),
        updatedBy: body.updatedBy || body.state.updatedBy,
      };
      await writeLocalSnapshot(state);
    }

    if (state) {
      await pushToPowerAutomate(state, body?.updatedBy);
    }

    res.json({
      state,
      sharePoint: integrationStatus,
    });
  });

  app.post('/api/governance/notify-email', async (req: Request, res: Response) => {
    refreshEnvFlags();
    const emailUrl = process.env.POWER_AUTOMATE_EMAIL_URL?.trim();
    if (!emailUrl) {
      res.json({
        sentViaPowerAutomate: false,
        message: 'POWER_AUTOMATE_EMAIL_URL não configurada; liberação salva na fila.',
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(emailUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'PremieRpet-PDM-Industrial',
          sentAt: new Date().toISOString(),
          ...req.body,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        res.json({
          sentViaPowerAutomate: false,
          message: `Power Automate E-mail retornou HTTP ${response.status}.`,
        });
        return;
      }

      res.json({
        sentViaPowerAutomate: true,
        message: 'E-mail corporativo disparado via Power Automate / Outlook.',
      });
    } catch (err) {
      res.json({
        sentViaPowerAutomate: false,
        message: err instanceof Error ? err.message : 'Erro ao acionar Power Automate E-mail.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDM Industrial server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
