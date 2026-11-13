import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Database, 
  Layers, 
  CheckSquare, 
  Package, 
  BarChart3, 
  Building2, 
  ShieldCheck, 
  Plus, 
  Sparkles,
  Server
} from 'lucide-react';
import { 
  UserRole, 
  Tenant, 
  PDMItem, 
  TenantStockItem, 
  StockMovement,
  ItemFieldChange,
  ApprovalTierLevel,
  ItemIntegrationRequest,
  ItemInactivationRequest,
  EstabelecimentoStockData
} from './types/pdm';
import { TENANTS } from './data/taxonomy';
import { INITIAL_PDM_ITEMS, INITIAL_TENANT_STOCKS, INITIAL_MOVEMENTS } from './data/mockData';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CatalogView } from './components/pdm/CatalogView';
import { GovernanceView } from './components/governance/GovernanceView';
import { InventoryView } from './components/inventory/InventoryView';
import { ABCCurveDashboard } from './components/analytics/ABCCurveDashboard';
import { PDMBuilderModal } from './components/pdm/PDMBuilderModal';
import { AddToStockModal } from './components/inventory/AddToStockModal';
import { ItemDetailModal } from './components/common/ItemDetailModal';
import { ItemEditModal } from './components/common/ItemEditModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { TotvsImportView } from './components/totvs/TotvsImportView';
import { UserControlView } from './components/users/UserControlView';
import { PdmFieldsEditorView } from './components/pdm/PdmFieldsEditorView';
import { PdmClassificationQueryView } from './components/pdm/PdmClassificationQueryView';
import { UserAccount } from './types/auth';
import { INITIAL_USERS } from './data/users';
import { PdmNivelItem, INITIAL_PDM_NIVEIS } from './data/pdmNiveisData';
import { SharePointIntegrationStatus, SiteGovernanceDelta } from './types/governanceSync';
import {
  applyGovernanceDeltaToCatalog,
  extractSiteGovernanceDelta,
  fetchRemoteGovernanceState,
  loadLocalGovernanceDelta,
  pushRemoteGovernanceState,
  saveLocalGovernanceDelta,
  triggerManualSharePointSync,
} from './utils/governanceSync';

function mergeUsersWithInitial(incoming: UserAccount[]): UserAccount[] {
  const existingUsernames = new Set(incoming.map((u) => u.username.toLowerCase()));
  const missingInitial = INITIAL_USERS.filter(
    (u) => !existingUsernames.has(u.username.toLowerCase())
  );
  return missingInitial.length > 0 ? [...missingInitial, ...incoming] : incoming;
}

function getDeltaSignature(delta: SiteGovernanceDelta): string {
  return JSON.stringify({
    users: delta.users,
    global2FARequired: delta.global2FARequired,
    pdmLevels: delta.pdmLevels,
    customPdmItems: delta.customPdmItems,
    itemOverrides: delta.itemOverrides,
    movements: delta.movements,
  });
}

