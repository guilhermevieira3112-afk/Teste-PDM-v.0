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
  CheckCircle2,
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
  EstabelecimentoStockData,
  TotvsFamilyCode,
  DEFAULT_ENABLED_TOTVS_FAMILIES,
  isItemInEnabledFamilies,
  GovernanceRequestState
} from './types/pdm';
import { TENANTS } from './data/taxonomy';
import { INITIAL_PDM_ITEMS, INITIAL_TENANT_STOCKS, INITIAL_MOVEMENTS } from './data/mockData';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CatalogView } from './components/pdm/CatalogView';
import { GovernanceView, GovernanceDemandTarget } from './components/governance/GovernanceView';
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
import { WmsParseResult } from './utils/wmsCsvParser';

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
    enabledFamilies: delta.enabledFamilies,
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
  const [currentTab, setCurrentTab] = useState<'catalog' | 'pdm-classification' | 'governance' | 'inventory' | 'abc' | 'totvs-import' | 'user-control' | 'pdm-fields'>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      if (stored) {
        const parsed: UserAccount = JSON.parse(stored);
        if (parsed.role === 'MANUTENCAO_PRODUCAO') return 'catalog';
      }
    } catch {
      // fallback
    }
    return 'inventory';
  });

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

  // Global TOTVS Enabled Families State (5040, 5060, 5070; 5050 disabled)
  const [enabledFamilies, setEnabledFamilies] = useState<TotvsFamilyCode[]>(() => {
    try {
      const stored = localStorage.getItem('premierpet_enabled_families');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (f): f is TotvsFamilyCode => f === '5040' || f === '5060' || f === '5070'
          );
          if (valid.length > 0) return valid;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_ENABLED_TOTVS_FAMILIES;
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
  const [tenantStocks, setTenantStocks] = useState<TenantStockItem[]>(() =>
    INITIAL_TENANT_STOCKS.map((stock) =>
      stock.storageLocation === 'Almox Central Dourado / Setor A' || !stock.storageLocation
        ? { ...stock, storageLocation: 'Não consta' }
        : stock
    )
  );
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
  const [autoOpenGovernanceItemId, setAutoOpenGovernanceItemId] = useState<string | null>(null);
  const [inventoryInitialViewMode, setInventoryInitialViewMode] = useState<'unit' | 'audit' | undefined>(undefined);
  const [wmsSyncLabels, setWmsSyncLabels] = useState<{
    'dourado-sp'?: string;
    'porto-amazonas-pr'?: string;
  }>({});

  // Live synced account reflecting edits in UserControlView (permissions, tier, etc.)
  const liveCurrentUserAccount = useMemo(() => {
    if (!currentUserAccount) return null;
    return users.find((u) => u.id === currentUserAccount.id) || currentUserAccount;
  }, [users, currentUserAccount]);

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

  const handleToggleFamily = (family: TotvsFamilyCode) => {
    setEnabledFamilies((prev) => {
      const exists = prev.includes(family);
      if (exists && prev.length === 1) {
        showToast('Mantenha pelo menos uma família TOTVS habilitada para consulta.');
        return prev;
      }
      const next = exists
        ? prev.filter((f) => f !== family)
        : (['5040', '5060', '5070'] as TotvsFamilyCode[]).filter((f) => f === family || prev.includes(f));
      try {
        localStorage.setItem('premierpet_enabled_families', JSON.stringify(next));
      } catch {
        // ignore
      }
      showToast(
        exists
          ? `Família ${family} ocultada das consultas da plataforma.`
          : `Família ${family} habilitada para consulta nos ambientes.`
      );
      return next;
    });
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

  // Guard: Restrict Carga & Auditoria TOTVS, Controle de Usuários, Edição de campos PDM, Almoxarifado Industrial & Curva ABC (Manutenção/Produção) and Governance queue access
  useEffect(() => {
    const fallbackTab = currentUserRole === 'MANUTENCAO_PRODUCAO' ? 'catalog' : 'inventory';
    if (currentUserRole !== 'MASTER_ADMIN' && (currentTab === 'totvs-import' || currentTab === 'user-control' || currentTab === 'pdm-fields')) {
      setCurrentTab(fallbackTab);
    }
    if (currentUserRole === 'MANUTENCAO_PRODUCAO' && (currentTab === 'inventory' || currentTab === 'abc')) {
      setCurrentTab('catalog');
    }
    const canSeeGovernance =
      currentUserRole === 'MASTER_ADMIN' ||
      (liveCurrentUserAccount?.governanceQueueAccess && liveCurrentUserAccount.governanceQueueAccess !== 'NONE') ||
      Boolean(liveCurrentUserAccount?.approvalTier);
    if (!canSeeGovernance && currentTab === 'governance') {
      setCurrentTab(fallbackTab);
    }
  }, [currentUserRole, currentTab, liveCurrentUserAccount]);

  // Filtered catalog & stock according to enabled TOTVS families (5040/5060/5070; 5050 hidden)
  const familyFilteredPdmItems = useMemo(() => {
    return pdmItems.filter((item) => isItemInEnabledFamilies(item, enabledFamilies));
  }, [pdmItems, enabledFamilies]);

  const familyFilteredItemIds = useMemo(() => {
    return new Set(familyFilteredPdmItems.map((i) => i.id));
  }, [familyFilteredPdmItems]);

  const familyFilteredStocks = useMemo(() => {
    return tenantStocks.filter((s) => familyFilteredItemIds.has(s.pdmItemId));
  }, [tenantStocks, familyFilteredItemIds]);

  // Counts for Badges (all 4 Governance Queue tabs)
  const pendingGovCount = useMemo(() => {
    const newPending = familyFilteredPdmItems.filter(
      (i) => i.status === 'PENDING_REVIEW' || i.status === 'FLAGGED_DUPLICATE'
    ).length;
    const altPending = familyFilteredPdmItems.filter((i) => i.pendingChange !== undefined).length;
    const integPending = familyFilteredPdmItems.reduce(
      (acc, i) => acc + (i.integrationRequests || []).filter((r) => r.status === 'PENDING').length,
      0
    );
    const inactPending = familyFilteredPdmItems.filter(
      (i) => i.inactivationRequest?.status === 'PENDING'
    ).length;
    return newPending + altPending + integPending + inactPending;
  }, [familyFilteredPdmItems]);

  const pendingUsersCount = useMemo(() => {
    return users.filter((u) => u.status === 'PENDING_APPROVAL').length;
  }, [users]);

  const lowStockCount = useMemo(() => {
    return familyFilteredStocks.filter(
      (s) => s.tenantId === currentTenantId && s.currentStock <= s.minimumStock
    ).length;
  }, [familyFilteredStocks, currentTenantId]);

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

    if (Array.isArray(remoteState.enabledFamilies) && remoteState.enabledFamilies.length > 0) {
      const validFams = remoteState.enabledFamilies.filter(
        (f): f is TotvsFamilyCode => f === '5040' || f === '5060' || f === '5070'
      );
      if (validFams.length > 0) {
        setEnabledFamilies(validFams);
        try {
          localStorage.setItem('premierpet_enabled_families', JSON.stringify(validFams));
        } catch {
          // ignore
        }
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
          enabledFamilies,
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
      enabledFamilies,
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
  }, [users, global2FARequired, enabledFamilies, pdmLevels, pdmItems, movements, currentUserAccount?.name]);

  const handleManualSharePointSync = async () => {
    const currentDelta = extractSiteGovernanceDelta({
      users,
      global2FARequired,
      enabledFamilies,
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

  const createDefaultWorkflowState = (): GovernanceRequestState => ({
    stage: 'TIER_REVIEW',
    requiredTiers: [1],
    currentPendingTier: 1,
    steps: [
      {
        tier: 1,
        tierLabel: 'Aprovador Nível 1 (Alçada Técnica / Governança)',
        status: 'PENDING',
      },
    ],
  });

  const advanceTierWorkflowState = (
    state: GovernanceRequestState,
    tier: ApprovalTierLevel,
    approverName: string,
    now: string
  ): { nextState: GovernanceRequestState; allTiersApproved: boolean; nextTier: ApprovalTierLevel | null } => {
    const updatedSteps = state.steps.map((st) =>
      st.tier === tier
        ? { ...st, status: 'APPROVED' as const, approvedByUser: approverName, approvedAt: now }
        : st
    );
    const remainingTiers = state.requiredTiers.filter((t) => {
      const found = updatedSteps.find((s) => s.tier === t);
      return found?.status !== 'APPROVED';
    });

    if (remainingTiers.length === 0) {
      return {
        allTiersApproved: true,
        nextTier: null,
        nextState: {
          ...state,
          steps: updatedSteps,
          currentPendingTier: null,
          stage: 'RETURNED_TO_UNIT_MASTER',
          returnFeedback: undefined,
        },
      };
    }

    const nextTier = Math.min(...remainingTiers) as ApprovalTierLevel;
    const stepsWithNext = updatedSteps.map((st) =>
      st.tier === nextTier ? { ...st, status: 'PENDING' as const } : st
    );

    return {
      allTiersApproved: false,
      nextTier,
      nextState: {
        ...state,
        steps: stepsWithNext,
        currentPendingTier: nextTier,
        stage: 'TIER_REVIEW',
        returnFeedback: undefined,
      },
    };
  };

  // 1. Save new PDM item from Builder
  const handleSavePdmItem = (itemData: Partial<PDMItem>) => {
    const nextSeq = pdmItems.length + 1;
    const familyPrefix = itemData.totvsFamily || '5040';
    const requestCode = `PDM-REQ-2026-${String(nextSeq + 10).padStart(3, '0')}`;
    const isMasterCreator = currentUserRole === 'MASTER_ADMIN';

    const newItem: PDMItem = {
      id: `pdm-${Date.now()}`,
      pdmCode: requestCode,
      totvsCode: requestCode,
      totvsFamily: familyPrefix,
      unitOfMeasure: itemData.unitOfMeasure || 'UN',
      totvsPlant: itemData.totvsPlant || (currentTenantId === 'dourado-sp' ? 'Dourado' : 'Paraná'),
      situation: 'Ativo',
      originalDescription: itemData.shortDescription || 'ITEM SOLICITADO VIA PDM BUILDER',
      baseValue: itemData.baseValue || 120.00,
      groupId: itemData.groupId || 'grp-mecanica',
      subgroupId: itemData.subgroupId || 'sub-rolamentos',
      specificSubgroupId: itemData.specificSubgroupId || 'spec-rol-esfera',
      nivel1: itemData.nivel1,
      nivel2: itemData.nivel2,
      nivel3: itemData.nivel3,
      shortDescription: itemData.shortDescription || 'ITEM PADRONIZADO',
      longDescription: itemData.longDescription || 'DESCRIÇÃO TÉCNICA DETALHADA PREMIERPET.',
      narrative: itemData.narrative || itemData.longDescription || itemData.shortDescription,
      attributes: itemData.attributes || {},
      ncm: itemData.ncm || '8482.10.10',
      unspsc: '',
      genericImage: itemData.genericImage,
      status: itemData.status === 'FLAGGED_DUPLICATE' ? 'FLAGGED_DUPLICATE' : 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      requestedByTenantId: itemData.requestedByTenantId || activeTenant.id,
      requestedByTenantName: itemData.requestedByTenantName || activeTenant.name,
      requestedByUser: itemData.requestedByUser || liveCurrentUserAccount?.name || 'Solicitante',
      notes: itemData.notes,
      duplicateOfId: itemData.duplicateOfId,
      similarityScore: itemData.similarityScore,
      leadTimeDays: itemData.leadTimeDays,
      orderPoint: itemData.orderPoint,
      safetyStockWarehouse: itemData.safetyStockWarehouse,
      establishments: itemData.establishments,
      quotation: itemData.quotation,
      approvalWorkflow: itemData.approvalWorkflow,
      changeHistory: itemData.changeHistory,
    };

    setPdmItems((prev) => [newItem, ...prev]);

    if (isMasterCreator) {
      setCurrentTab('governance');
      setAutoOpenGovernanceItemId(newItem.id);
      showToast('Cadastro preparado! Informe o Código TOTVS gerado no ERP para homologar no Catálogo Mestre.');
    } else {
      setCurrentTab('governance');
      showToast(`Solicitação ${newItem.pdmCode} enviada para a Fila de Governança!`);
    }
  };

  // 2. Unified Stage 1 Approval (Tier Nível 1 / 2 / 3 -> returns to Unit Master when all tiers complete)
  const handleApproveTierStep = (target: GovernanceDemandTarget, tier: ApprovalTierLevel) => {
    const now = new Date().toISOString();
    const approverName = liveCurrentUserAccount?.name || 'Aprovador Alçada';
    let becameReadyForMaster = false;
    let nextPending: ApprovalTierLevel | null = null;

    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id !== target.itemId) return item;
        const history = item.changeHistory || [];

        if (target.kind === 'NEW_ITEM') {
          const baseState: GovernanceRequestState = item.approvalWorkflow
            ? {
                stage: item.approvalWorkflow.stage || 'TIER_REVIEW',
                requiredTiers: item.approvalWorkflow.requiredTiers,
                currentPendingTier: item.approvalWorkflow.currentPendingTier,
                steps: item.approvalWorkflow.steps,
                delegation: item.approvalWorkflow.delegation,
                returnFeedback: item.approvalWorkflow.returnFeedback,
                erpExecution: item.approvalWorkflow.erpExecution,
              }
            : createDefaultWorkflowState();

          const { nextState, allTiersApproved, nextTier } = advanceTierWorkflowState(
            baseState,
            tier,
            approverName,
            now
          );
          becameReadyForMaster = allTiersApproved;
          nextPending = nextTier;

          return {
            ...item,
            status: 'PENDING_REVIEW',
            approvalWorkflow: {
              requiredTiers: nextState.requiredTiers,
              currentPendingTier: nextState.currentPendingTier,
              estimatedValue: item.approvalWorkflow?.estimatedValue || item.baseValue || 0,
              steps: nextState.steps,
              isFullyApproved: false,
              stage: nextState.stage,
              delegation: nextState.delegation,
              returnFeedback: undefined,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: allTiersApproved
                  ? `Alçada Nível ${tier} Aprovada · Retornou ao Master da Unidade`
                  : `Alçada Nível ${tier} Aprovada · Encaminhado para Nível ${nextTier}`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: approverName,
                approvedAt: now,
                approvalTier: tier,
                status: 'APPROVED',
                reason: allTiersApproved
                  ? 'Todas as alçadas aprovaram. Demanda retornou ao Master Admin da unidade para designar responsável de edição/TOTVS.'
                  : `Aprovado pelo Nível ${tier}. Aguardando alçada Nível ${nextTier}.`,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'ALTERATION' && item.pendingChange) {
          const baseState = item.pendingChange.workflowState || createDefaultWorkflowState();
          const { nextState, allTiersApproved, nextTier } = advanceTierWorkflowState(
            baseState,
            tier,
            approverName,
            now
          );
          becameReadyForMaster = allTiersApproved;
          nextPending = nextTier;

          return {
            ...item,
            pendingChange: {
              ...item.pendingChange,
              workflowState: nextState,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: allTiersApproved
                  ? `Alteração Aprovada na Alçada · Retornou ao Master da Unidade`
                  : `Alçada Nível ${tier} Aprovada na Solicitação de Alteração`,
                requestedByUser: item.pendingChange.requestedByUser,
                approvedByUser: approverName,
                approvedAt: now,
                approvalTier: tier,
                status: 'APPROVED',
                reason: allTiersApproved
                  ? 'Aguardando designação de usuário com permissão de edição para confirmar execução no ERP.'
                  : `Aprovado pelo Nível ${tier}.`,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INTEGRATION') {
          return {
            ...item,
            integrationRequests: (item.integrationRequests || []).map((req) => {
              if (req.id !== target.requestId) return req;
              const baseState = req.workflowState || createDefaultWorkflowState();
              const { nextState, allTiersApproved, nextTier } = advanceTierWorkflowState(
                baseState,
                tier,
                approverName,
                now
              );
              becameReadyForMaster = allTiersApproved;
              nextPending = nextTier;
              return { ...req, workflowState: nextState };
            }),
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: `Alçada Nível ${tier} Aprovada (Integração Almoxarifado)`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: approverName,
                approvedAt: now,
                approvalTier: tier,
                status: 'APPROVED',
                reason: 'Etapa de alçada aprovada na solicitação de integração.',
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INACTIVATION' && item.inactivationRequest) {
          const baseState = item.inactivationRequest.workflowState || createDefaultWorkflowState();
          const { nextState, allTiersApproved, nextTier } = advanceTierWorkflowState(
            baseState,
            tier,
            approverName,
            now
          );
          becameReadyForMaster = allTiersApproved;
          nextPending = nextTier;

          return {
            ...item,
            inactivationRequest: {
              ...item.inactivationRequest,
              workflowState: nextState,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: `Alçada Nível ${tier} Aprovada (Inativação)`,
                requestedByUser: item.inactivationRequest.requestedByUser,
                approvedByUser: approverName,
                approvedAt: now,
                approvalTier: tier,
                status: 'APPROVED',
                reason: 'Etapa de alçada aprovada na solicitação de inativação.',
              },
              ...history,
            ],
          };
        }

        return item;
      })
    );

    if (becameReadyForMaster) {
      showToast(`Alçada Nível ${tier} aprovada! Solicitação retornou ao Master Admin da unidade para designação.`);
    } else if (nextPending) {
      showToast(`Alçada Nível ${tier} aprovada! Encaminhado para Alçada Nível ${nextPending}.`);
    } else {
      showToast(`Alçada Nível ${tier} aprovada com sucesso!`);
    }
  };

  // 3. Unified Return / Reprove Step (keeps demand PENDING in queue with return reason)
  const handleReturnStep = (target: GovernanceDemandTarget, reason: string) => {
    const now = new Date().toISOString();
    const actorName = liveCurrentUserAccount?.name || 'Aprovador / Governança';

    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id !== target.itemId) return item;
        const history = item.changeHistory || [];

        if (target.kind === 'NEW_ITEM') {
          const currentWf = item.approvalWorkflow;
          const tier = currentWf?.currentPendingTier || 1;
          const stage = currentWf?.stage || 'TIER_REVIEW';

          return {
            ...item,
            status: item.status === 'FLAGGED_DUPLICATE' ? 'FLAGGED_DUPLICATE' : 'PENDING_REVIEW',
            approvalWorkflow: currentWf
              ? {
                  ...currentWf,
                  returnFeedback: {
                    returnedBy: actorName,
                    returnedAt: now,
                    stage,
                    tier,
                    reason,
                  },
                }
              : {
                  ...createDefaultWorkflowState(),
                  estimatedValue: item.baseValue || 0,
                  isFullyApproved: false,
                  returnFeedback: {
                    returnedBy: actorName,
                    returnedAt: now,
                    stage: 'TIER_REVIEW',
                    tier: 1,
                    reason,
                  },
                },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'REJECTED',
                actionLabel: 'Solicitação Devolvida para Revisão (Pendente)',
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: actorName,
                approvedAt: now,
                status: 'PENDING',
                rejectionReason: reason,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'ALTERATION' && item.pendingChange) {
          const baseState = item.pendingChange.workflowState || createDefaultWorkflowState();
          return {
            ...item,
            pendingChange: {
              ...item.pendingChange,
              workflowState: {
                ...baseState,
                returnFeedback: {
                  returnedBy: actorName,
                  returnedAt: now,
                  stage: baseState.stage,
                  tier: baseState.currentPendingTier || undefined,
                  reason,
                },
              },
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'REJECTED',
                actionLabel: 'Alteração Devolvida para Revisão (Pendente)',
                requestedByUser: item.pendingChange.requestedByUser,
                approvedByUser: actorName,
                approvedAt: now,
                status: 'PENDING',
                rejectionReason: reason,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INTEGRATION') {
          return {
            ...item,
            integrationRequests: (item.integrationRequests || []).map((req) => {
              if (req.id !== target.requestId) return req;
              const baseState = req.workflowState || createDefaultWorkflowState();
              return {
                ...req,
                workflowState: {
                  ...baseState,
                  returnFeedback: {
                    returnedBy: actorName,
                    returnedAt: now,
                    stage: baseState.stage,
                    tier: baseState.currentPendingTier || undefined,
                    reason,
                  },
                },
              };
            }),
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'REJECTED',
                actionLabel: 'Integração Devolvida para Revisão (Pendente)',
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: actorName,
                approvedAt: now,
                status: 'PENDING',
                rejectionReason: reason,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INACTIVATION' && item.inactivationRequest) {
          const baseState = item.inactivationRequest.workflowState || createDefaultWorkflowState();
          return {
            ...item,
            inactivationRequest: {
              ...item.inactivationRequest,
              workflowState: {
                ...baseState,
                returnFeedback: {
                  returnedBy: actorName,
                  returnedAt: now,
                  stage: baseState.stage,
                  tier: baseState.currentPendingTier || undefined,
                  reason,
                },
              },
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'REJECTED',
                actionLabel: 'Inativação Devolvida para Revisão (Pendente)',
                requestedByUser: item.inactivationRequest.requestedByUser,
                approvedByUser: actorName,
                approvedAt: now,
                status: 'PENDING',
                rejectionReason: reason,
              },
              ...history,
            ],
          };
        }

        return item;
      })
    );

    showToast('Solicitação devolvida com justificativa e mantida pendente na fila para revisão.');
  };

  // 4. Unified Stage 2 Delegation (Unit Master Admin designates an active EDIT user)
  const handleDelegateToEditor = (
    target: GovernanceDemandTarget,
    assignee: UserAccount,
    notes?: string
  ) => {
    const now = new Date().toISOString();
    const delegatorName = liveCurrentUserAccount?.name || 'Master Admin';
    const delegation = {
      assignedUserId: assignee.id,
      assignedUserName: assignee.name,
      assignedUsername: assignee.username,
      assignedByUser: delegatorName,
      assignedAt: now,
      unitTenantId: assignee.tenantId,
      unitTenantName: assignee.tenantName,
      notes,
    };

    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id !== target.itemId) return item;
        const history = item.changeHistory || [];

        if (target.kind === 'NEW_ITEM') {
          const baseState = item.approvalWorkflow || {
            ...createDefaultWorkflowState(),
            estimatedValue: item.baseValue || 0,
            isFullyApproved: false,
          };
          return {
            ...item,
            approvalWorkflow: {
              ...baseState,
              currentPendingTier: null,
              stage: 'DELEGATED_TO_ERP_EDITOR',
              delegation,
              returnFeedback: undefined,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'EDITED',
                actionLabel: `Designado para ${assignee.name} inserir Código TOTVS`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: delegatorName,
                approvedAt: now,
                status: 'PENDING',
                reason: notes || `Demanda direcionada para ${assignee.name} (${assignee.tenantName}).`,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'ALTERATION' && item.pendingChange) {
          const baseState = item.pendingChange.workflowState || createDefaultWorkflowState();
          return {
            ...item,
            pendingChange: {
              ...item.pendingChange,
              workflowState: {
                ...baseState,
                currentPendingTier: null,
                stage: 'DELEGATED_TO_ERP_EDITOR',
                delegation,
                returnFeedback: undefined,
              },
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'EDITED',
                actionLabel: `Alteração Designada para ${assignee.name} (Execução ERP)`,
                requestedByUser: item.pendingChange.requestedByUser,
                approvedByUser: delegatorName,
                approvedAt: now,
                status: 'PENDING',
                reason: notes || `Direcionado para ${assignee.name}.`,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INTEGRATION') {
          return {
            ...item,
            integrationRequests: (item.integrationRequests || []).map((req) => {
              if (req.id !== target.requestId) return req;
              const baseState = req.workflowState || createDefaultWorkflowState();
              return {
                ...req,
                workflowState: {
                  ...baseState,
                  currentPendingTier: null,
                  stage: 'DELEGATED_TO_ERP_EDITOR',
                  delegation,
                  returnFeedback: undefined,
                },
              };
            }),
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'INTEGRATED',
                actionLabel: `Integração Designada para ${assignee.name} (Execução ERP)`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: delegatorName,
                approvedAt: now,
                status: 'PENDING',
                reason: notes || `Direcionado para ${assignee.name}.`,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INACTIVATION' && item.inactivationRequest) {
          const baseState = item.inactivationRequest.workflowState || createDefaultWorkflowState();
          return {
            ...item,
            inactivationRequest: {
              ...item.inactivationRequest,
              workflowState: {
                ...baseState,
                currentPendingTier: null,
                stage: 'DELEGATED_TO_ERP_EDITOR',
                delegation,
                returnFeedback: undefined,
              },
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'INACTIVATED',
                actionLabel: `Inativação Designada para ${assignee.name} (Execução ERP)`,
                requestedByUser: item.inactivationRequest.requestedByUser,
                approvedByUser: delegatorName,
                approvedAt: now,
                status: 'PENDING',
                reason: notes || `Direcionado para ${assignee.name}.`,
              },
              ...history,
            ],
          };
        }

        return item;
      })
    );

    showToast(`Demanda designada para ${assignee.name} executar no TOTVS / inserir código oficial.`);
  };

  // 5. Unified Stage 3 Finalization (EDIT user / Master Admin enters TOTVS code or confirms ERP update)
  const handleFinalizeErpExecution = (
    target: GovernanceDemandTarget,
    payload: { totvsCode?: string; erpProtocol?: string; notes?: string }
  ) => {
    const now = new Date().toISOString();
    const executorName = liveCurrentUserAccount?.name || 'Usuário Governança';
    const erpExecution = {
      totvsCodeEntered: payload.totvsCode,
      erpProtocol: payload.erpProtocol,
      executedBy: executorName,
      executedAt: now,
      notes: payload.notes,
    };

    let createdStockItem: PDMItem | null = null;
    let integrationReqApproved: ItemIntegrationRequest | undefined;
    let integrationTargetItem: PDMItem | undefined;

    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id !== target.itemId) return item;
        const history = item.changeHistory || [];

        if (target.kind === 'NEW_ITEM') {
          const officialTotvsCode = (payload.totvsCode || item.totvsCode || item.pdmCode).trim().toUpperCase();
          const updatedItem: PDMItem = {
            ...item,
            totvsCode: officialTotvsCode,
            pdmCode: officialTotvsCode,
            status: 'APPROVED',
            approvalWorkflow: {
              requiredTiers: item.approvalWorkflow?.requiredTiers || [1],
              currentPendingTier: null,
              estimatedValue: item.approvalWorkflow?.estimatedValue || item.baseValue || 0,
              steps: item.approvalWorkflow?.steps || [],
              isFullyApproved: true,
              stage: 'COMPLETED',
              delegation: item.approvalWorkflow?.delegation,
              erpExecution,
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: `Código TOTVS ${officialTotvsCode} Gravado · Item Homologado`,
                requestedByUser: item.requestedByUser || 'Solicitante',
                approvedByUser: executorName,
                approvedAt: now,
                status: 'APPROVED',
                reason:
                  payload.notes ||
                  `Item homologado e publicado no Catálogo Mestre com o Código TOTVS ${officialTotvsCode}.`,
              },
              ...history,
            ],
          };
          createdStockItem = updatedItem;
          return updatedItem;
        }

        if (target.kind === 'ALTERATION' && item.pendingChange) {
          const pending = item.pendingChange;
          return {
            ...item,
            ...pending.proposedValues,
            isClassified: true,
            classificationOrigin: 'PDM_HOMOLOGADO',
            pendingChange: undefined,
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'APPROVED',
                actionLabel: 'Alteração Executada no ERP TOTVS e Homologada',
                requestedByUser: pending.requestedByUser,
                requestedByTenantName: pending.requestedByTenantName,
                approvedByUser: executorName,
                approvedAt: now,
                status: 'APPROVED',
                reason: `${pending.reason}${payload.erpProtocol ? ` (Protocolo ERP: ${payload.erpProtocol})` : ''}${payload.notes ? ` · ${payload.notes}` : ''}`,
                changes: pending.changes,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INTEGRATION') {
          integrationTargetItem = item;
          const updatedInteg = (item.integrationRequests || []).map((req) => {
            if (req.id !== target.requestId) return req;
            integrationReqApproved = req;
            const baseState = req.workflowState || createDefaultWorkflowState();
            return {
              ...req,
              status: 'APPROVED' as const,
              reviewedBy: executorName,
              reviewedAt: now,
              workflowState: {
                ...baseState,
                stage: 'COMPLETED' as const,
                currentPendingTier: null,
                erpExecution,
              },
            };
          });

          const targetPlant = integrationReqApproved?.targetPlant || '14';
          const currentEstab = item.establishments || {};
          const newEstabData: EstabelecimentoStockData = {
            estabelecimento: targetPlant,
            plantaNome: targetPlant === '10' ? 'Dourado/SP' : 'Porto Amazonas/PR',
            saldoEstoque: currentEstab[targetPlant]?.saldoEstoque || 0,
            pontoEncomenda: integrationReqApproved?.requestedOrderPoint || 2,
            estoqueSegurancaAlmoxarifado: integrationReqApproved?.requestedSafetyStock || 5,
            tempoRessuprimento: 15,
            ultimaEntrada: now.split('T')[0],
          };

          return {
            ...item,
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
                actionLabel: `Integração Executada no ERP · Estabelecimento ${targetPlant}`,
                requestedByUser: integrationReqApproved?.requestedByUser || 'Solicitante',
                approvedByUser: executorName,
                approvedAt: now,
                status: 'APPROVED',
                reason: `Integração concluída no TOTVS (Estab. ${targetPlant}). Estoque segurança: ${integrationReqApproved?.requestedSafetyStock} ${item.unitOfMeasure || 'UN'}.${payload.erpProtocol ? ` Protocolo: ${payload.erpProtocol}` : ''}`,
              },
              ...history,
            ],
          };
        }

        if (target.kind === 'INACTIVATION' && item.inactivationRequest) {
          const inact = item.inactivationRequest;
          const baseState = inact.workflowState || createDefaultWorkflowState();
          return {
            ...item,
            situation: 'Totalmente Obsoleto',
            inactivationRequest: {
              ...inact,
              status: 'APPROVED',
              reviewedBy: executorName,
              reviewedAt: now,
              workflowState: {
                ...baseState,
                stage: 'COMPLETED',
                currentPendingTier: null,
                erpExecution,
              },
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'INACTIVATED',
                actionLabel: 'Inativação Executada no ERP TOTVS (Totalmente Obsoleto)',
                requestedByUser: inact.requestedByUser,
                approvedByUser: executorName,
                approvedAt: now,
                status: 'APPROVED',
                reason: `${inact.reason}${payload.erpProtocol ? ` (Protocolo ERP: ${payload.erpProtocol})` : ''}`,
              },
              ...history,
            ],
          };
        }

        return item;
      })
    );

    // Sync tenantStocks after finalizing
    if (target.kind === 'NEW_ITEM' && createdStockItem) {
      const finalized: PDMItem = createdStockItem;
      const estab10 = finalized.establishments?.['10'];
      const estab14 = finalized.establishments?.['14'];
      const newStocksToAdd: TenantStockItem[] = [];

      if (estab10) {
        newStocksToAdd.push({
          id: `stk-dou-${Date.now()}`,
          tenantId: 'dourado-sp',
          pdmItemId: finalized.id,
          internalCode: `DOU-${finalized.totvsCode}`,
          currentStock: estab10.saldoEstoque || 0,
          minimumStock: estab10.pontoEncomenda || 1,
          safetyStock: estab10.estoqueSegurancaAlmoxarifado || 1,
          safetyStockWarehouse: estab10.estoqueSegurancaAlmoxarifado || 1,
          orderPoint: estab10.pontoEncomenda || 1,
          maxStock: Math.max(10, (estab10.pontoEncomenda || 1) * 3),
          unitCost: finalized.baseValue || 45.0,
          storageLocation: 'Não consta',
          criticism: 'E',
          leadTimeDays: estab10.tempoRessuprimento || 15,
          lastInventoryDate: now.split('T')[0],
          status: 'ACTIVE',
        });
      }
      if (estab14) {
        newStocksToAdd.push({
          id: `stk-pam-${Date.now() + 1}`,
          tenantId: 'porto-amazonas-pr',
          pdmItemId: finalized.id,
          internalCode: `PAM-${finalized.totvsCode}`,
          currentStock: estab14.saldoEstoque || 0,
          minimumStock: estab14.pontoEncomenda || 1,
          safetyStock: estab14.estoqueSegurancaAlmoxarifado || 1,
          safetyStockWarehouse: estab14.estoqueSegurancaAlmoxarifado || 1,
          orderPoint: estab14.pontoEncomenda || 1,
          maxStock: Math.max(10, (estab14.pontoEncomenda || 1) * 3),
          unitCost: finalized.baseValue || 45.0,
          storageLocation: 'Almox Industrial Paraná / Bloco P',
          criticism: 'E',
          leadTimeDays: estab14.tempoRessuprimento || 15,
          lastInventoryDate: now.split('T')[0],
          status: 'ACTIVE',
        });
      }

      if (newStocksToAdd.length > 0) {
        setTenantStocks((prev) => {
          const filtered = newStocksToAdd.filter(
            (ns) => !prev.some((p) => p.tenantId === ns.tenantId && p.pdmItemId === ns.pdmItemId)
          );
          return [...filtered, ...prev];
        });
      }
      showToast(`Item ${finalized.totvsCode} homologado e publicado no Catálogo Mestre TOTVS!`);
    } else if (target.kind === 'ALTERATION') {
      showToast('Alteração cadastral confirmada no ERP e propagada para todos os ambientes!');
    } else if (target.kind === 'INTEGRATION') {
      if (integrationReqApproved && integrationTargetItem) {
        const reqSnapshot = integrationReqApproved;
        const itemSnapshot = integrationTargetItem;
        const targetTenantId = reqSnapshot.targetPlant === '10' ? 'dourado-sp' : 'porto-amazonas-pr';
        setTenantStocks((prev) => {
          const existing = prev.find((s) => s.tenantId === targetTenantId && s.pdmItemId === target.itemId);
          if (existing) {
            return prev.map((s) =>
              s.id === existing.id
                ? {
                    ...s,
                    safetyStock: reqSnapshot.requestedSafetyStock,
                    safetyStockWarehouse: reqSnapshot.requestedSafetyStock,
                    minimumStock: reqSnapshot.requestedOrderPoint || s.minimumStock,
                    orderPoint: reqSnapshot.requestedOrderPoint || s.orderPoint,
                    status: 'ACTIVE',
                  }
                : s
            );
          }
          const newStock: TenantStockItem = {
            id: `stk-${targetTenantId}-${Date.now()}`,
            tenantId: targetTenantId,
            pdmItemId: target.itemId,
            internalCode: `${targetTenantId === 'dourado-sp' ? 'DOU' : 'PAM'}-${itemSnapshot.totvsCode || itemSnapshot.pdmCode}`,
            currentStock: 0,
            totvsStock: 0,
            wmsStock: 0,
            minimumStock: reqSnapshot.requestedOrderPoint || 2,
            safetyStock: reqSnapshot.requestedSafetyStock,
            safetyStockWarehouse: reqSnapshot.requestedSafetyStock,
            orderPoint: reqSnapshot.requestedOrderPoint || 2,
            maxStock: reqSnapshot.requestedSafetyStock * 3,
            unitCost: itemSnapshot.baseValue || 45.0,
            storageLocation: targetTenantId === 'dourado-sp' ? 'Não consta' : 'Almox Industrial Paraná / Bloco P',
            criticism: 'E',
            leadTimeDays: 15,
            lastInventoryDate: now.split('T')[0],
            status: 'ACTIVE',
          };
          return [newStock, ...prev];
        });
      }
      showToast('Integração de almoxarifado confirmada no ERP TOTVS e parametrizada!');
    } else if (target.kind === 'INACTIVATION') {
      setTenantStocks((prev) =>
        prev.map((s) => (s.pdmItemId === target.itemId ? { ...s, status: 'INACTIVE' } : s))
      );
      showToast('Inativação executada no ERP TOTVS e status atualizado para Totalmente Obsoleto.');
    }
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
                requestedByUser: liveCurrentUserAccount?.name || 'Master Admin',
                requestedByTenantName: activeTenant.name,
                approvedByUser: liveCurrentUserAccount?.name || 'Master Admin',
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
              requestedByUser: liveCurrentUserAccount?.name || 'Usuário',
              requestedByTenantId: currentTenantId,
              requestedByTenantName: activeTenant.name,
              reason,
              changes: fieldChanges,
              proposedValues,
              workflowState: createDefaultWorkflowState(),
            },
            changeHistory: [
              {
                id: `chg-${Date.now()}`,
                timestamp: now,
                actionType: 'EDITED',
                actionLabel: 'Solicitação de Alteração Cadastral Submetida',
                requestedByUser: liveCurrentUserAccount?.name || 'Usuário',
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
      showToast('Solicitação de alteração enviada para a Fila de Governança!');
    }
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
      requestedByUser: liveCurrentUserAccount?.name || 'Usuário',
      requestedByTenantId: currentTenantId,
      requestedByTenantName: activeTenant.name,
      requestedAt: now,
      status: 'PENDING',
      workflowState: createDefaultWorkflowState(),
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
              requestedByUser: liveCurrentUserAccount?.name || 'Usuário',
              requestedByTenantName: activeTenant.name,
              status: 'PENDING',
              reason: `${data.reason} (Estoque seguro solicitado: ${data.requestedSafetyStock} ${item.unitOfMeasure || 'UN'})`,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de integração de almoxarifado enviada para a Fila de Governança!');
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
      requestedByUser: liveCurrentUserAccount?.name || 'Usuário',
      requestedByTenantId: currentTenantId,
      requestedByTenantName: activeTenant.name,
      requestedAt: now,
      status: 'PENDING',
      workflowState: createDefaultWorkflowState(),
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
              requestedByUser: liveCurrentUserAccount?.name || 'Usuário',
              requestedByTenantName: activeTenant.name,
              status: 'PENDING',
              reason: data.reason,
            },
            ...currentHistory,
          ],
        };
      })
    );
    showToast('Solicitação de inativação enviada para a Fila de Governança!');
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

  // 4.5 Apply real parsed CSV from Base 3 (Dourado) or Base 4 (Porto Amazonas) to tenantStocks
  const handleApplyWmsBase = (
    tenantId: 'dourado-sp' | 'porto-amazonas-pr',
    result: WmsParseResult
  ) => {
    const codeToPdm = new Map<string, PDMItem>();
    pdmItems.forEach((item) => {
      if (item.totvsCode) codeToPdm.set(item.totvsCode.trim().toUpperCase(), item);
      if (item.pdmCode) codeToPdm.set(item.pdmCode.trim().toUpperCase(), item);
    });

    const prefix = tenantId === 'dourado-sp' ? 'DOU-' : 'PAM-';

    setTenantStocks((prev) => {
      const seenPdmIds = new Set<string>();
      const updated = prev.map((stock) => {
        if (stock.tenantId !== tenantId) return stock;
        seenPdmIds.add(stock.pdmItemId);

        const pdm = pdmItems.find((p) => p.id === stock.pdmItemId);
        const candidates = [
          pdm?.totvsCode?.trim().toUpperCase(),
          pdm?.pdmCode?.trim().toUpperCase(),
          stock.internalCode.replace(/^(DOU|PAM)-/i, '').trim().toUpperCase(),
        ].filter(Boolean) as string[];

        let matchedEntry = undefined as ReturnType<typeof result.entriesByCode.get>;
        for (const c of candidates) {
          const found = result.entriesByCode.get(c);
          if (found) {
            matchedEntry = found;
            break;
          }
        }

        if (!matchedEntry) return stock;

        const totvsQty = stock.totvsStock ?? stock.currentStock ?? 0;
        return {
          ...stock,
          wmsStock: matchedEntry.wmsStock,
          wmsAddress: matchedEntry.wmsAddress || stock.wmsAddress,
          wmsAddresses:
            matchedEntry.wmsAddresses.length > 0 ? matchedEntry.wmsAddresses : stock.wmsAddresses,
          storageLocation: matchedEntry.wmsAddress || stock.storageLocation,
          divergence: Math.round((matchedEntry.wmsStock - totvsQty) * 100) / 100,
        };
      });

      // Add new TenantStockItem records for matched catalog items that didn't have a row yet
      const additions: TenantStockItem[] = [];
      const today = new Date().toISOString().split('T')[0];
      result.entriesByCode.forEach((entry, code) => {
        const pdm = codeToPdm.get(code);
        if (!pdm || seenPdmIds.has(pdm.id)) return;
        seenPdmIds.add(pdm.id);
        const estabKey = tenantId === 'dourado-sp' ? '10' : '14';
        const estab = pdm.establishments?.[estabKey];
        const totvsQty = estab?.saldoEstoque ?? 0;
        additions.push({
          id: `stk-wms-${tenantId}-${pdm.id}`,
          tenantId,
          pdmItemId: pdm.id,
          internalCode: `${prefix}${pdm.totvsCode || pdm.pdmCode}`,
          currentStock: totvsQty,
          totvsStock: totvsQty,
          wmsStock: entry.wmsStock,
          wmsAddress: entry.wmsAddress,
          wmsAddresses: entry.wmsAddresses,
          divergence: Math.round((entry.wmsStock - totvsQty) * 100) / 100,
          minimumStock: estab?.pontoEncomenda ?? 1,
          safetyStock: estab?.estoqueSegurancaAlmoxarifado ?? 1,
          safetyStockWarehouse: estab?.estoqueSegurancaAlmoxarifado ?? 1,
          orderPoint: estab?.pontoEncomenda ?? 1,
          maxStock: Math.max(10, (estab?.pontoEncomenda ?? 1) * 3),
          unitCost: pdm.baseValue || 45,
          storageLocation:
            entry.wmsAddress ||
            (tenantId === 'dourado-sp' ? 'Não consta' : 'Almox Industrial Paraná'),
          criticism: 'E',
          leadTimeDays: estab?.tempoRessuprimento ?? 15,
          lastInventoryDate: today,
          status: pdm.situation?.toLowerCase().includes('obsoleto') ? 'INACTIVE' : 'ACTIVE',
        });
      });

      return additions.length > 0 ? [...additions, ...updated] : updated;
    });

    const timeLabel = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setWmsSyncLabels((prev) => ({
      ...prev,
      [tenantId]: `${result.fileName} (${timeLabel})`,
    }));

    const unitLabel = tenantId === 'dourado-sp' ? 'Dourado (Base 3)' : 'Porto Amazonas (Base 4)';
    showToast(
      `WMS ${unitLabel} lido (${result.uniqueItemsCount.toLocaleString('pt-BR')} itens) e atualizado nas consultas!`
    );
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
    if (user.role === 'MANUTENCAO_PRODUCAO') {
      setCurrentTab('catalog');
    } else if (user.role === 'MASTER_ADMIN' && pendingUserControlRedirect) {
      setCurrentTab('user-control');
      setPendingUserControlRedirect(false);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // ignore
      }
    } else if (currentTab === 'catalog' || currentTab === 'inventory') {
      setCurrentTab('inventory');
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
  if (!liveCurrentUserAccount) {
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
        pendingUsersCount={pendingUsersCount}
        onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
        currentUserAccount={liveCurrentUserAccount}
        onLogout={handleLogout}
      />

      {/* 2. MAIN VIEWPORT AREA (OFFSET BY COLLAPSED SIDEBAR WIDTH) */}
      <div className="flex-1 flex flex-col pl-[76px] min-w-0">
        
        {/* TOP UNIFIED HEADER */}
        <Header
          currentTab={currentTab}
          currentTenant={activeTenant}
          userUnitName={liveCurrentUserAccount.tenantName}
        />

        {/* TOAST ALERT */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {/* MAIN BODY CONTAINER */}
        <main className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto space-y-6">

          {/* TAB 1: PDM CATALOG (GLOBAL TOTVS) */}
          {currentTab === 'catalog' && (
            <CatalogView
              items={familyFilteredPdmItems}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              tenantStocks={familyFilteredStocks}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
              onAddToStock={(pdmItem) => setAddToStockPdmItem(pdmItem)}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
            />
          )}
          
          {/* TAB 1.5: CONSULTA POR CLASSIFICAÇÃO PDM (TODOS OS USUÁRIOS) */}
          {currentTab === 'pdm-classification' && (
            <PdmClassificationQueryView
              items={familyFilteredPdmItems}
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
              items={familyFilteredPdmItems}
              users={users}
              currentUserId={liveCurrentUserAccount.id}
              currentUserRole={currentUserRole}
              currentUserTier={liveCurrentUserAccount.approvalTier || (currentUserRole === 'MASTER_ADMIN' ? 'ALL' : undefined)}
              currentUserName={liveCurrentUserAccount.name}
              currentUserAccess={
                currentUserRole === 'MASTER_ADMIN'
                  ? 'EDIT'
                  : liveCurrentUserAccount.governanceQueueAccess || 'VIEW'
              }
              currentTenant={activeTenant}
              autoOpenItemId={autoOpenGovernanceItemId}
              onClearAutoOpenItem={() => setAutoOpenGovernanceItemId(null)}
              onApproveTierStep={handleApproveTierStep}
              onReturnStep={handleReturnStep}
              onDelegateToEditor={handleDelegateToEditor}
              onFinalizeErpExecution={handleFinalizeErpExecution}
              onLinkDuplicate={handleLinkDuplicate}
            />
          )}

          {/* TAB 2.5: CARGA & AUDITORIA TOTVS (EXCLUSIVO MASTER ADMIN) */}
          {currentTab === 'totvs-import' && currentUserRole === 'MASTER_ADMIN' && (
            <TotvsImportView
              existingPdmItems={pdmItems}
              existingStocks={tenantStocks}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              enabledFamilies={enabledFamilies}
              onToggleFamily={handleToggleFamily}
              onApplyWmsBase={handleApplyWmsBase}
              onIntegrateItems={(newItems) => {
                setPdmItems((prev) => [...newItems, ...prev]);
                showToast(`${newItems.length} novos itens homologados e integrados ao Catálogo PDM!`);
              }}
              onIntegrateMergedBases={(mergedItems, mergedStocks) => {
                setPdmItems(mergedItems);
                if (mergedStocks && mergedStocks.length > 0) {
                  setTenantStocks(
                    mergedStocks.map((stock) =>
                      stock.storageLocation === 'Almox Central Dourado / Setor A' || !stock.storageLocation
                        ? { ...stock, storageLocation: 'Não consta' }
                        : stock
                    )
                  );
                }
                showToast(`Bases mescladas com sucesso! ${mergedItems.length.toLocaleString('pt-BR')} itens integrados aos ambientes Master, Dourado e Porto Amazonas.`);
              }}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
              onOpenInventoryAudit={() => {
                setInventoryInitialViewMode('audit');
                setCurrentTab('inventory');
              }}
            />
          )}

          {/* TAB 2.6: CONTROLE DE USUÁRIOS (EXCLUSIVO MASTER ADMIN) */}
          {currentTab === 'user-control' && currentUserRole === 'MASTER_ADMIN' && liveCurrentUserAccount && (
            <UserControlView
              users={users}
              onUpdateUsers={handleUpdateUsers}
              currentUser={liveCurrentUserAccount}
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
              catalogItems={familyFilteredPdmItems}
              onShowToast={showToast}
            />
          )}

          {/* TAB 3: LOCAL WAREHOUSE (TENANT - BLOQUEADO PARA MANUTENÇÃO/PRODUÇÃO) */}
          {currentTab === 'inventory' && currentUserRole !== 'MANUTENCAO_PRODUCAO' && (
            <InventoryView
              tenantStocks={familyFilteredStocks}
              pdmItems={familyFilteredPdmItems}
              movements={movements}
              currentTenant={activeTenant}
              currentUserRole={currentUserRole}
              wmsSyncLabels={wmsSyncLabels}
              initialViewMode={inventoryInitialViewMode}
              onClearInitialViewMode={() => setInventoryInitialViewMode(undefined)}
              onRegisterMovement={handleRegisterMovement}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
              onOpenCatalog={() => setCurrentTab('catalog')}
            />
          )}

          {/* TAB 4: INDUSTRIAL ABC CURVE (BLOQUEADO PARA MANUTENÇÃO/PRODUÇÃO) */}
          {currentTab === 'abc' && currentUserRole !== 'MANUTENCAO_PRODUCAO' && (
            <ABCCurveDashboard
              tenantStocks={familyFilteredStocks}
              movements={movements}
              pdmItems={familyFilteredPdmItems}
              currentTenant={activeTenant}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
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
              Integrado ao TOTVS · Plantas Dourado/SP e Porto Amazonas/PR
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
        existingItems={familyFilteredPdmItems}
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
