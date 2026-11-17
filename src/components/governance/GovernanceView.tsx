import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Clock,
  Layers,
  Building2,
  FileCheck,
  Search,
  Edit3,
  ArrowRight,
  ShieldCheck,
  Archive,
  DollarSign,
  FileText,
  UserCheck,
  ClipboardCheck,
  RotateCcw,
  UserCog,
  KeyRound,
  X,
  Info,
  Package
} from 'lucide-react';
import {
  PDMItem,
  PDMStatus,
  UserRole,
  Tenant,
  ApprovalTierLevel,
  GovernanceRequestState,
  GovernanceWorkflowStage,
} from '../../types/pdm';
import { UserAccount, GovernanceQueueAccess } from '../../types/auth';
import { ItemChangeHistoryTable } from '../common/ItemChangeHistoryTable';

export type GovernanceDemandTarget =
  | { kind: 'NEW_ITEM'; itemId: string }
  | { kind: 'ALTERATION'; itemId: string }
  | { kind: 'INTEGRATION'; itemId: string; requestId: string }
  | { kind: 'INACTIVATION'; itemId: string };

interface GovernanceViewProps {
  items: PDMItem[];
  users: UserAccount[];
  currentUserId?: string;
  currentUserRole: UserRole;
  currentUserTier?: 1 | 2 | 3 | 'ALL';
  currentUserName?: string;
  currentUserAccess?: GovernanceQueueAccess;
  currentTenant: Tenant;
  autoOpenItemId?: string | null;
  onClearAutoOpenItem?: () => void;
  onApproveTierStep: (target: GovernanceDemandTarget, tier: ApprovalTierLevel) => void;
  onReturnStep: (target: GovernanceDemandTarget, reason: string) => void;
  onDelegateToEditor: (target: GovernanceDemandTarget, assignee: UserAccount, notes?: string) => void;
  onFinalizeErpExecution: (
    target: GovernanceDemandTarget,
    payload: { totvsCode?: string; erpProtocol?: string; notes?: string }
  ) => void;
  onLinkDuplicate: (itemId: string, targetPdmId: string) => void;
}

function defaultWorkflowState(): GovernanceRequestState {
  return {
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
  };
}

function resolveItemWorkflowState(item: PDMItem): GovernanceRequestState {
  if (item.status === 'APPROVED') {
    return {
      stage: 'COMPLETED',
      requiredTiers: item.approvalWorkflow?.requiredTiers || [1],
      currentPendingTier: null,
      steps: item.approvalWorkflow?.steps || [],
      delegation: item.approvalWorkflow?.delegation,
      returnFeedback: item.approvalWorkflow?.returnFeedback,
      erpExecution: item.approvalWorkflow?.erpExecution,
    };
  }
  const wf = item.approvalWorkflow;
  if (!wf) return defaultWorkflowState();
  const inferredStage: GovernanceWorkflowStage =
    wf.stage ||
    (wf.isFullyApproved ? 'RETURNED_TO_UNIT_MASTER' : 'TIER_REVIEW');
  return {
    stage: inferredStage,
    requiredTiers: wf.requiredTiers,
    currentPendingTier: wf.currentPendingTier,
    steps: wf.steps,
    delegation: wf.delegation,
    returnFeedback: wf.returnFeedback,
    erpExecution: wf.erpExecution,
  };
}

