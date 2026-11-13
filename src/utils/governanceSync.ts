import { PDMItem, StockMovement } from '../types/pdm';
import { UserAccount } from '../types/auth';
import { PdmNivelItem } from '../data/pdmNiveisData';
import {
  GovernanceStateResponse,
  ItemGovernanceOverride,
  SiteGovernanceDelta,
} from '../types/governanceSync';

const LOCAL_DELTA_STORAGE_KEY = 'premierpet_governance_delta_v1';

function hasGovernanceChanges(baseItem: PDMItem, currentItem: PDMItem): boolean {
  if ((currentItem.changeHistory?.length || 0) > (baseItem.changeHistory?.length || 0)) {
    return true;
  }
  if (currentItem.pendingChange || currentItem.inactivationRequest) {
    return true;
  }
  if ((currentItem.integrationRequests?.length || 0) > 0) {
    return true;
  }
  if (
    currentItem.status !== baseItem.status ||
    currentItem.pdmCode !== baseItem.pdmCode ||
    currentItem.totvsCode !== baseItem.totvsCode ||
    currentItem.rejectionReason !== baseItem.rejectionReason ||
    currentItem.shortDescription !== baseItem.shortDescription ||
    currentItem.longDescription !== baseItem.longDescription ||
    currentItem.narrative !== baseItem.narrative ||
    currentItem.ncm !== baseItem.ncm ||
    currentItem.unspsc !== baseItem.unspsc ||
    currentItem.genericImage !== baseItem.genericImage ||
    currentItem.situation !== baseItem.situation ||
    currentItem.nivel1 !== baseItem.nivel1 ||
    currentItem.nivel2 !== baseItem.nivel2 ||
    currentItem.nivel3 !== baseItem.nivel3 ||
    currentItem.isClassified !== baseItem.isClassified ||
    currentItem.classificationOrigin !== baseItem.classificationOrigin
  ) {
    return true;
  }
  if (
    JSON.stringify(currentItem.approvalWorkflow || null) !==
    JSON.stringify(baseItem.approvalWorkflow || null)
  ) {
    return true;
  }
  if (
    JSON.stringify(currentItem.quotation || null) !==
    JSON.stringify(baseItem.quotation || null)
  ) {
    return true;
  }
  const baseEstabJson = JSON.stringify(baseItem.establishments || {});
  const currEstabJson = JSON.stringify(currentItem.establishments || {});
  return baseEstabJson !== currEstabJson;
}

export function extractSiteGovernanceDelta(params: {
  users: UserAccount[];
  global2FARequired: boolean;
  pdmLevels: PdmNivelItem[];
  pdmItems: PDMItem[];
  movements: StockMovement[];
  baseCatalogMap: Map<string, PDMItem>;
  baseMovementIds: Set<string>;
  version?: number;
  updatedBy?: string;
}): SiteGovernanceDelta {
  const {
    users,
    global2FARequired,
    pdmLevels,
    pdmItems,
    movements,
    baseCatalogMap,
    baseMovementIds,
    version = 1,
    updatedBy,
  } = params;

  const customPdmItems: PDMItem[] = [];
  const itemOverrides: Record<string, ItemGovernanceOverride> = {};
  const now = new Date().toISOString();

  for (const item of pdmItems) {
    if (!baseCatalogMap.has(item.id)) {
      customPdmItems.push(item);
      continue;
    }

    const baseItem = baseCatalogMap.get(item.id);
    if (baseItem && hasGovernanceChanges(baseItem, item)) {
      itemOverrides[item.id] = {
        itemId: item.id,
        totvsCode: item.totvsCode || item.pdmCode,
        pdmCode: item.pdmCode,
        status: item.status,
        rejectionReason: item.rejectionReason,
        approvalWorkflow: item.approvalWorkflow,
        quotation: item.quotation,
        shortDescription: item.shortDescription,
        longDescription: item.longDescription,
        narrative: item.narrative,
        ncm: item.ncm,
        unspsc: item.unspsc,
        genericImage: item.genericImage,
        situation: item.situation,
        nivel1: item.nivel1,
        nivel2: item.nivel2,
        nivel3: item.nivel3,
        isClassified: item.isClassified,
        classificationOrigin: item.classificationOrigin,
        establishments: item.establishments,
        pendingChange: item.pendingChange,
        integrationRequests: item.integrationRequests,
        inactivationRequest: item.inactivationRequest,
        changeHistory: item.changeHistory,
        updatedAt: now,
      };
    }
  }

  const siteMovements = movements.filter((m) => !baseMovementIds.has(m.id));

  return {
    version,
    updatedAt: now,
    updatedBy,
    users,
    global2FARequired,
    pdmLevels,
    customPdmItems,
    itemOverrides,
    movements: siteMovements,
  };
}