export default function App() {
  // Authentication State
  const [currentUserAccount, setCurrentUserAccount] = useState<UserAccount | null>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Navigation & User Context
  const [currentTab, setCurrentTab] = useState<'catalog' | 'pdm-classification' | 'governance' | 'inventory' | 'abc' | 'totvs-import' | 'user-control' | 'pdm-fields'>('inventory');

  // MRO PDM Levels State (Persisted in localStorage)
  const [pdmLevels, setPdmLevels] = useState<PdmNivelItem[]>(() => {
    try {
      const stored = localStorage.getItem('premierpet_pdm_levels');
      return stored ? JSON.parse(stored) : INITIAL_PDM_NIVEIS;
    } catch {
      return INITIAL_PDM_NIVEIS;
    }
  });

  const handleUpdatePdmLevels = (newNiveis: PdmNivelItem[]) => {
    setPdmLevels(newNiveis);
    try {
      localStorage.setItem('premierpet_pdm_levels', JSON.stringify(newNiveis));
    } catch {
      // ignore
    }
  };

  // Users Control State (Master Admin)
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const stored = localStorage.getItem('premierpet_users');
      if (stored) {
        const parsed: UserAccount[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingUsernames = new Set(parsed.map((u) => u.username.toLowerCase()));
          const missingInitialUsers = INITIAL_USERS.filter(
            (u) => !existingUsernames.has(u.username.toLowerCase())
          );
          if (missingInitialUsers.length > 0) {
            const merged = [...missingInitialUsers, ...parsed];
            localStorage.setItem('premierpet_users', JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const handleUpdateUsers = (updatedUsers: UserAccount[]) => {
    setUsers(updatedUsers);
    try {
      localStorage.setItem('premierpet_users', JSON.stringify(updatedUsers));
    } catch {
      // ignore
    }
  };

  // Global Microsoft Authenticator (2FA) Requirement State (controlled by pdmindustrial.premierpet)
  const [global2FARequired, setGlobal2FARequired] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('premierpet_global_2fa_required');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  // Direct Approval Link Query Params (?tab=user-control&approveUser=...)
  const [pendingApproveUsername, setPendingApproveUsername] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('approveUser');
    } catch {
      return null;
    }
  });

  const [pendingUserControlRedirect, setPendingUserControlRedirect] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') === 'user-control' || !!params.get('approveUser');
    } catch {
      return false;
    }
  });
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      if (stored) {
        const parsed: UserAccount = JSON.parse(stored);
        return parsed.role;
      }
    } catch {
      // fallback
    }
    return 'UNIT_MANAGER';
  });
  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      if (stored) {
        const parsed: UserAccount = JSON.parse(stored);
        return parsed.tenantId || 'dourado-sp';
      }
    } catch {
      // fallback
    }
    return 'dourado-sp';
  });

  // Application Data State (Real PremieRpet TOTVS Data + Site Governance Delta)
  const initialBaseItems = useMemo(() => {
    return INITIAL_PDM_ITEMS.map((item) => ({
      ...item,
      narrative: item.narrative || item.originalDescription || item.shortDescription,
    }));
  }, []);

  const baseCatalogMapRef = useRef<Map<string, PDMItem>>(
    new Map(initialBaseItems.map((i) => [i.id, i]))
  );
  const baseMovementIdsRef = useRef<Set<string>>(
    new Set(INITIAL_MOVEMENTS.map((m) => m.id))
  );
  const latestDeltaRef = useRef<SiteGovernanceDelta | null>(loadLocalGovernanceDelta());
  const governanceVersionRef = useRef<number>(latestDeltaRef.current?.version || 0);
  const hasHydratedRemoteRef = useRef<boolean>(false);
  const lastSyncedSignatureRef = useRef<string>('');

  const [sharePointStatus, setSharePointStatus] = useState<SharePointIntegrationStatus | null>(null);

  const [pdmItems, setPdmItems] = useState<PDMItem[]>(() => {
    return applyGovernanceDeltaToCatalog(initialBaseItems, latestDeltaRef.current);
  });
  const [tenantStocks, setTenantStocks] = useState<TenantStockItem[]>(INITIAL_TENANT_STOCKS);
  const [movements, setMovements] = useState<StockMovement[]>(() => {
    const deltaMoves = latestDeltaRef.current?.movements || [];
    if (deltaMoves.length === 0) return INITIAL_MOVEMENTS;
    const baseIds = new Set(INITIAL_MOVEMENTS.map((m) => m.id));
    return [...deltaMoves.filter((m) => !baseIds.has(m.id)), ...INITIAL_MOVEMENTS];
  });

  // Modals
  const [isPdmBuilderOpen, setIsPdmBuilderOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<PDMItem | null>(null);
  const [addToStockPdmItem, setAddToStockPdmItem] = useState<PDMItem | null>(null);
  const [editingItem, setEditingItem] = useState<PDMItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Active detail item synced with latest pdmItems state
  const activeDetailItem = useMemo(() => {
    if (!selectedDetailItem) return null;
    return pdmItems.find((i) => i.id === selectedDetailItem.id) || selectedDetailItem;
  }, [selectedDetailItem, pdmItems]);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const activeTenant = useMemo(() => {
    return TENANTS.find((t) => t.id === currentTenantId) || TENANTS[0];
  }, [currentTenantId]);

  const handleToggleGlobal2FA = () => {
    const nextValue = !global2FARequired;
    setGlobal2FARequired(nextValue);
    try {
      localStorage.setItem('premierpet_global_2fa_required', String(nextValue));
    } catch {
      // ignore
    }
    showToast(
      nextValue
        ? 'Microsoft Authenticator (2FA) obrigatório HABILITADO para toda a plataforma.'
        : 'Contingência ativada: Microsoft Authenticator (2FA) DESABILITADO temporariamente.'
    );
  };

  // Handle direct approval/user-control deep link for authenticated MASTER_ADMIN
  useEffect(() => {
    if (currentUserAccount && currentUserRole === 'MASTER_ADMIN' && pendingUserControlRedirect) {
      setCurrentTab('user-control');
      setPendingUserControlRedirect(false);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // ignore
      }
    }
  }, [currentUserAccount, currentUserRole, pendingUserControlRedirect]);

  // Guard: Restrict Carga & Auditoria TOTVS, Controle de Usuários and Edição de campos PDM strictly to MASTER_ADMIN
  useEffect(() => {
    if (currentUserRole !== 'MASTER_ADMIN' && (currentTab === 'totvs-import' || currentTab === 'user-control' || currentTab === 'pdm-fields')) {
      setCurrentTab('inventory');
    }
  }, [currentUserRole, currentTab]);

  // Counts for Badges
  const pendingGovCount = useMemo(() => {
    return pdmItems.filter((i) => i.status === 'PENDING_REVIEW' || i.status === 'FLAGGED_DUPLICATE').length;
  }, [pdmItems]);

  const pendingUsersCount = useMemo(() => {
    return users.filter((u) => u.status === 'PENDING_APPROVAL').length;
  }, [users]);

  const lowStockCount = useMemo(() => {
    return tenantStocks.filter(
      (s) => s.tenantId === currentTenantId && s.currentStock <= s.minimumStock
    ).length;
  }, [tenantStocks, currentTenantId]);

  const totalCatalogCount = useMemo(() => {
    return pdmItems.filter((i) => i.status === 'APPROVED').length;
  }, [pdmItems]);

  // Background loader for complete 13,130 TOTVS items from CE0348 & Itens.csv
  useEffect(() => {
    let isMounted = true;
    async function loadFullCatalog() {
      try {
        const [resCat, resStk] = await Promise.all([
          fetch('/data/totvsMergedCatalog.json'),
          fetch('/data/totvsMergedStocks.json')
        ]);
        if (resCat.ok && resStk.ok) {
          const fullCatalog: PDMItem[] = await resCat.json();
          const fullStocks: TenantStockItem[] = await resStk.json();
          if (isMounted && fullCatalog.length > 0) {
            const normalizedFull = fullCatalog.map((item) => ({
              ...item,
              narrative: item.narrative || item.originalDescription || item.shortDescription,
            }));

            const nextMap = new Map(baseCatalogMapRef.current);
            normalizedFull.forEach((i) => nextMap.set(i.id, i));
            baseCatalogMapRef.current = nextMap;

            setPdmItems((prev) => {
              const prevById = new Map(prev.map((i) => [i.id, i]));
              const mergedFull = normalizedFull.map((item) => prevById.get(item.id) || item);
              const fullIds = new Set(mergedFull.map((i) => i.id));
              const extraPrev = prev.filter((i) => !fullIds.has(i.id));
              return applyGovernanceDeltaToCatalog(
                [...extraPrev, ...mergedFull],
                latestDeltaRef.current
              );
            });

            setTenantStocks((prev) => {
              if (fullStocks.length > prev.length) {
                return fullStocks;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('Background full TOTVS data load active:', err);
      }
    }
    loadFullCatalog();
    return () => { isMounted = false; };
  }, []);

  const applyRemoteGovernanceDelta = useCallback((remoteState: SiteGovernanceDelta) => {
    governanceVersionRef.current = remoteState.version;
    latestDeltaRef.current = remoteState;
    saveLocalGovernanceDelta(remoteState);

    if (remoteState.users && remoteState.users.length > 0) {
      const mergedUsers = mergeUsersWithInitial(remoteState.users);
      const normalizedRemote: SiteGovernanceDelta = {
        ...remoteState,
        users: mergedUsers,
      };
      latestDeltaRef.current = normalizedRemote;
      lastSyncedSignatureRef.current = getDeltaSignature(normalizedRemote);
      setUsers(mergedUsers);
      try {
        localStorage.setItem('premierpet_users', JSON.stringify(mergedUsers));
      } catch {
        // ignore
      }
    } else {
      lastSyncedSignatureRef.current = getDeltaSignature(remoteState);
    }

    if (typeof remoteState.global2FARequired === 'boolean') {
      setGlobal2FARequired(remoteState.global2FARequired);
      try {
        localStorage.setItem('premierpet_global_2fa_required', String(remoteState.global2FARequired));
      } catch {
        // ignore
      }
    }

    if (remoteState.pdmLevels && remoteState.pdmLevels.length > 0) {
      setPdmLevels(remoteState.pdmLevels);
      try {
        localStorage.setItem('premierpet_pdm_levels', JSON.stringify(remoteState.pdmLevels));
      } catch {
        // ignore
      }
    }

    setPdmItems((prev) => {
      const baseOnly = prev.filter((item) => baseCatalogMapRef.current.has(item.id)).map(
        (item) => baseCatalogMapRef.current.get(item.id) || item
      );
      return applyGovernanceDeltaToCatalog(baseOnly, remoteState);
    });

    if (remoteState.movements) {
      setMovements(() => {
        const remoteMoves = remoteState.movements.filter(
          (m) => !baseMovementIdsRef.current.has(m.id)
        );
        return [...remoteMoves, ...INITIAL_MOVEMENTS];
      });
    }
  }, []);

  // Initial remote governance hydration & 15s polling for multi-plant / SharePoint sync
  useEffect(() => {
    let active = true;

    async function hydrateAndPoll(isInitial: boolean) {
      const res = await fetchRemoteGovernanceState(isInitial);
      if (!active) return;

      if (res?.sharePoint) {
        setSharePointStatus(res.sharePoint);
      }

      if (res?.state && res.state.version > governanceVersionRef.current) {
        applyRemoteGovernanceDelta(res.state);
      } else if (isInitial) {
        const localDelta = extractSiteGovernanceDelta({
          users,
          global2FARequired,
          pdmLevels,
          pdmItems,
          movements,
          baseCatalogMap: baseCatalogMapRef.current,
          baseMovementIds: baseMovementIdsRef.current,
          version: governanceVersionRef.current,
          updatedBy: currentUserAccount?.name,
        });
        lastSyncedSignatureRef.current = getDeltaSignature(localDelta);
      }

      if (isInitial) {
        hasHydratedRemoteRef.current = true;
      }
    }

    hydrateAndPoll(true);
    const interval = setInterval(() => {
      hydrateAndPoll(false);
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [applyRemoteGovernanceDelta]);

  // Auto-push lightweight governance delta whenever site-created data changes
  useEffect(() => {
    if (!hasHydratedRemoteRef.current) return;

    const currentDelta = extractSiteGovernanceDelta({
      users,
      global2FARequired,
      pdmLevels,
      pdmItems,
      movements,
      baseCatalogMap: baseCatalogMapRef.current,
      baseMovementIds: baseMovementIdsRef.current,
      version: governanceVersionRef.current,
      updatedBy: currentUserAccount?.name || 'Portal PDM',
    });

    const sig = getDeltaSignature(currentDelta);
    if (sig === lastSyncedSignatureRef.current) return;

    lastSyncedSignatureRef.current = sig;
    latestDeltaRef.current = currentDelta;
    saveLocalGovernanceDelta(currentDelta);

    pushRemoteGovernanceState(currentDelta, currentUserAccount?.name || 'Portal PDM').then((res) => {
      if (res?.sharePoint) {
        setSharePointStatus(res.sharePoint);
      }
      if (res?.state?.version) {
        governanceVersionRef.current = res.state.version;
        latestDeltaRef.current = res.state;
        saveLocalGovernanceDelta(res.state);
      }
    });
  }, [users, global2FARequired, pdmLevels, pdmItems, movements, currentUserAccount?.name]);

  const handleManualSharePointSync = async () => {
    const currentDelta = extractSiteGovernanceDelta({
      users,
      global2FARequired,
      pdmLevels,
      pdmItems,
      movements,
      baseCatalogMap: baseCatalogMapRef.current,
      baseMovementIds: baseMovementIdsRef.current,
      version: governanceVersionRef.current,
      updatedBy: currentUserAccount?.name || 'Master Admin',
    });

    const res = await triggerManualSharePointSync(
      currentDelta,
      currentUserAccount?.name || 'Master Admin'
    );
    if (res?.sharePoint) {
      setSharePointStatus(res.sharePoint);
    }
    if (res?.state && res.state.version > governanceVersionRef.current) {
      applyRemoteGovernanceDelta(res.state);
    }
    if (res?.sharePoint?.lastSyncStatus === 'SYNCED') {
      showToast(res.sharePoint.lastSyncMessage || 'Sincronização com SharePoint concluída!');
    } else if (res?.sharePoint?.lastSyncStatus === 'ERROR') {
      showToast(`Erro na sincronização SharePoint: ${res.sharePoint.lastSyncMessage || 'Verifique o fluxo.'}`);
    } else {
      showToast(res?.sharePoint?.lastSyncMessage || 'Estado salvo no servidor local.');
    }
  };

  // --- WORKFLOW HANDLERS ---

  // 1. Save new PDM item from Builder
  const handleSavePdmItem = (itemData: Partial<PDMItem>) => {
    const nextSeq = pdmItems.length + 1;
    const isApproved = itemData.status === 'APPROVED';
    const code = isApproved 
      ? `5040-${String(nextSeq + 2500).padStart(4, '0')}`
      : `PDM-REQ-2026-${String(nextSeq + 10).padStart(3, '0')}`;

    const newItem: PDMItem = {
      id: `pdm-${Date.now()}`,
      pdmCode: code,
      totvsCode: code,
      totvsFamily: itemData.totvsFamily || '5040',
      unitOfMeasure: itemData.unitOfMeasure || 'UN',
      totvsPlant: itemData.totvsPlant || (currentTenantId === 'dourado-sp' ? 'Dourado' : 'Paraná'),
      situation: 'Ativo',
      originalDescription: itemData.shortDescription || 'ITEM SOLICITADO VIA PDM BUILDER',
      baseValue: 120.00,
      groupId: itemData.groupId || 'grp-mecanica',
      subgroupId: itemData.subgroupId || 'sub-rolamentos',
      specificSubgroupId: itemData.specificSubgroupId || 'spec-rol-esfera',
      shortDescription: itemData.shortDescription || 'ITEM PADRONIZADO',
      longDescription: itemData.longDescription || 'DESCRIÇÃO TÉCNICA DETALHADA PREMIERPET.',
      narrative: itemData.narrative || itemData.longDescription || itemData.shortDescription,
      attributes: itemData.attributes || {},
      ncm: itemData.ncm || '8482.10.10',
      unspsc: itemData.unspsc || '31171504',
      genericImage: itemData.genericImage,
      status: itemData.status || 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      requestedByTenantId: itemData.requestedByTenantId,
      requestedByTenantName: itemData.requestedByTenantName,
      requestedByUser: itemData.requestedByUser,
      notes: itemData.notes,
      duplicateOfId: itemData.duplicateOfId,
      similarityScore: itemData.similarityScore,
      leadTimeDays: itemData.leadTimeDays,
      orderPoint: itemData.orderPoint,
      safetyStockWarehouse: itemData.safetyStockWarehouse,
      establishments: itemData.establishments,
    };

    setPdmItems((prev) => [newItem, ...prev]);

    // If approved and has establishment stock defined, add to local tenantStocks
    if (isApproved && itemData.establishments) {
      const estab10 = itemData.establishments['10'];
      const estab14 = itemData.establishments['14'];

      if (estab10) {
        setTenantStocks((prev) => [
          {
            id: `stk-dou-${Date.now()}`,
            tenantId: 'dourado-sp',
            pdmItemId: newItem.id,
            internalCode: `DOU-${newItem.totvsCode}`,
            currentStock: estab10.saldoEstoque || 0,
            minimumStock: estab10.pontoEncomenda || 1,
            safetyStock: estab10.estoqueSegurancaAlmoxarifado || 1,
            safetyStockWarehouse: estab10.estoqueSegurancaAlmoxarifado || 1,
            orderPoint: estab10.pontoEncomenda || 1,
            maxStock: Math.max(10, (estab10.pontoEncomenda || 1) * 3),
            unitCost: newItem.baseValue || 45.00,
            storageLocation: 'Almox Central Dourado / Setor A',
            criticism: 'E',
            leadTimeDays: estab10.tempoRessuprimento || 15,
            lastInventoryDate: '2026-11-10',
            status: 'ACTIVE',
          },
          ...prev,
        ]);
      }

      if (estab14) {
        setTenantStocks((prev) => [
          {
            id: `stk-pam-${Date.now() + 1}`,
            tenantId: 'porto-amazonas-pr',
            pdmItemId: newItem.id,
            internalCode: `PAM-${newItem.totvsCode}`,
            currentStock: estab14.saldoEstoque || 0,
            minimumStock: estab14.pontoEncomenda || 1,
            safetyStock: estab14.estoqueSegurancaAlmoxarifado || 1,
            safetyStockWarehouse: estab14.estoqueSegurancaAlmoxarifado || 1,
            orderPoint: estab14.pontoEncomenda || 1,
            maxStock: Math.max(10, (estab14.pontoEncomenda || 1) * 3),
            unitCost: newItem.baseValue || 45.00,
            storageLocation: 'Almox Industrial Paraná / Bloco P',
            criticism: 'E',
            leadTimeDays: estab14.tempoRessuprimento || 15,
            lastInventoryDate: '2026-11-10',
            status: 'ACTIVE',
          },
          ...prev,
        ]);
      }
    }

    if (isApproved) {
      showToast(`Item ${newItem.totvsCode} homologado e inserido no Catálogo TOTVS!`);
      setCurrentTab('catalog');
    } else {
      showToast(`Solicitação ${newItem.pdmCode} enviada para a Fila de Governança Master!`);
      setCurrentTab('governance');
    }
  };

  // 2. Approve PDM Item in Governance (Direct/Legacy)
  const handleApproveGovernanceItem = (itemId: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const isRequestCode = item.pdmCode.startsWith('PDM-REQ');
          const officialTotvsCode = isRequestCode
            ? `5040-${Math.floor(7500 + Math.random() * 500)}`
            : item.totvsCode || item.pdmCode;

          const currentHistory = item.changeHistory || [];

          return {
            ...item,
            totvsCode: officialTotvsCode,
            pdmCode: `PDM-${officialTotvsCode}`,
            status: 'APPROVED',
            approvalWorkflow: item.approvalWorkflow ? {
              ...item.approvalWorkflow,
              isFullyApproved: true,
              currentPendingTier: null,
            } : undefined,
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: 'Aprovação Master e Homologação PDM',
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: currentUserAccount?.name || 'Master Admin',
                approvedAt: now,
                status: 'APPROVED',
                reason: 'Item aprovado pela governança central e cadastrado no catálogo TOTVS.',
              },
              ...currentHistory,
            ],
          };
        }
        return item;
      })
    );
    showToast('Item aprovado com sucesso e integrado ao Catálogo Mestre TOTVS!');
  };

  // 2.1 Multi-tier Approval Handler (Níveis 1, 2, 3 por alçada de valor)
  const handleApproveTier = (itemId: string, tier: ApprovalTierLevel) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const currentWf = item.approvalWorkflow;
        const currentHistory = item.changeHistory || [];

        if (!currentWf) {
          return {
            ...item,
            status: 'APPROVED',
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: 'Aprovação de Cadastro',
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: currentUserAccount?.name || 'Master Admin',
                approvedAt: now,
                status: 'APPROVED',
              },
              ...currentHistory,
            ],
          };
        }

        const updatedSteps = currentWf.steps.map((st) => {
          if (st.tier === tier) {
            return {
              ...st,
              status: 'APPROVED' as const,
              approvedByUser: currentUserAccount?.name || 'Aprovador Alçada',
              approvedAt: now,
            };
          }
          return st;
        });

        const unapprovedTiers = currentWf.requiredTiers.filter((t) => {
          const s = updatedSteps.find((step) => step.tier === t);
          return s?.status !== 'APPROVED';
        });

        if (unapprovedTiers.length === 0) {
          // All required tiers approved! Homologate PDM
          const isRequestCode = item.pdmCode.startsWith('PDM-REQ');
          const officialTotvsCode = isRequestCode
            ? `5040-${Math.floor(7500 + Math.random() * 500)}`
            : item.totvsCode || item.pdmCode;

          return {
            ...item,
            totvsCode: officialTotvsCode,
            pdmCode: `PDM-${officialTotvsCode}`,
            status: 'APPROVED',
            approvalWorkflow: {
              ...currentWf,
              steps: updatedSteps,
              currentPendingTier: null,
              isFullyApproved: true,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: `Aprovação Final Alçada Nível ${tier} - PDM Homologado`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: currentUserAccount?.name || 'Master Admin',
                approvedAt: now,
                approvalTier: tier,
                status: 'APPROVED',
                reason: 'Homologação concluída com sucesso após atendimento a todas as alçadas requeridas.',
              },
              ...currentHistory,
            ],
          };
        } else {
          // Next tier becomes pending
          const nextTier = Math.min(...unapprovedTiers) as ApprovalTierLevel;
          const stepsWithNextPending = updatedSteps.map((st) => {
            if (st.tier === nextTier) {
              return { ...st, status: 'PENDING' as const };
            }
            return st;
          });

          return {
            ...item,
            approvalWorkflow: {
              ...currentWf,
              steps: stepsWithNextPending,
              currentPendingTier: nextTier,
              isFullyApproved: false,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: `Aprovação Alçada Nível ${tier} Concluída`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: currentUserAccount?.name || 'Aprovador Alçada',
                approvedAt: now,
                approvalTier: tier,
                status: 'APPROVED',
                reason: `Aprovado pelo Nível ${tier}. Encaminhado para a próxima alçada (Nível ${nextTier}).`,
              },
              ...currentHistory,
            ],
          };
        }
      })
    );
    showToast(`Alçada Nível ${tier} aprovada com sucesso!`);
  };

  // 3. Reject PDM Item in Governance
  const handleRejectGovernanceItem = (itemId: string, reason: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const currentHistory = item.changeHistory || [];
          return {
            ...item,
            status: 'REJECTED',
            rejectionReason: reason,
            approvalWorkflow: item.approvalWorkflow ? {
              ...item.approvalWorkflow,
              isFullyApproved: false,
              currentPendingTier: null,
              rejection: {
                rejectedBy: currentUserAccount?.name || 'Master Admin',
                rejectedAt: now,
                tier: item.approvalWorkflow.currentPendingTier || 1,
                reason,
              },
            } : undefined,
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'REJECTED',
                actionLabel: 'Reprovação de Cadastro PDM',
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: currentUserAccount?.name || 'Master Admin',
                approvedAt: now,
                status: 'REJECTED',
                rejectionReason: reason,
              },
              ...currentHistory,
            ],
          };
        }
        return item;
      })
    );
    showToast('Solicitação rejeitada com justificativa técnica registrada.');
  };

  // 3.1 Submit Item Alteration (Classification, Descriptions, NCM, etc.)
  const handleSubmitItemChange = (
    itemId: string,
    proposedValues: Partial<PDMItem>,
    fieldChanges: ItemFieldChange[],
    reason: string,
    isDirectApproval: boolean
  ) => {
    const isMaster = isDirectApproval || currentUserRole === 'MASTER_ADMIN';
    const now = new Date().toISOString();

    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const currentHistory = i.changeHistory || [];

        if (isMaster) {
          return {
            ...i,
            ...proposedValues,
            isClassified: true,
            classificationOrigin: 'PDM_HOMOLOGADO',
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'EDITED',
                actionLabel: 'Alteração Cadastral Efetivada (Master Admin)',
                requestedByUser: currentUserAccount?.name || 'Master Admin',
                requestedByTenantName: activeTenant.name,
                approvedByUser: currentUserAccount?.name || 'Master Admin',
                approvedAt: now,
                status: 'APPROVED',
                reason,
                changes: fieldChanges,
              },
              ...currentHistory,
            ],
            pendingChange: undefined,
          };
        } else {
          return {
            ...i,
            pendingChange: {
              id: `pc-${Date.now()}`,
              requestedAt: now,
              requestedByUser: currentUserAccount?.name || 'Usuário',
              requestedByTenantId: currentTenantId,
              requestedByTenantName: activeTenant.name,
              reason,
              changes: fieldChanges,
              proposedValues,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'EDITED',
                actionLabel: 'Solicitação de Alteração Cadastral Submetida',
                requestedByUser: currentUserAccount?.name || 'Usuário',
                requestedByTenantName: activeTenant.name,
                status: 'PENDING',
                reason,
                changes: fieldChanges,
              },
              ...currentHistory,
            ],
          };
        }
      })
    );

    if (isMaster) {
      showToast('Alteração cadastral efetivada e sincronizada para todas as unidades!');
    } else {
      showToast('Solicitação de alteração enviada para a Fila de Governança Master!');
    }
  };

  // 3.2 Approve Change Request in Governance
  const handleApproveChangeRequest = (itemId: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId || !i.pendingChange) return i;
        const currentHistory = i.changeHistory || [];
        const pending = i.pendingChange;

        return {
          ...i,
          ...pending.proposedValues,
          isClassified: true,
          classificationOrigin: 'PDM_HOMOLOGADO',
          pendingChange: undefined,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'APPROVED',
              actionLabel: 'Alteração Cadastral Aprovada pela Governança',
              requestedByUser: pending.requestedByUser,
              requestedByTenantName: pending.requestedByTenantName,
              approvedByUser: currentUserAccount?.name || 'Master Admin',
              approvedAt: now,
              status: 'APPROVED',
              reason: pending.reason,
              changes: pending.changes,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Alteração aprovada e propagada para todos os ambientes do sistema!');
  };

  // 3.3 Reject Change Request in Governance
  const handleRejectChangeRequest = (itemId: string, reason: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId || !i.pendingChange) return i;
        const currentHistory = i.changeHistory || [];
        const pending = i.pendingChange;

        return {
          ...i,
          pendingChange: undefined,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'REJECTED',
              actionLabel: 'Solicitação de Alteração Rejeitada',
              requestedByUser: pending.requestedByUser,
              requestedByTenantName: pending.requestedByTenantName,
              approvedByUser: currentUserAccount?.name || 'Master Admin',
              approvedAt: now,
              status: 'REJECTED',
              reason: pending.reason,
              rejectionReason: reason,
              changes: pending.changes,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de alteração rejeitada.');
  };

  // 3.4 Request Warehouse Integration
  const handleRequestIntegration = (
    item: PDMItem, 
    data: {
      sourcePlant: string;
      targetPlant: string;
      requestedSafetyStock: number;
      requestedOrderPoint?: number;
      reason: string;
    }
  ) => {
    const now = new Date().toISOString();
    const newIntegReq: ItemIntegrationRequest = {
      id: `integ-${Date.now()}`,
      pdmItemId: item.id,
      pdmCode: item.totvsCode || item.pdmCode,
      itemDescription: item.shortDescription,
      sourcePlant: data.sourcePlant,
      targetPlant: data.targetPlant,
      requestedSafetyStock: data.requestedSafetyStock,
      requestedOrderPoint: data.requestedOrderPoint,
      reason: data.reason,
      requestedByUser: currentUserAccount?.name || 'Usuário',
      requestedByTenantId: currentTenantId,
      requestedByTenantName: activeTenant.name,
      requestedAt: now,
      status: 'PENDING',
    };

    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        const currentHistory = i.changeHistory || [];
        const currentInteg = i.integrationRequests || [];
        return {
          ...i,
          integrationRequests: [newIntegReq, ...currentInteg],
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'INTEGRATED',
              actionLabel: `Solicitação de Integração (Estab. ${data.sourcePlant} ➔ Estab. ${data.targetPlant})`,
              requestedByUser: currentUserAccount?.name || 'Usuário',
              requestedByTenantName: activeTenant.name,
              status: 'PENDING',
              reason: `${data.reason} (Estoque seguro solicitado: ${data.requestedSafetyStock} ${item.unitOfMeasure || 'UN'})`,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de integração de almoxarifado enviada para governança Master!');
  };

  // 3.5 Approve Warehouse Integration in Governance
  const handleApproveIntegration = (itemId: string, requestId: string) => {
    const now = new Date().toISOString();
    let approvedReq: ItemIntegrationRequest | undefined;
    let targetItem: PDMItem | undefined;

    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        targetItem = i;
        const currentHistory = i.changeHistory || [];
        const updatedInteg = (i.integrationRequests || []).map((req) => {
          if (req.id === requestId) {
            approvedReq = req;
            return {
              ...req,
              status: 'APPROVED' as const,
              reviewedBy: currentUserAccount?.name || 'Master Admin',
              reviewedAt: now,
            };
          }
          return req;
        });

        const targetPlant = approvedReq?.targetPlant || '14';
        const currentEstab = i.establishments || {};
        const newEstabData: EstabelecimentoStockData = {
          estabelecimento: targetPlant,
          plantaNome: targetPlant === '10' ? 'Dourado/SP' : 'Porto Amazonas/PR',
          saldoEstoque: currentEstab[targetPlant]?.saldoEstoque || 0,
          pontoEncomenda: approvedReq?.requestedOrderPoint || 2,
          estoqueSegurancaAlmoxarifado: approvedReq?.requestedSafetyStock || 5,
          tempoRessuprimento: 15,
          ultimaEntrada: now.split('T')[0],
        };

        return {
          ...i,
          establishments: {
            ...currentEstab,
            [targetPlant]: newEstabData,
          },
          integrationRequests: updatedInteg,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'INTEGRATED',
              actionLabel: `Integração Aprovada para Estabelecimento ${targetPlant}`,
              requestedByUser: approvedReq?.requestedByUser || 'Solicitante',
              approvedByUser: currentUserAccount?.name || 'Master Admin',
              approvedAt: now,
              status: 'APPROVED',
              reason: `Integração aprovada. Estoque seguro parametrizado em ${approvedReq?.requestedSafetyStock} ${i.unitOfMeasure || 'UN'}.`,
            },
            ...currentHistory,
          ],
        };
      })
    );

    // Also ensure tenantStock exists for target tenant
    if (approvedReq && targetItem) {
      const targetTenantId = approvedReq.targetPlant === '10' ? 'dourado-sp' : 'porto-amazonas-pr';
      setTenantStocks((prev) => {
        const existing = prev.find((s) => s.tenantId === targetTenantId && s.pdmItemId === itemId);
        if (existing) {
          return prev.map((s) => {
            if (s.id === existing.id) {
              return {
                ...s,
                safetyStock: approvedReq!.requestedSafetyStock,
                safetyStockWarehouse: approvedReq!.requestedSafetyStock,
                minimumStock: approvedReq!.requestedOrderPoint || s.minimumStock,
                orderPoint: approvedReq!.requestedOrderPoint || s.orderPoint,
                status: 'ACTIVE',
              };
            }
            return s;
          });
        }
        const newStock: TenantStockItem = {
          id: `stk-${targetTenantId}-${Date.now()}`,
          tenantId: targetTenantId,
          pdmItemId: itemId,
          internalCode: `${targetTenantId === 'dourado-sp' ? 'DOU' : 'PAM'}-${targetItem!.totvsCode || targetItem!.pdmCode}`,
          currentStock: 0,
          totvsStock: 0,
          wmsStock: 0,
          minimumStock: approvedReq!.requestedOrderPoint || 2,
          safetyStock: approvedReq!.requestedSafetyStock,
          safetyStockWarehouse: approvedReq!.requestedSafetyStock,
          orderPoint: approvedReq!.requestedOrderPoint || 2,
          maxStock: approvedReq!.requestedSafetyStock * 3,
          unitCost: targetItem!.baseValue || 45.0,
          storageLocation: targetTenantId === 'dourado-sp' ? 'Almox Central Dourado / Setor A' : 'Almox Industrial Paraná / Bloco P',
          criticism: 'E',
          leadTimeDays: 15,
          lastInventoryDate: now.split('T')[0],
          status: 'ACTIVE',
        };
        return [newStock, ...prev];
      });
    }

    showToast('Integração de almoxarifado aprovada e estoque de segurança configurado!');
  };

  // 3.6 Reject Warehouse Integration
  const handleRejectIntegration = (itemId: string, requestId: string, reason: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const currentHistory = i.changeHistory || [];
        const updatedInteg = (i.integrationRequests || []).map((req) => {
          if (req.id === requestId) {
            return {
              ...req,
              status: 'REJECTED' as const,
              reviewedBy: currentUserAccount?.name || 'Master Admin',
              reviewedAt: now,
              rejectionReason: reason,
            };
          }
          return req;
        });

        return {
          ...i,
          integrationRequests: updatedInteg,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'REJECTED',
              actionLabel: 'Integração de Almoxarifado Rejeitada',
              requestedByUser: 'Solicitante',
              approvedByUser: currentUserAccount?.name || 'Master Admin',
              approvedAt: now,
              status: 'REJECTED',
              rejectionReason: reason,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de integração rejeitada.');
  };

  // 3.7 Request Item Inactivation / Obsolescence
  const handleRequestInactivation = (
    item: PDMItem, 
    data: { reason: string; replacementItemCode?: string; }
  ) => {
    if (item.inactivationRequest?.status === 'PENDING') {
      showToast('Já existe uma solicitação de inativação em andamento para este item.');
      return;
    }
    if (item.situation?.toLowerCase().includes('obsoleto')) {
      showToast('Este item já se encontra inativado (Totalmente Obsoleto).');
      return;
    }
    const now = new Date().toISOString();
    const newInactReq: ItemInactivationRequest = {
      id: `inact-${Date.now()}`,
      pdmItemId: item.id,
      pdmCode: item.totvsCode || item.pdmCode,
      itemDescription: item.shortDescription,
      reason: data.reason,
      replacementItemCode: data.replacementItemCode,
      requestedByUser: currentUserAccount?.name || 'Usuário',
      requestedByTenantId: currentTenantId,
      requestedByTenantName: activeTenant.name,
      requestedAt: now,
      status: 'PENDING',
    };

    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        const currentHistory = i.changeHistory || [];
        return {
          ...i,
          inactivationRequest: newInactReq,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'INACTIVATED',
              actionLabel: 'Solicitação de Inativação / Obsolescência',
              requestedByUser: currentUserAccount?.name || 'Usuário',
              requestedByTenantName: activeTenant.name,
              status: 'PENDING',
              reason: data.reason,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de inativação enviada para a Fila de Governança Master!');
  };

  // 3.8 Approve Inactivation in Governance
  const handleApproveInactivation = (itemId: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const currentHistory = i.changeHistory || [];
        const inact = i.inactivationRequest;

        return {
          ...i,
          situation: 'Totalmente Obsoleto',
          inactivationRequest: inact
            ? {
                ...inact,
                status: 'APPROVED',
                reviewedBy: currentUserAccount?.name || 'Master Admin',
                reviewedAt: now,
              }
            : undefined,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'INACTIVATED',
              actionLabel: 'Item Inativado (Totalmente Obsoleto)',
              requestedByUser: inact?.requestedByUser || 'Solicitante',
              approvedByUser: currentUserAccount?.name || 'Master Admin',
              approvedAt: now,
              status: 'APPROVED',
              reason: inact?.reason || 'Inativação homologada pela governança corporativa.',
            },
            ...currentHistory,
          ],
        };
      })
    );

    setTenantStocks((prev) =>
      prev.map((s) => {
        if (s.pdmItemId === itemId) {
          return { ...s, status: 'INACTIVE' };
        }
        return s;
      })
    );
    showToast('Item inativado com sucesso (Totalmente Obsoleto).');
  };

  // 3.9 Reject Inactivation in Governance
  const handleRejectInactivation = (itemId: string, reason: string) => {
    const now = new Date().toISOString();
    setPdmItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const currentHistory = i.changeHistory || [];
        const inact = i.inactivationRequest;

        return {
          ...i,
          inactivationRequest: inact
            ? {
                ...inact,
                status: 'REJECTED',
                reviewedBy: currentUserAccount?.name || 'Master Admin',
                reviewedAt: now,
                rejectionReason: reason,
              }
            : undefined,
          changeHistory: [
            {
              id: `chg-${Date.now()}`,
              timestamp: now,
              actionType: 'REJECTED',
              actionLabel: 'Inativação Rejeitada - Item Mantido Ativo',
              requestedByUser: inact?.requestedByUser || 'Solicitante',
              approvedByUser: currentUserAccount?.name || 'Master Admin',
              approvedAt: now,
              status: 'REJECTED',
              rejectionReason: reason,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de inativação reprovada.');
  };

  // 4. Link duplicate to existing master code
  const handleLinkDuplicate = (requestedId: string, masterId: string) => {
    const master = pdmItems.find((i) => i.id === masterId);
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id === requestedId) {
          return {
            ...item,
            status: 'REJECTED',
            rejectionReason: `Duplicidade sanada. Vinculado oficialmente ao código TOTVS ${master?.totvsCode || master?.pdmCode || masterId}.`,
          };
        }
        return item;
      })
    );
    showToast(`Solicitação unificada com sucesso sob o código TOTVS ${master?.totvsCode || master?.pdmCode}!`);
  };

  // 5. Register stock movement (IN, OUT, RETURN)
  const handleRegisterMovement = (movementData: Omit<StockMovement, 'id'>) => {
    const newMovement: StockMovement = {
      ...movementData,
      id: `mov-${Date.now()}`,
    };

    setMovements((prev) => [newMovement, ...prev]);

    setTenantStocks((prev) =>
      prev.map((stock) => {
        if (stock.tenantId === movementData.tenantId && stock.pdmItemId === movementData.pdmItemId) {
          let updatedStock = stock.currentStock;
          let updatedUnitCost = stock.unitCost;

          if (movementData.type === 'OUT') {
            updatedStock = Math.max(0, stock.currentStock - movementData.quantity);
          } else if (movementData.type === 'IN') {
            const oldTotalVal = stock.currentStock * stock.unitCost;
            const newTotalVal = oldTotalVal + movementData.quantity * movementData.unitCost;
            updatedStock = stock.currentStock + movementData.quantity;
            updatedUnitCost = updatedStock > 0 ? newTotalVal / updatedStock : movementData.unitCost;
          } else if (movementData.type === 'RETURN') {
            updatedStock = stock.currentStock + movementData.quantity;
          }

          return {
            ...stock,
            currentStock: updatedStock,
            unitCost: updatedUnitCost,
          };
        }
        return stock;
      })
    );

    showToast(`Movimentação de ${movementData.type === 'OUT' ? 'Saída' : movementData.type === 'IN' ? 'Entrada' : 'Devolução'} registrada com sucesso!`);
  };

  // 6. Add catalog item to local tenant warehouse
  const handleConfirmAddToStock = (stockData: Omit<TenantStockItem, 'id'>) => {
    const newStockItem: TenantStockItem = {
      ...stockData,
      id: `stk-${Date.now()}`,
    };

    setTenantStocks((prev) => [...prev, newStockItem]);
    showToast(`Item ${newStockItem.internalCode} incorporado ao almoxarifado de ${activeTenant.name}!`);
    setCurrentTab('inventory');
  };

  // Auth Handlers
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUserAccount(user);
    setCurrentUserRole(user.role);
    if (user.tenantId) {
      setCurrentTenantId(user.tenantId);
    }
    try {
      localStorage.setItem('premierpet_logged_user', JSON.stringify(user));
    } catch {
      // ignore
    }
    if (user.role === 'MASTER_ADMIN' && pendingUserControlRedirect) {
      setCurrentTab('user-control');
      setPendingUserControlRedirect(false);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // ignore
      }
    }
    showToast(`Bem-vindo, ${user.name}! Sessão iniciada com sucesso.`);
  };

  const handleLogout = () => {
    setCurrentUserAccount(null);
    try {
      localStorage.removeItem('premierpet_logged_user');
    } catch {
      // ignore
    }
    showToast('Sessão encerrada com sucesso.');
  };

  // If user is not authenticated, show the official PremieRpet Login Screen with Microsoft Authenticator 2FA
  if (!currentUserAccount) {
    return (
      <LoginScreen
        users={users}
        onUpdateUsers={handleUpdateUsers}
        global2FARequired={global2FARequired}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* 1. PINNED LEFT SIDEBAR (COLLAPSED TO ICONS, EXPANDS ON HOVER) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUserRole={currentUserRole}
        pendingGovCount={pendingGovCount}
        lowStockCount={lowStockCount}
        totalCatalogCount={totalCatalogCount}
        pendingUsersCount={pendingUsersCount}
        onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
        currentUserAccount={currentUserAccount}
        onLogout={handleLogout}
      />

      {/* 2. MAIN VIEWPORT AREA (OFFSET BY COLLAPSED SIDEBAR WIDTH) */}
      <div className="flex-1 flex flex-col pl-[76px] min-w-0">
        
        {/* TOP UNIFIED HEADER */}
        <Header
          currentTab={currentTab}
          currentTenant={activeTenant}
          userUnitName={currentUserAccount.tenantName}
        />

        {/* TOAST ALERT */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {/* MAIN BODY CONTAINER */}
        <main className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto space-y-6">

          {/* TAB 1: PDM CATALOG (GLOBAL TOTVS) */}
          {currentTab === 'catalog' && (
            <CatalogView
              items={pdmItems}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              tenantStocks={tenantStocks}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
              onAddToStock={(pdmItem) => setAddToStockPdmItem(pdmItem)}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
            />
          )}
          
          {/* TAB 1.5: CONSULTA POR CLASSIFICAÇÃO PDM (TODOS OS USUÁRIOS) */}
          {currentTab === 'pdm-classification' && (
            <PdmClassificationQueryView
              items={pdmItems}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              niveis={pdmLevels}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
              onOpenEdit={(pdmItem) => {
                setEditingItem(pdmItem);
                setIsEditModalOpen(true);
              }}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
            />
          )}

          {/* TAB 2: GOVERNANCE & SANEAMENTO (MASTER & ALÇADAS) */}
          {currentTab === 'governance' && (
            <GovernanceView
              items={pdmItems}
              currentUserRole={currentUserRole}
              currentUserTier={currentUserAccount.approvalTier || (currentUserRole === 'MASTER_ADMIN' ? 'ALL' : 1)}
              currentUserName={currentUserAccount.name}
              currentTenant={activeTenant}
              onApproveItem={handleApproveGovernanceItem}
              onApproveTier={handleApproveTier}
              onRejectItem={handleRejectGovernanceItem}
              onLinkDuplicate={handleLinkDuplicate}
              onApproveChangeRequest={handleApproveChangeRequest}
              onRejectChangeRequest={handleRejectChangeRequest}
              onApproveIntegration={handleApproveIntegration}
              onRejectIntegration={handleRejectIntegration}
              onApproveInactivation={handleApproveInactivation}
              onRejectInactivation={handleRejectInactivation}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
            />
          )}

          {/* TAB 2.5: CARGA & AUDITORIA TOTVS (EXCLUSIVO MASTER ADMIN) */}
          {currentTab === 'totvs-import' && currentUserRole === 'MASTER_ADMIN' && (
            <TotvsImportView
              existingPdmItems={pdmItems}
              existingStocks={tenantStocks}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              onIntegrateItems={(newItems) => {
                setPdmItems((prev) => [...newItems, ...prev]);
                showToast(`${newItems.length} novos itens homologados e integrados ao Catálogo PDM!`);
              }}
              onIntegrateMergedBases={(mergedItems, mergedStocks) => {
                setPdmItems(mergedItems);
                if (mergedStocks && mergedStocks.length > 0) {
                  setTenantStocks(mergedStocks);
                }
                showToast(`Bases mescladas com sucesso! ${mergedItems.length.toLocaleString('pt-BR')} itens integrados aos ambientes Master, Dourado e Porto Amazonas.`);
              }}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
            />
          )}

          {/* TAB 2.6: CONTROLE DE USUÁRIOS (EXCLUSIVO MASTER ADMIN) */}
          {currentTab === 'user-control' && currentUserRole === 'MASTER_ADMIN' && currentUserAccount && (
            <UserControlView
              users={users}
              onUpdateUsers={handleUpdateUsers}
              currentUser={currentUserAccount}
              onShowToast={showToast}
              global2FARequired={global2FARequired}
              onToggleGlobal2FA={handleToggleGlobal2FA}
              initialApproveUsername={pendingApproveUsername}
              onClearInitialApprove={() => setPendingApproveUsername(null)}
              sharePointStatus={sharePointStatus}
              onManualSharePointSync={handleManualSharePointSync}
            />
          )}

          {/* TAB 2.7: EDIÇÃO DE CAMPOS PDM (EXCLUSIVO MASTER ADMIN) */}
          {currentTab === 'pdm-fields' && currentUserRole === 'MASTER_ADMIN' && (
            <PdmFieldsEditorView
              niveis={pdmLevels}
              onUpdateNiveis={handleUpdatePdmLevels}
              catalogItems={pdmItems}
              onShowToast={showToast}
            />
          )}

          {/* TAB 3: LOCAL WAREHOUSE (TENANT) */}
          {currentTab === 'inventory' && (
            <InventoryView
              tenantStocks={tenantStocks}
              pdmItems={pdmItems}
              movements={movements}
              currentTenant={activeTenant}
              currentUserRole={currentUserRole}
              onRegisterMovement={handleRegisterMovement}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
              onOpenCatalog={() => setCurrentTab('catalog')}
            />
          )}

          {/* TAB 4: INDUSTRIAL ABC CURVE */}
          {currentTab === 'abc' && (
            <ABCCurveDashboard
              tenantStocks={tenantStocks}
              movements={movements}
              pdmItems={pdmItems}
              currentTenant={activeTenant}
            />
          )}

        </main>

        {/* COMPACT FOOTER */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>PremieRpet · Sistema de Governança de Materiais & Almoxarifado Industrial</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Integrado ao TOTVS Protheus · Plantas Dourado/SP e Porto Amazonas/PR
            </div>
          </div>
        </footer>

      </div>

      {/* PDM BUILDER MODAL */}
      <PDMBuilderModal
        isOpen={isPdmBuilderOpen}
        onClose={() => setIsPdmBuilderOpen(false)}
        currentUserRole={currentUserRole}
        currentTenant={activeTenant}
        existingItems={pdmItems}
        onSaveItem={handleSavePdmItem}
        pdmLevels={pdmLevels}
      />

      {/* ADD TO STOCK MODAL */}
      <AddToStockModal
        isOpen={!!addToStockPdmItem}
        onClose={() => setAddToStockPdmItem(null)}
        pdmItem={addToStockPdmItem}
        currentTenant={activeTenant}
        onConfirmAdd={handleConfirmAddToStock}
      />

      {/* ITEM DETAIL SPEC MODAL */}
      <ItemDetailModal
        isOpen={!!selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        item={activeDetailItem}
        tenantStock={
          activeDetailItem
            ? tenantStocks.find(
                (s) => s.tenantId === activeTenant.id && s.pdmItemId === activeDetailItem.id
              )
            : null
        }
        currentTenant={activeTenant}
        currentUserRole={currentUserRole}
        onAddToStock={(pdmItem) => setAddToStockPdmItem(pdmItem)}
        onOpenEdit={(pdmItem) => {
          setSelectedDetailItem(null);
          setEditingItem(pdmItem);
          setIsEditModalOpen(true);
        }}
        onRequestIntegration={handleRequestIntegration}
        onRequestInactivation={handleRequestInactivation}
      />

      {/* ITEM EDIT / CLASSIFICATION SANEAMENTO MODAL */}
      <ItemEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        niveis={pdmLevels}
        currentTenant={activeTenant}
        currentUserRole={currentUserRole}
        onSubmitChange={handleSubmitItemChange}
      />

    </div>
  );
}