function getStageBadgeProps(stage: GovernanceWorkflowStage, pendingTier: ApprovalTierLevel | null, isReturned?: boolean) {
  if (stage === 'COMPLETED') {
    return {
      label: 'Homologado no Catálogo Mestre',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (isReturned) {
    return {
      label:
        stage === 'TIER_REVIEW' && pendingTier
          ? `Devolvido · Pendente Alçada Nível ${pendingTier}`
          : 'Devolvido para Revisão (Pendente)',
      className: 'bg-amber-100 text-amber-950 border-amber-300',
    };
  }
  if (stage === 'TIER_REVIEW') {
    return {
      label: `Aguardando Aprovação · Alçada Nível ${pendingTier || 1}`,
      className: 'bg-blue-100 text-blue-900 border-blue-300',
    };
  }
  if (stage === 'RETURNED_TO_UNIT_MASTER') {
    return {
      label: 'Retornou ao Master da Unidade · Aguardando Designação',
      className: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    };
  }
  return {
    label: 'Designado p/ Usuário Edição · Aguardando Cód. TOTVS / ERP',
    className: 'bg-amber-100 text-amber-900 border-amber-300',
  };
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  items,
  users,
  currentUserId,
  currentUserRole,
  currentUserTier = 'ALL',
  currentUserName = 'Master Admin',
  currentUserAccess = 'VIEW',
  currentTenant,
  autoOpenItemId,
  onClearAutoOpenItem,
  onApproveTierStep,
  onReturnStep,
  onDelegateToEditor,
  onFinalizeErpExecution,
  onLinkDuplicate,
}) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState<
    'NEW_ITEMS' | 'ALTERATION_REQUESTS' | 'INTEGRATION_REQUESTS' | 'INACTIVATION_REQUESTS'
  >('NEW_ITEMS');

  const [activeStatusTab, setActiveStatusTab] = useState<PDMStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Side by Side comparison state (kept for duplicates)
  const [selectedForCompare, setSelectedForCompare] = useState<{
    requested: PDMItem;
    existing: PDMItem;
  } | null>(null);
  const [compareNotice, setCompareNotice] = useState<string | null>(null);

  // Unified Analysis Modal state
  const [analyzingTarget, setAnalyzingTarget] = useState<GovernanceDemandTarget | null>(null);
  const [returnMode, setReturnMode] = useState<boolean>(false);
  const [returnReasonInput, setReturnReasonInput] = useState<string>('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [delegationNotesInput, setDelegationNotesInput] = useState<string>('');
  const [totvsCodeInput, setTotvsCodeInput] = useState<string>('');
  const [erpProtocolInput, setErpProtocolInput] = useState<string>('');
  const [erpNotesInput, setErpNotesInput] = useState<string>('');
  const [erpConfirmedCheckbox, setErpConfirmedCheckbox] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Active EDIT users eligible for delegation
  const eligibleEditUsers = useMemo(() => {
    return users.filter(
      (u) =>
        u.status === 'ACTIVE' &&
        (u.role === 'MASTER_ADMIN' || u.governanceQueueAccess === 'EDIT')
    );
  }, [users]);

  // Auto-open analysis modal when Master Admin creates a new PDM from Builder
  useEffect(() => {
    if (!autoOpenItemId) return;
    const found = items.find((i) => i.id === autoOpenItemId);
    if (found) {
      setActiveCategoryTab('NEW_ITEMS');
      setAnalyzingTarget({ kind: 'NEW_ITEM', itemId: found.id });
      setTotvsCodeInput(`${found.totvsFamily || '5040'}-`);
      setModalError(null);
      setReturnMode(false);
    }
    if (onClearAutoOpenItem) {
      onClearAutoOpenItem();
    }
  }, [autoOpenItemId, items, onClearAutoOpenItem]);

  const counts = useMemo(() => {
    return {
      pending: items.filter((i) => i.status === 'PENDING_REVIEW').length,
      duplicate: items.filter((i) => i.status === 'FLAGGED_DUPLICATE').length,
      approved: items.filter((i) => i.status === 'APPROVED').length,
      rejected: items.filter((i) => i.status === 'REJECTED').length,
      all: items.length,
    };
  }, [items]);

  // 1. Filtered list for new items
  const filteredNewItems = useMemo(() => {
    return items.filter((item) => {
      if (activeStatusTab !== 'ALL' && item.status !== activeStatusTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchCode =
        (item.totvsCode || '').toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc =
        item.shortDescription.toLowerCase().includes(q) ||
        (item.originalDescription || '').toLowerCase().includes(q);
      const matchNarr =
        (item.narrative || '').toLowerCase().includes(q) || item.longDescription.toLowerCase().includes(q);
      const matchSupp = item.quotation?.supplierName.toLowerCase().includes(q);
      return matchCode || matchDesc || matchNarr || matchSupp;
    });
  }, [items, activeStatusTab, searchQuery]);

  // 2. Alteration / Saneamento requests
  const alterationItems = useMemo(() => {
    return items.filter((i) => i.pendingChange !== undefined);
  }, [items]);

  const filteredAlterations = useMemo(() => {
    if (!searchQuery.trim()) return alterationItems;
    const q = searchQuery.toLowerCase();
    return alterationItems.filter((item) => {
      const matchCode =
        (item.totvsCode || '').toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc = item.shortDescription.toLowerCase().includes(q);
      const matchReason = (item.pendingChange?.reason || '').toLowerCase().includes(q);
      const matchUser = (item.pendingChange?.requestedByUser || '').toLowerCase().includes(q);
      return matchCode || matchDesc || matchReason || matchUser;
    });
  }, [alterationItems, searchQuery]);

  // 3. Integration requests
  const integrationItems = useMemo(() => {
    const list: { item: PDMItem; request: NonNullable<PDMItem['integrationRequests']>[0] }[] = [];
    items.forEach((item) => {
      (item.integrationRequests || []).forEach((req) => {
        if (req.status === 'PENDING') {
          list.push({ item, request: req });
        }
      });
    });
    return list;
  }, [items]);

  const filteredIntegrations = useMemo(() => {
    if (!searchQuery.trim()) return integrationItems;
    const q = searchQuery.toLowerCase();
    return integrationItems.filter(({ item, request }) => {
      const matchCode =
        (item.totvsCode || '').toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc = item.shortDescription.toLowerCase().includes(q);
      const matchReason = request.reason.toLowerCase().includes(q);
      const matchUser = request.requestedByUser.toLowerCase().includes(q);
      return matchCode || matchDesc || matchReason || matchUser;
    });
  }, [integrationItems, searchQuery]);

  // 4. Inactivation requests
  const inactivationItems = useMemo(() => {
    return items.filter((i) => i.inactivationRequest && i.inactivationRequest.status === 'PENDING');
  }, [items]);

  const filteredInactivations = useMemo(() => {
    if (!searchQuery.trim()) return inactivationItems;
    const q = searchQuery.toLowerCase();
    return inactivationItems.filter((item) => {
      const matchCode =
        (item.totvsCode || '').toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc = item.shortDescription.toLowerCase().includes(q);
      const matchReason = (item.inactivationRequest?.reason || '').toLowerCase().includes(q);
      const matchUser = (item.inactivationRequest?.requestedByUser || '').toLowerCase().includes(q);
      return matchCode || matchDesc || matchReason || matchUser;
    });
  }, [inactivationItems, searchQuery]);

  const canApproveTier = (targetTier: ApprovalTierLevel): boolean => {
    if (currentUserRole === 'MASTER_ADMIN') return true;
    if (currentUserTier === 'ALL') return true;
    return currentUserTier === targetTier;
  };

  const handleOpenComparison = (requestedItem: PDMItem) => {
    setCompareNotice(null);
    if (requestedItem.duplicateOfId) {
      const existing = items.find((i) => i.id === requestedItem.duplicateOfId);
      if (existing) {
        setSelectedForCompare({ requested: requestedItem, existing });
        return;
      }
    }
    const fallback = items.find(
      (i) =>
        i.id !== requestedItem.id &&
        i.status === 'APPROVED' &&
        (i.specificSubgroupId === requestedItem.specificSubgroupId ||
          i.totvsFamily === requestedItem.totvsFamily)
    );
    if (fallback) {
      setSelectedForCompare({ requested: requestedItem, existing: fallback });
    } else {
      setCompareNotice('Nenhum item similar aprovado encontrado para comparação direta neste subgrupo.');
    }
  };

  const openAnalysisModal = (target: GovernanceDemandTarget, item: PDMItem) => {
    setAnalyzingTarget(target);
    setReturnMode(false);
    setReturnReasonInput('');
    setDelegationNotesInput('');
    setModalError(null);
    setErpConfirmedCheckbox(false);
    setErpProtocolInput('');
    setErpNotesInput('');
    setTotvsCodeInput(
      target.kind === 'NEW_ITEM'
        ? item.totvsCode && !item.totvsCode.startsWith('PDM-REQ')
          ? item.totvsCode
          : `${item.totvsFamily || '5040'}-`
        : item.totvsCode || item.pdmCode
    );

    // Pre-select first matching EDIT user from the requesting unit
    const reqTenantId =
      target.kind === 'NEW_ITEM'
        ? item.requestedByTenantId
        : target.kind === 'ALTERATION'
        ? item.pendingChange?.requestedByTenantId
        : target.kind === 'INACTIVATION'
        ? item.inactivationRequest?.requestedByTenantId
        : item.integrationRequests?.find((r) => r.id === target.requestId)?.requestedByTenantId;

    const unitEditor =
      eligibleEditUsers.find((u) => u.tenantId === reqTenantId && u.role !== 'MASTER_ADMIN') ||
      eligibleEditUsers.find((u) => u.tenantId === reqTenantId) ||
      eligibleEditUsers[0];
    setSelectedAssigneeId(unitEditor?.id || '');
  };

  // Resolve live target data inside the Analysis Modal
  const liveAnalysisData = useMemo(() => {
    if (!analyzingTarget) return null;
    const item = items.find((i) => i.id === analyzingTarget.itemId);
    if (!item) return null;

    if (analyzingTarget.kind === 'NEW_ITEM') {
      return {
        kind: 'NEW_ITEM' as const,
        item,
        workflowState: resolveItemWorkflowState(item),
        requesterName: item.requestedByUser || 'Solicitante',
        requesterTenantId: item.requestedByTenantId || currentTenant.id,
        requesterTenantName: item.requestedByTenantName || 'Unidade PremieRpet',
        createdAt: item.createdAt,
      };
    }

    if (analyzingTarget.kind === 'ALTERATION' && item.pendingChange) {
      return {
        kind: 'ALTERATION' as const,
        item,
        pendingChange: item.pendingChange,
        workflowState: item.pendingChange.workflowState || defaultWorkflowState(),
        requesterName: item.pendingChange.requestedByUser,
        requesterTenantId: item.pendingChange.requestedByTenantId || currentTenant.id,
        requesterTenantName: item.pendingChange.requestedByTenantName || 'Unidade PremieRpet',
        createdAt: item.pendingChange.requestedAt,
      };
    }

    if (analyzingTarget.kind === 'INTEGRATION') {
      const req = (item.integrationRequests || []).find((r) => r.id === analyzingTarget.requestId);
      if (!req) return null;
      return {
        kind: 'INTEGRATION' as const,
        item,
        integrationRequest: req,
        workflowState: req.workflowState || defaultWorkflowState(),
        requesterName: req.requestedByUser,
        requesterTenantId: req.requestedByTenantId,
        requesterTenantName: req.requestedByTenantName,
        createdAt: req.requestedAt,
      };
    }

    if (analyzingTarget.kind === 'INACTIVATION' && item.inactivationRequest) {
      return {
        kind: 'INACTIVATION' as const,
        item,
        inactivationRequest: item.inactivationRequest,
        workflowState: item.inactivationRequest.workflowState || defaultWorkflowState(),
        requesterName: item.inactivationRequest.requestedByUser,
        requesterTenantId: item.inactivationRequest.requestedByTenantId,
        requesterTenantName: item.inactivationRequest.requestedByTenantName,
        createdAt: item.inactivationRequest.requestedAt,
      };
    }

    return null;
  }, [analyzingTarget, items, currentTenant.id]);

  // Keep user-friendly assignee list sorted with requesting unit first
  const sortedUnitAssignees = useMemo(() => {
    const targetTenantId = liveAnalysisData?.requesterTenantId;
    return [...eligibleEditUsers].sort((a, b) => {
      const aMatch = a.tenantId === targetTenantId ? 0 : 1;
      const bMatch = b.tenantId === targetTenantId ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [eligibleEditUsers, liveAnalysisData?.requesterTenantId]);

  const isMaster = currentUserRole === 'MASTER_ADMIN';
  const hasEditQueuePermission = isMaster || currentUserAccess === 'EDIT';

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Fila de Saneamento & Governança Central PremieRpet
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Master Data Management
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Esteira unificada: Análise da solicitação ➔ Alçadas de aprovação ➔ Retorno ao Master da unidade (designar Edição) ➔ Inserção do Código TOTVS / Execução ERP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMaster ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Master Admin</strong> · Aprovação, Designação & Código TOTVS
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
              <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                <strong>{currentUserName}</strong> · Fila:{' '}
                <strong>{currentUserAccess === 'EDIT' ? 'Edição / Cód. TOTVS' : 'Visualização'}</strong>
                {currentUserTier && currentUserTier !== 'ALL' ? ` · Alçada Nível ${currentUserTier}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {compareNotice && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{compareNotice}</span>
          </div>
          <button onClick={() => setCompareNotice(null)} className="text-amber-700 hover:text-amber-950 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 CATEGORY TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveCategoryTab('NEW_ITEMS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeCategoryTab === 'NEW_ITEMS'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Novos Cadastros PDM</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeCategoryTab === 'NEW_ITEMS' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {counts.pending + counts.duplicate}
          </span>
        </button>

        <button
          onClick={() => setActiveCategoryTab('ALTERATION_REQUESTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeCategoryTab === 'ALTERATION_REQUESTS'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Alterações & Saneamento</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeCategoryTab === 'ALTERATION_REQUESTS'
                ? 'bg-amber-700 text-amber-100'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {alterationItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveCategoryTab('INTEGRATION_REQUESTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeCategoryTab === 'INTEGRATION_REQUESTS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Integração entre Almoxarifados</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeCategoryTab === 'INTEGRATION_REQUESTS'
                ? 'bg-blue-700 text-blue-100'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}
          >
            {integrationItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveCategoryTab('INACTIVATION_REQUESTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeCategoryTab === 'INACTIVATION_REQUESTS'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Solicitações de Inativação</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeCategoryTab === 'INACTIVATION_REQUESTS'
                ? 'bg-rose-700 text-rose-100'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}
          >
            {inactivationItems.length}
          </span>
        </button>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {activeCategoryTab === 'NEW_ITEMS' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setActiveStatusTab('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeStatusTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <span>Todos ({counts.all})</span>
            </button>

            <button
              onClick={() => setActiveStatusTab('PENDING_REVIEW')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeStatusTab === 'PENDING_REVIEW'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-white text-blue-800 hover:bg-blue-50 border border-blue-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Em Andamento ({counts.pending})</span>
            </button>

            <button
              onClick={() => setActiveStatusTab('FLAGGED_DUPLICATE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeStatusTab === 'FLAGGED_DUPLICATE'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Duplicidade Identificada ({counts.duplicate})</span>
            </button>

            <button
              onClick={() => setActiveStatusTab('APPROVED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeStatusTab === 'APPROVED'
                  ? 'bg-emerald-700 text-white font-bold shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Homologados ({counts.approved})</span>
            </button>
          </div>
        )}

        <div className="relative w-full sm:w-72 shrink-0 ml-auto">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar código, descrição, justificativa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. TAB: NOVOS CADASTROS PDM                                           */}
      {/* ===================================================================== */}
      {activeCategoryTab === 'NEW_ITEMS' && (
        <div className="space-y-4">
          {filteredNewItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação nesta etapa{searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredNewItems.map((item) => {
              const isDuplicate = item.status === 'FLAGGED_DUPLICATE';
              const isApproved = item.status === 'APPROVED';
              const wfState = resolveItemWorkflowState(item);
              const badge = getStageBadgeProps(
                wfState.stage,
                wfState.currentPendingTier,
                Boolean(wfState.returnFeedback)
              );

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${
                    isDuplicate
                      ? 'bg-amber-50/50 border-amber-300'
                      : isApproved
                      ? 'bg-white border-slate-200'
                      : 'bg-white border-blue-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>

                        {isDuplicate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Duplicidade ({item.similarityScore || 92}%)</span>
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${badge.className}`}
                        >
                          {wfState.stage === 'COMPLETED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{badge.label}</span>
                        </span>

                        {wfState.delegation && wfState.stage === 'DELEGATED_TO_ERP_EDITOR' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            <UserCog className="w-3 h-3" />
                            <span>Designado: {wfState.delegation.assignedUserName}</span>
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500">
                          por <strong className="text-slate-700">{item.requestedByUser || 'Solicitante'}</strong> (
                          {item.requestedByTenantName || 'Unidade PremieRpet'})
                        </span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-900">{item.shortDescription}</div>
                      <div className="text-xs text-slate-600 leading-relaxed">{item.longDescription}</div>

                      {wfState.returnFeedback && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950 flex items-start gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <strong>Devolvido por {wfState.returnFeedback.returnedBy}:</strong>{' '}
                            {wfState.returnFeedback.reason}
                          </div>
                        </div>
                      )}

                      {item.quotation && (
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-blue-900 bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2">
                          <span className="font-bold flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-blue-700" />
                            <span>
                              R$ {item.quotation.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </span>
                          <span>·</span>
                          <span>
                            Fornecedor: <strong>{item.quotation.supplierName}</strong>
                          </span>
                          <span>·</span>
                          <span className="font-mono">Cotação: {item.quotation.quoteNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* UNIFIED CARD ACTIONS */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                      {(isDuplicate || Boolean(item.duplicateOfId)) && !isApproved && (
                        <button
                          onClick={() => handleOpenComparison(item)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold shadow-2xs"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Comparar</span>
                        </button>
                      )}

                      <button
                        onClick={() => openAnalysisModal({ kind: 'NEW_ITEM', itemId: item.id }, item)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-2xs"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Analisar solicitação</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. TAB: ALTERAÇÕES & SANEAMENTO CADASTRAL                             */}
      {/* ===================================================================== */}
      {activeCategoryTab === 'ALTERATION_REQUESTS' && (
        <div className="space-y-4">
          {filteredAlterations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação de alteração cadastral pendente na fila{searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredAlterations.map((item) => {
              const pendingChange = item.pendingChange;
              if (!pendingChange) return null;
              const wfState = pendingChange.workflowState || defaultWorkflowState();
              const badge = getStageBadgeProps(
                wfState.stage,
                wfState.currentPendingTier,
                Boolean(wfState.returnFeedback)
              );

              return (
                <div key={item.id} className="p-5 rounded-2xl border border-amber-300 bg-amber-50/40 shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.className}`}>
                          {badge.label}
                        </span>
                        {wfState.delegation && wfState.stage === 'DELEGATED_TO_ERP_EDITOR' && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            Designado: {wfState.delegation.assignedUserName}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          por <strong>{pendingChange.requestedByUser}</strong> ({pendingChange.requestedByTenantName || 'Unidade'}) em{' '}
                          {new Date(pendingChange.requestedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-900">{item.shortDescription}</div>

                      <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">Justificativa: </span>
                        <span className="italic">{pendingChange.reason}</span>
                        <span className="ml-2 font-mono text-[10px] text-amber-800 font-bold">
                          ({pendingChange.changes.length} campo(s) alterado(s))
                        </span>
                      </div>

                      {wfState.returnFeedback && (
                        <div className="p-2.5 rounded-xl bg-white border border-amber-300 text-[11px] text-amber-950 flex items-start gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <strong>Devolvido por {wfState.returnFeedback.returnedBy}:</strong>{' '}
                            {wfState.returnFeedback.reason}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => openAnalysisModal({ kind: 'ALTERATION', itemId: item.id }, item)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-2xs"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Analisar solicitação</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. TAB: INTEGRAÇÃO ENTRE ALMOXARIFADOS                                */}
      {/* ===================================================================== */}
      {activeCategoryTab === 'INTEGRATION_REQUESTS' && (
        <div className="space-y-4">
          {filteredIntegrations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação de integração de item entre almoxarifados pendente
              {searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredIntegrations.map(({ item, request }) => {
              const wfState = request.workflowState || defaultWorkflowState();
              const badge = getStageBadgeProps(
                wfState.stage,
                wfState.currentPendingTier,
                Boolean(wfState.returnFeedback)
              );

              return (
                <div key={request.id} className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.className}`}>
                          {badge.label}
                        </span>
                        {wfState.delegation && wfState.stage === 'DELEGATED_TO_ERP_EDITOR' && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            Designado: {wfState.delegation.assignedUserName}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          por <strong>{request.requestedByUser}</strong> ({request.requestedByTenantName}) em{' '}
                          {new Date(request.requestedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-900">{item.shortDescription}</div>

                      <div className="flex flex-wrap items-center gap-3 text-xs bg-white border border-blue-200 rounded-xl px-3 py-2">
                        <strong className="text-blue-900 flex items-center gap-1">
                          <span>Estab. {request.sourcePlant}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span>Estab. {request.targetPlant}</span>
                        </strong>
                        <span>·</span>
                        <span>
                          Estoque Seguro:{' '}
                          <strong className="font-mono text-emerald-800">
                            {request.requestedSafetyStock} {item.unitOfMeasure || 'UN'}
                          </strong>
                        </span>
                        <span>·</span>
                        <span className="italic text-slate-600">{request.reason}</span>
                      </div>

                      {wfState.returnFeedback && (
                        <div className="p-2.5 rounded-xl bg-white border border-amber-300 text-[11px] text-amber-950 flex items-start gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <strong>Devolvido por {wfState.returnFeedback.returnedBy}:</strong>{' '}
                            {wfState.returnFeedback.reason}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() =>
                          openAnalysisModal({ kind: 'INTEGRATION', itemId: item.id, requestId: request.id }, item)
                        }
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Analisar solicitação</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. TAB: SOLICITAÇÕES DE INATIVAÇÃO                                    */}
      {/* ===================================================================== */}
      {activeCategoryTab === 'INACTIVATION_REQUESTS' && (
        <div className="space-y-4">
          {filteredInactivations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação de inativação ou obsolescência pendente
              {searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredInactivations.map((item) => {
              const req = item.inactivationRequest;
              if (!req) return null;
              const wfState = req.workflowState || defaultWorkflowState();
              const badge = getStageBadgeProps(
                wfState.stage,
                wfState.currentPendingTier,
                Boolean(wfState.returnFeedback)
              );

              return (
                <div key={item.id} className="p-5 rounded-2xl border border-rose-300 bg-rose-50/40 shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.className}`}>
                          {badge.label}
                        </span>
                        {wfState.delegation && wfState.stage === 'DELEGATED_TO_ERP_EDITOR' && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            Designado: {wfState.delegation.assignedUserName}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500">
                          por <strong>{req.requestedByUser}</strong> ({req.requestedByTenantName}) em{' '}
                          {new Date(req.requestedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-900">{item.shortDescription}</div>

                      <div className="p-2.5 rounded-xl bg-white border border-rose-200 text-xs text-slate-700">
                        <span className="font-semibold text-slate-800">Motivo técnico: </span>
                        <span className="italic">{req.reason}</span>
                        {req.replacementItemCode && (
                          <span className="ml-2 font-mono text-emerald-800 font-bold">
                            · Substituto: {req.replacementItemCode}
                          </span>
                        )}
                      </div>

                      {wfState.returnFeedback && (
                        <div className="p-2.5 rounded-xl bg-white border border-amber-300 text-[11px] text-amber-950 flex items-start gap-2">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <strong>Devolvido por {wfState.returnFeedback.returnedBy}:</strong>{' '}
                            {wfState.returnFeedback.reason}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => openAnalysisModal({ kind: 'INACTIVATION', itemId: item.id }, item)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Analisar solicitação</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* UNIFIED ANALYSIS MODAL ("Analisar solicitação")                       */}
      {/* ===================================================================== */}
      {liveAnalysisData && analyzingTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Análise da Solicitação ·{' '}
                      {liveAnalysisData.kind === 'NEW_ITEM'
                        ? 'Novo Cadastro PDM'
                        : liveAnalysisData.kind === 'ALTERATION'
                        ? 'Alteração & Saneamento'
                        : liveAnalysisData.kind === 'INTEGRATION'
                        ? 'Integração entre Almoxarifados'
                        : 'Inativação / Obsolescência'}
                    </h3>
                    <span className="font-mono text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                      {liveAnalysisData.item.totvsCode || liveAnalysisData.item.pdmCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Solicitado por <strong>{liveAnalysisData.requesterName}</strong> ({liveAnalysisData.requesterTenantName}) em{' '}
                    {new Date(liveAnalysisData.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalyzingTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* 4-STEP PIPELINE STEPPER */}
              {(() => {
                const st = liveAnalysisData.workflowState.stage;
                const stepsMeta: { key: GovernanceWorkflowStage; num: number; title: string; sub: string }[] = [
                  { key: 'TIER_REVIEW', num: 1, title: 'Alçadas de Aprovação', sub: 'Validação técnica/orçamento' },
                  { key: 'RETURNED_TO_UNIT_MASTER', num: 2, title: 'Master da Unidade', sub: 'Designar usuário c/ Edição' },
                  { key: 'DELEGATED_TO_ERP_EDITOR', num: 3, title: 'Execução TOTVS / ERP', sub: 'Inserir Cód. TOTVS e finalizar' },
                  { key: 'COMPLETED', num: 4, title: 'Homologado', sub: 'Ativo no Catálogo Mestre' },
                ];
                const order: Record<GovernanceWorkflowStage, number> = {
                  TIER_REVIEW: 1,
                  RETURNED_TO_UNIT_MASTER: 2,
                  DELEGATED_TO_ERP_EDITOR: 3,
                  COMPLETED: 4,
                };
                const currNum = order[st];

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {stepsMeta.map((step) => {
                      const isDone = currNum > step.num || st === 'COMPLETED';
                      const isActive = currNum === step.num && st !== 'COMPLETED';
                      return (
                        <div
                          key={step.key}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isDone
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                              : isActive
                              ? 'bg-blue-50 border-blue-400 text-blue-950 ring-2 ring-blue-100'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                isDone
                                  ? 'bg-emerald-600 text-white'
                                  : isActive
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isDone ? '✓' : step.num}
                            </span>
                            <span>{step.title}</span>
                          </div>
                          <div className="text-[10px] mt-0.5 pl-5">{step.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* PREVIOUS RETURN FEEDBACK BANNER (KEPT PENDING IN QUEUE) */}
              {liveAnalysisData.workflowState.returnFeedback && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                    <span>
                      Solicitação devolvida por {liveAnalysisData.workflowState.returnFeedback.returnedBy} (mantida pendente na fila)
                    </span>
                  </div>
                  <p className="text-xs italic">"{liveAnalysisData.workflowState.returnFeedback.reason}"</p>
                </div>
              )}

              {/* DEMAND DETAILS SECTION */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Dados Completos do Item & Solicitação</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    Família TOTVS: <strong className="text-slate-800">{liveAnalysisData.item.totvsFamily || '5040'}</strong> · NCM:{' '}
                    <strong className="text-slate-800">{liveAnalysisData.item.ncm || 'N/D'}</strong> · Un:{' '}
                    <strong className="text-slate-800">{liveAnalysisData.item.unitOfMeasure || 'UN'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-400 block">Descrição Curta (60c)</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {liveAnalysisData.item.shortDescription}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-400 block">Descrição Longa / Narrativa (200c)</span>
                    <div className="font-mono text-slate-700 mt-0.5 break-words">
                      {liveAnalysisData.item.narrative || liveAnalysisData.item.longDescription}
                    </div>
                  </div>
                </div>

                {liveAnalysisData.item.nivel1 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                      <strong>Nível 1:</strong> {liveAnalysisData.item.nivel1}
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                      <strong>Nível 2:</strong> {liveAnalysisData.item.nivel2}
                    </span>
                    <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      <strong>Nível 3:</strong> {liveAnalysisData.item.nivel3}
                    </span>
                  </div>
                )}

                {/* Specific Kind Details */}
                {liveAnalysisData.kind === 'NEW_ITEM' && liveAnalysisData.item.quotation && (
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Fornecedor Cotado:</span>
                      <strong className="text-slate-900">{liveAnalysisData.item.quotation.supplierName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Nº Cotação:</span>
                      <strong className="font-mono text-slate-900">{liveAnalysisData.item.quotation.quoteNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Valor Unitário:</span>
                      <strong className="font-mono text-emerald-800">
                        R$ {liveAnalysisData.item.quotation.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Anexo Orçamento:</span>
                      <span className="font-mono text-blue-700 font-semibold flex items-center gap-1">
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="truncate">{liveAnalysisData.item.quotation.fileName}</span>
                      </span>
                    </div>
                  </div>
                )}

                {liveAnalysisData.kind === 'NEW_ITEM' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Tempo Ressuprimento</span>
                      <strong>{liveAnalysisData.item.leadTimeDays ?? 15} dias</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Estoque Mínimo Sugerido</span>
                      <strong>{liveAnalysisData.item.orderPoint ?? 1}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Estoque Máximo Sugerido</span>
                      <strong>{liveAnalysisData.item.safetyStockWarehouse ?? 1}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Estabelecimento Consumo</span>
                      <strong>{liveAnalysisData.item.totvsPlant || 'Dourado'}</strong>
                    </div>
                  </div>
                )}

                {liveAnalysisData.kind === 'ALTERATION' && (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-white border border-amber-200">
                      <strong className="text-slate-700 block mb-0.5">Justificativa Técnica:</strong>
                      <p className="italic text-slate-700">{liveAnalysisData.pendingChange.reason}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 overflow-auto max-h-72 bg-white">
                      <table className="w-full text-center text-xs">
                        <thead className="bg-amber-100 font-mono text-[10px] text-amber-950 border-b border-amber-200 sticky top-0 z-20 shadow-[0_1px_0_0_#fde68a]">
                          <tr>
                            <th className="py-2 px-3 text-center">Campo</th>
                            <th className="py-2 px-3 text-center">Atual</th>
                            <th className="py-2 px-3 text-center">Proposto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 font-mono text-[11px]">
                          {liveAnalysisData.pendingChange.changes.map((ch, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 text-center font-sans font-semibold text-slate-800">{ch.fieldLabel}</td>
                              <td className="py-2 px-3 text-center text-slate-500 line-through">{ch.oldValue || '—'}</td>
                              <td className="py-2 px-3 text-center text-emerald-800 font-bold">{ch.newValue || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {liveAnalysisData.kind === 'INTEGRATION' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-white border border-blue-200">
                      <span className="text-[10px] text-slate-400 font-mono block">Rota da Integração</span>
                      <strong className="text-blue-900">
                        Estab. {liveAnalysisData.integrationRequest.sourcePlant} ➔ Estab.{' '}
                        {liveAnalysisData.integrationRequest.targetPlant}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-blue-200">
                      <span className="text-[10px] text-slate-400 font-mono block">Estoque Seguro Solicitado</span>
                      <strong className="font-mono text-emerald-800">
                        {liveAnalysisData.integrationRequest.requestedSafetyStock}{' '}
                        {liveAnalysisData.item.unitOfMeasure || 'UN'}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-blue-200">
                      <span className="text-[10px] text-slate-400 font-mono block">Justificativa</span>
                      <span className="italic text-slate-700">{liveAnalysisData.integrationRequest.reason}</span>
                    </div>
                  </div>
                )}

                {liveAnalysisData.kind === 'INACTIVATION' && (
                  <div className="p-3 rounded-lg bg-white border border-rose-200 space-y-1">
                    <strong className="text-slate-700 block">Motivo Técnico da Inativação:</strong>
                    <p className="italic text-slate-700">{liveAnalysisData.inactivationRequest.reason}</p>
                    {liveAnalysisData.inactivationRequest.replacementItemCode && (
                      <div className="pt-1 font-mono text-emerald-800 font-bold">
                        Item Substituto Sugerido: {liveAnalysisData.inactivationRequest.replacementItemCode}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STAGE-SPECIFIC INTERACTION BOX */}
              {/* STAGE 1: TIER APPROVALS */}
              {liveAnalysisData.workflowState.stage === 'TIER_REVIEW' && (
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-700" />
                      <span>Etapa 1 · Alçadas de Aprovação</span>
                    </strong>
                    <span className="font-mono text-[11px] font-bold text-blue-900">
                      Alçada Atual Pendente: Nível {liveAnalysisData.workflowState.currentPendingTier || 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {liveAnalysisData.workflowState.steps.map((st) => (
                      <div
                        key={st.tier}
                        className={`p-2.5 rounded-lg border text-xs ${
                          st.status === 'APPROVED'
                            ? 'bg-emerald-50 border-emerald-300'
                            : st.status === 'PENDING'
                            ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="font-mono font-bold text-[10px] flex items-center justify-between">
                          <span>Nível {st.tier}</span>
                          <span>
                            {st.status === 'APPROVED'
                              ? 'Aprovado'
                              : st.status === 'PENDING'
                              ? 'Pendente'
                              : 'Aguardando'}
                          </span>
                        </div>
                        <div className="text-[10px] mt-0.5 text-slate-600">{st.tierLabel}</div>
                        {st.approvedByUser && (
                          <div className="text-[10px] text-emerald-800 mt-1 font-semibold">
                            ✓ {st.approvedByUser}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const pendingTier = liveAnalysisData.workflowState.currentPendingTier || 1;
                    const userCanAct = canApproveTier(pendingTier);

                    if (!userCanAct) {
                      return (
                        <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs">
                          Você está em modo de visualização ou sua alçada atual não corresponde ao{' '}
                          <strong>Nível {pendingTier}</strong>.
                        </div>
                      );
                    }

                    if (returnMode) {
                      return (
                        <div className="p-3 rounded-xl bg-white border border-amber-300 space-y-2.5">
                          <label className="block font-bold text-amber-950">
                            Justificativa da Devolução / Reprovação (o item permanecerá pendente na fila):
                          </label>
                          <textarea
                            rows={2}
                            value={returnReasonInput}
                            onChange={(e) => setReturnReasonInput(e.target.value)}
                            placeholder="Descreva o motivo técnico para correção ou complemento pelo solicitante..."
                            className="w-full p-2.5 rounded-xl border border-amber-300 bg-slate-50 text-xs focus:outline-none focus:border-amber-600 focus:bg-white"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReturnMode(false);
                                setModalError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!returnReasonInput.trim()) {
                                  setModalError('Informe o motivo da devolução para manter o registro na fila.');
                                  return;
                                }
                                setModalError(null);
                                onReturnStep(analyzingTarget, returnReasonInput.trim());
                                setReturnMode(false);
                                setReturnReasonInput('');
                              }}
                              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            >
                              Confirmar Devolução (Manter Pendente)
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReturnMode(true);
                            setModalError(null);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Devolver / Reprovar Etapa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            onApproveTierStep(analyzingTarget, pendingTier);
                          }}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprovar Alçada Nível {pendingTier}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STAGE 2: RETURNED TO UNIT MASTER ADMIN TO DELEGATE EDIT USER */}
              {liveAnalysisData.workflowState.stage === 'RETURNED_TO_UNIT_MASTER' && (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-300 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <UserCog className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-indigo-950 block">
                        Etapa 2 · Retornou ao Master Admin da Unidade ({liveAnalysisData.requesterTenantName})
                      </strong>
                      <p className="text-[11px] text-indigo-900">
                        As alçadas aprovaram esta solicitação. Designe um usuário com permissão de{' '}
                        <strong>Edição na Fila de Governança</strong> para executar no TOTVS e inserir o código oficial.
                      </p>
                    </div>
                  </div>

                  {isMaster ? (
                    <div className="p-3.5 rounded-xl bg-white border border-indigo-200 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Designar Usuário com Permissão de Edição *
                          </label>
                          <select
                            value={selectedAssigneeId}
                            onChange={(e) => setSelectedAssigneeId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                          >
                            {sortedUnitAssignees.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} (@{u.username}) — {u.tenantName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Orientação para Execução no TOTVS (Opcional)
                          </label>
                          <input
                            type="text"
                            value={delegationNotesInput}
                            onChange={(e) => setDelegationNotesInput(e.target.value)}
                            placeholder="Ex: Cadastrar na família selecionada e informar código gerado..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const selfUser =
                              users.find((u) => u.id === currentUserId) ||
                              users.find((u) => u.role === 'MASTER_ADMIN') ||
                              sortedUnitAssignees[0];
                            if (selfUser) {
                              onDelegateToEditor(
                                analyzingTarget,
                                selfUser,
                                'Master Admin assumiu diretamente a inserção do código TOTVS.'
                              );
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold"
                        >
                          Assumir & Inserir Código TOTVS Agora
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const assignee = sortedUnitAssignees.find((u) => u.id === selectedAssigneeId);
                            if (!assignee) {
                              setModalError('Selecione um usuário ativo com permissão de Edição.');
                              return;
                            }
                            setModalError(null);
                            onDelegateToEditor(analyzingTarget, assignee, delegationNotesInput.trim());
                          }}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold shadow-xs"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Designar Responsável</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white border border-indigo-200 text-slate-600">
                      Aguardando o <strong>Master Admin</strong> designar o responsável com permissão de Edição desta unidade.
                    </div>
                  )}
                </div>
              )}

              {/* STAGE 3: DELEGATED TO EDIT USER — INSERT TOTVS CODE / CONFIRM ERP */}
              {liveAnalysisData.workflowState.stage === 'DELEGATED_TO_ERP_EDITOR' && (
                <div className="p-4 rounded-xl bg-amber-50/60 border-2 border-amber-300 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-800" />
                      <strong className="text-amber-950">
                        Etapa 3 ·{' '}
                        {liveAnalysisData.kind === 'NEW_ITEM'
                          ? 'Inserção do Código TOTVS & Finalização'
                          : 'Confirmação de Execução no ERP TOTVS'}
                      </strong>
                    </div>
                    {liveAnalysisData.workflowState.delegation && (
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white border border-amber-300 text-amber-950">
                        Designado: {liveAnalysisData.workflowState.delegation.assignedUserName}
                      </span>
                    )}
                  </div>

                  {liveAnalysisData.workflowState.delegation?.notes && (
                    <p className="text-[11px] text-amber-900 italic">
                      Orientação: "{liveAnalysisData.workflowState.delegation.notes}"
                    </p>
                  )}

                  {hasEditQueuePermission ? (
                    <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-3">
                      {liveAnalysisData.kind === 'NEW_ITEM' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Código TOTVS Gerado no ERP <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={totvsCodeInput}
                              onChange={(e) => setTotvsCodeInput(e.target.value.toUpperCase())}
                              placeholder={`Ex: ${liveAnalysisData.item.totvsFamily || '5040'}-7580`}
                              className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-slate-50 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Informe exatamente o código criado no ERP TOTVS para publicar este PDM no Catálogo Mestre.
                            </p>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Observação de Inclusão no ERP (Opcional)
                            </label>
                            <input
                              type="text"
                              value={erpNotesInput}
                              onChange={(e) => setErpNotesInput(e.target.value)}
                              placeholder="Ex: Item criado na base TOTVS Estab. 10/14."
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Protocolo / Referência TOTVS (Opcional)
                              </label>
                              <input
                                type="text"
                                value={erpProtocolInput}
                                onChange={(e) => setErpProtocolInput(e.target.value.toUpperCase())}
                                placeholder="Ex: ERP-2026-0142"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Observação da Execução (Opcional)
                              </label>
                              <input
                                type="text"
                                value={erpNotesInput}
                                onChange={(e) => setErpNotesInput(e.target.value)}
                                placeholder="Ex: Atualização efetivada no cadastro do TOTVS."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={erpConfirmedCheckbox}
                              onChange={(e) => setErpConfirmedCheckbox(e.target.checked)}
                              className="accent-emerald-700 w-4 h-4"
                            />
                            <span>Confirmo que a atualização foi executada no ERP TOTVS</span>
                          </label>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (liveAnalysisData.kind === 'NEW_ITEM') {
                              const codeClean = totvsCodeInput.trim().toUpperCase();
                              if (!codeClean || codeClean.endsWith('-')) {
                                setModalError('Informe o código TOTVS completo gerado no ERP.');
                                return;
                              }
                              const duplicateCode = items.find(
                                (other) =>
                                  other.id !== liveAnalysisData.item.id &&
                                  other.status === 'APPROVED' &&
                                  (other.totvsCode || '').toUpperCase() === codeClean
                              );
                              if (duplicateCode) {
                                setModalError(`O código TOTVS "${codeClean}" já existe no Catálogo Mestre.`);
                                return;
                              }
                              setModalError(null);
                              onFinalizeErpExecution(analyzingTarget, {
                                totvsCode: codeClean,
                                notes: erpNotesInput.trim(),
                              });
                              setAnalyzingTarget(null);
                            } else {
                              if (!erpConfirmedCheckbox) {
                                setModalError('Marque a confirmação de execução no ERP TOTVS para finalizar.');
                                return;
                              }
                              setModalError(null);
                              onFinalizeErpExecution(analyzingTarget, {
                                erpProtocol: erpProtocolInput.trim(),
                                notes: erpNotesInput.trim(),
                              });
                              setAnalyzingTarget(null);
                            }
                          }}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {liveAnalysisData.kind === 'NEW_ITEM'
                              ? 'Gravar Código TOTVS & Homologar Item'
                              : 'Confirmar Execução ERP & Concluir'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-white border border-amber-200 text-slate-600">
                      Seu usuário possui acesso de <strong>Visualização</strong>. Apenas usuários com permissão de{' '}
                      <strong>Edição na Fila de Governança</strong> ou <strong>Master Admin</strong> podem inserir o código TOTVS.
                    </div>
                  )}
                </div>
              )}

              {/* STAGE 4: COMPLETED */}
              {liveAnalysisData.workflowState.stage === 'COMPLETED' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Item Homologado & Publicado no Catálogo Mestre TOTVS</span>
                  </div>
                  <div className="text-xs text-emerald-900 font-mono">
                    Código TOTVS Oficial:{' '}
                    <strong>{liveAnalysisData.item.totvsCode || liveAnalysisData.item.pdmCode}</strong>
                    {liveAnalysisData.workflowState.erpExecution && (
                      <span>
                        {' '}
                        · Inserido por {liveAnalysisData.workflowState.erpExecution.executedBy} em{' '}
                        {new Date(liveAnalysisData.workflowState.erpExecution.executedAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* AUDIT TRAIL */}
              {(liveAnalysisData.item.changeHistory || []).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-500 block">
                    Histórico & Auditoria por Data e Responsáveis
                  </span>
                  <ItemChangeHistoryTable
                    history={liveAnalysisData.item.changeHistory}
                    maxHeightClass="max-h-64 overflow-y-auto"
                    limit={12}
                  />
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">Governança Corporativa PremieRpet</span>
              <button
                type="button"
                onClick={() => setAnalyzingTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                Fechar Análise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* COMPARISON MODAL (DUPLICATES)                                         */}
      {/* ===================================================================== */}
      {selectedForCompare && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Detecção de Duplicidade · Comparação Paramétrica</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      {selectedForCompare.requested.similarityScore || 94}% Similaridade
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Compare a solicitação com o item já homologado no ERP TOTVS para impedir criação de códigos duplicados.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedForCompare(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <span className="font-mono text-xs font-bold text-amber-900 uppercase tracking-wide">
                      [A] Nova Solicitação de Cadastro
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                      {selectedForCompare.requested.pdmCode}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 text-[10px] block">Descrição Curta Proposta:</span>
                    <div className="font-mono font-bold text-amber-900 p-2 rounded-lg bg-white border border-amber-200 mt-1">
                      {selectedForCompare.requested.shortDescription}
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 text-[10px] block">Narrativa Longa Técnica:</span>
                    <p className="text-slate-700 text-[11px] leading-relaxed mt-1">
                      {selectedForCompare.requested.longDescription}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="font-mono text-xs font-bold text-emerald-900 uppercase tracking-wide">
                      [B] Item Homologado no TOTVS
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 font-bold">
                      {selectedForCompare.existing.totvsCode || selectedForCompare.existing.pdmCode}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 text-[10px] block">Descrição Ativa no ERP TOTVS:</span>
                    <div className="font-mono font-bold text-emerald-900 p-2 rounded-lg bg-white border border-emerald-200 mt-1">
                      {selectedForCompare.existing.shortDescription}
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 text-[10px] block">Narrativa Técnica Oficial:</span>
                    <p className="text-slate-700 text-[11px] leading-relaxed mt-1">
                      {selectedForCompare.existing.longDescription}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedForCompare(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Fechar Comparação
              </button>

              {isMaster && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onLinkDuplicate(selectedForCompare.requested.id, selectedForCompare.existing.id);
                      setSelectedForCompare(null);
                    }}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>
                      Unificar & Vincular ao Código{' '}
                      {selectedForCompare.existing.totvsCode || selectedForCompare.existing.pdmCode}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      const req = selectedForCompare.requested;
                      setSelectedForCompare(null);
                      openAnalysisModal({ kind: 'NEW_ITEM', itemId: req.id }, req);
                    }}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                  >
                    <span>Analisar como Novo Item</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