export function applyGovernanceDeltaToCatalog(
  baseCatalog: PDMItem[],
  delta: Partial<SiteGovernanceDelta> | null | undefined
): PDMItem[] {
  if (!delta) return baseCatalog;

  const overrides = delta.itemOverrides || {};
  const customItems = delta.customPdmItems || [];
  const customById = new Map<string, PDMItem>(customItems.map((i) => [i.id, i]));

  const mergedBase = baseCatalog.map((item) => {
    if (customById.has(item.id)) {
      return customById.get(item.id)!;
    }
    const ov = overrides[item.id];
    if (!ov) return item;
    return {
      ...item,
      totvsCode: ov.totvsCode ?? item.totvsCode,
      pdmCode: ov.pdmCode ?? item.pdmCode,
      status: ov.status ?? item.status,
      rejectionReason: ov.rejectionReason ?? item.rejectionReason,
      approvalWorkflow: ov.approvalWorkflow ?? item.approvalWorkflow,
      quotation: ov.quotation ?? item.quotation,
      shortDescription: ov.shortDescription ?? item.shortDescription,
      longDescription: ov.longDescription ?? item.longDescription,
      narrative: ov.narrative ?? item.narrative,
      ncm: ov.ncm ?? item.ncm,
      unspsc: ov.unspsc ?? item.unspsc,
      genericImage: ov.genericImage ?? item.genericImage,
      situation: ov.situation ?? item.situation,
      nivel1: ov.nivel1 ?? item.nivel1,
      nivel2: ov.nivel2 ?? item.nivel2,
      nivel3: ov.nivel3 ?? item.nivel3,
      isClassified: ov.isClassified ?? item.isClassified,
      classificationOrigin: ov.classificationOrigin ?? item.classificationOrigin,
      establishments: ov.establishments ?? item.establishments,
      pendingChange: ov.pendingChange,
      integrationRequests: ov.integrationRequests ?? item.integrationRequests,
      inactivationRequest: ov.inactivationRequest ?? item.inactivationRequest,
      changeHistory: ov.changeHistory ?? item.changeHistory,
    };
  });

  const existingIds = new Set(mergedBase.map((i) => i.id));
  const extraCustomItems = customItems.filter((i) => !existingIds.has(i.id));

  return [...extraCustomItems, ...mergedBase];
}

export function loadLocalGovernanceDelta(): SiteGovernanceDelta | null {
  try {
    const raw = localStorage.getItem(LOCAL_DELTA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SiteGovernanceDelta;
  } catch {
    return null;
  }
}

export function saveLocalGovernanceDelta(delta: SiteGovernanceDelta): void {
  try {
    localStorage.setItem(LOCAL_DELTA_STORAGE_KEY, JSON.stringify(delta));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchRemoteGovernanceState(
  refreshFromSharePoint = false
): Promise<GovernanceStateResponse | null> {
  try {
    const url = refreshFromSharePoint
      ? '/api/governance/state?refresh=1'
      : '/api/governance/state';
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as GovernanceStateResponse;
  } catch {
    return null;
  }
}

export async function pushRemoteGovernanceState(
  state: SiteGovernanceDelta,
  updatedBy?: string
): Promise<GovernanceStateResponse | null> {
  try {
    const res = await fetch('/api/governance/state', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        state,
        baseVersion: state.version,
        updatedBy,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | (GovernanceStateResponse & {
          details?: { serverState?: SiteGovernanceDelta };
        })
      | null;

    if (res.status === 409 && data) {
      return {
        state: data.details?.serverState || null,
        sharePoint: data.sharePoint || {
          writeConfigured: false,
          readConfigured: false,
          emailConfigured: false,
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'ERROR',
          lastSyncMessage: data.error || 'Conflito de versão detectado.',
        },
        conflict: true,
        error: data.error,
        code: data.code || 'VERSION_CONFLICT',
      };
    }

    if (!res.ok) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function triggerManualSharePointSync(
  state?: SiteGovernanceDelta,
  updatedBy?: string
): Promise<GovernanceStateResponse | null> {
  try {
    const res = await fetch('/api/governance/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        state,
        baseVersion: state?.version,
        updatedBy,
      }),
    });
    const data = (await res.json().catch(() => null)) as GovernanceStateResponse | null;
    if (!res.ok) {
      return data;
    }
    return data;
  } catch {
    return null;
  }
}

export async function sendPowerAutomateApprovalEmail(payload: {
  to: string;
  userName: string;
  username: string;
  roleLabel: string;
  tenantName: string;
  loginUrl: string;
  subject: string;
}): Promise<{ sentViaPowerAutomate: boolean; message?: string }> {
  try {
    const res = await fetch('/api/governance/notify-email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as
      | { sentViaPowerAutomate?: boolean; message?: string; error?: string }
      | null;
    if (!res.ok) {
      return {
        sentViaPowerAutomate: false,
        message: data?.message || data?.error || `HTTP ${res.status}`,
      };
    }
    return {
      sentViaPowerAutomate: Boolean(data?.sentViaPowerAutomate),
      message: data?.message,
    };
  } catch {
    return { sentViaPowerAutomate: false };
  }
}

export async function uploadGovernanceFile(params: {
  file: File;
  category: 'items' | 'quotations';
  itemId: string;
}): Promise<{ key: string; url: string; fileName: string; contentType: string; size: number } | null> {
  try {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('category', params.category);
    formData.append('itemId', params.itemId);

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      file?: { key: string; url: string; fileName: string; contentType: string; size: number };
    };
    return data.file || null;
  } catch {
    return null;
  }
}
