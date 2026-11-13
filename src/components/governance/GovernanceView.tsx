import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  ArrowRightLeft, 
  Clock, 
  Layers, 
  ShieldAlert,
  Building2,
  FileCheck,
  Search,
  Edit3,
  ArrowRight,
  ShieldCheck,
  Archive,
  DollarSign,
  FileText,
  Paperclip,
  Check,
  UserCheck
} from 'lucide-react';
import { PDMItem, PDMStatus, UserRole, Tenant, ApprovalTierLevel } from '../../types/pdm';

interface GovernanceViewProps {
  items: PDMItem[];
  currentUserRole: UserRole;
  currentUserTier?: 1 | 2 | 3 | 'ALL';
  currentUserName?: string;
  currentTenant: Tenant;
  onApproveItem: (itemId: string) => void;
  onApproveTier?: (itemId: string, tier: ApprovalTierLevel) => void;
  onRejectItem: (itemId: string, reason: string) => void;
  onLinkDuplicate: (itemId: string, targetPdmId: string) => void;
  onApproveChangeRequest?: (itemId: string) => void;
  onRejectChangeRequest?: (itemId: string, reason: string) => void;
  onApproveIntegration?: (itemId: string, requestId: string) => void;
  onRejectIntegration?: (itemId: string, requestId: string, reason: string) => void;
  onApproveInactivation?: (itemId: string) => void;
  onRejectInactivation?: (itemId: string, reason: string) => void;
  onSelectItemDetail?: (item: PDMItem) => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  items,
  currentUserRole,
  currentUserTier = 'ALL',
  currentUserName = 'Master Admin',
  currentTenant,
  onApproveItem,
  onApproveTier,
  onRejectItem,
  onLinkDuplicate,
  onApproveChangeRequest,
  onRejectChangeRequest,
  onApproveIntegration,
  onRejectIntegration,
  onApproveInactivation,
  onRejectInactivation,
  onSelectItemDetail,
}) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState<
    'NEW_ITEMS' | 'ALTERATION_REQUESTS' | 'INTEGRATION_REQUESTS' | 'INACTIVATION_REQUESTS'
  >('NEW_ITEMS');

  const [activeStatusTab, setActiveStatusTab] = useState<PDMStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Side by Side comparison state
  const [selectedForCompare, setSelectedForCompare] = useState<{
    requested: PDMItem;
    existing: PDMItem;
  } | null>(null);

  // Modals for rejections with reasons
  const [rejectionModalItem, setRejectionModalItem] = useState<PDMItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const [rejectionChangeModalItem, setRejectionChangeModalItem] = useState<PDMItem | null>(null);
  const [rejectionChangeReason, setRejectionChangeReason] = useState<string>('');

  const [rejectionIntegModalData, setRejectionIntegModalData] = useState<{
    item: PDMItem;
    requestId: string;
  } | null>(null);
  const [rejectionIntegReason, setRejectionIntegReason] = useState<string>('');

  const [rejectionInactModalItem, setRejectionInactModalItem] = useState<PDMItem | null>(null);
  const [rejectionInactReason, setRejectionInactReason] = useState<string>('');

  // 1. New items queue
  const newItemsQueue = useMemo(() => {
    return items.filter((i) => i.status === 'PENDING_REVIEW' || i.status === 'FLAGGED_DUPLICATE');
  }, [items]);

  const counts = useMemo(() => {
    return {
      pending: items.filter((i) => i.status === 'PENDING_REVIEW').length,
      duplicate: items.filter((i) => i.status === 'FLAGGED_DUPLICATE').length,
      approved: items.filter((i) => i.status === 'APPROVED').length,
      rejected: items.filter((i) => i.status === 'REJECTED').length,
      all: items.length,
    };
  }, [items]);

  // Filtered list for new items
  const filteredNewItems = useMemo(() => {
    return items.filter((item) => {
      if (activeStatusTab !== 'ALL' && item.status !== activeStatusTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchCode =
        (item.totvsCode || '').toLowerCase().includes(q) ||
        item.pdmCode.toLowerCase().includes(q);
      const matchDesc =
        item.shortDescription.toLowerCase().includes(q) ||
        (item.originalDescription || '').toLowerCase().includes(q);
      const matchNarr =
        (item.narrative || '').toLowerCase().includes(q) ||
        item.longDescription.toLowerCase().includes(q);
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
        (item.totvsCode || '').toLowerCase().includes(q) ||
        item.pdmCode.toLowerCase().includes(q);
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
      const matchCode = (item.totvsCode || '').toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
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
      const matchCode = (item.totvsCode || '').toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc = item.shortDescription.toLowerCase().includes(q);
      const matchReason = (item.inactivationRequest?.reason || '').toLowerCase().includes(q);
      const matchUser = (item.inactivationRequest?.requestedByUser || '').toLowerCase().includes(q);
      return matchCode || matchDesc || matchReason || matchUser;
    });
  }, [inactivationItems, searchQuery]);

  // Can the current user approve the pending tier?
  const canApproveTierFor = (item: PDMItem, targetTier: ApprovalTierLevel): boolean => {
    if (currentUserRole === 'MASTER_ADMIN') return true;
    if (currentUserTier === 'ALL') return true;
    return currentUserTier === targetTier;
  };

  const handleOpenComparison = (requestedItem: PDMItem) => {
    if (requestedItem.duplicateOfId) {
      const existing = items.find((i) => i.id === requestedItem.duplicateOfId);
      if (existing) {
        setSelectedForCompare({ requested: requestedItem, existing });
        return;
      }
    }
    const fallback = items.find(
      (i) => i.status === 'APPROVED' && (i.specificSubgroupId === requestedItem.specificSubgroupId || i.totvsFamily === requestedItem.totvsFamily)
    );
    if (fallback) {
      setSelectedForCompare({ requested: requestedItem, existing: fallback });
    } else {
      alert('Nenhum item similar aprovado para comparação direta neste subgrupo.');
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectionModalItem) return;
    if (!rejectionReason.trim()) {
      alert('Informe a justificativa técnica para rejeição.');
      return;
    }
    onRejectItem(rejectionModalItem.id, rejectionReason.trim());
    setRejectionModalItem(null);
    setRejectionReason('');
  };

  const handleConfirmChangeRejection = () => {
    if (!rejectionChangeModalItem || !onRejectChangeRequest) return;
    if (!rejectionChangeReason.trim()) {
      alert('Informe a justificativa técnica para rejeição da alteração.');
      return;
    }
    onRejectChangeRequest(rejectionChangeModalItem.id, rejectionChangeReason.trim());
    setRejectionChangeModalItem(null);
    setRejectionChangeReason('');
  };

  const handleConfirmIntegRejection = () => {
    if (!rejectionIntegModalData || !onRejectIntegration) return;
    if (!rejectionIntegReason.trim()) {
      alert('Informe a justificativa técnica para rejeição da integração.');
      return;
    }
    onRejectIntegration(rejectionIntegModalData.item.id, rejectionIntegModalData.requestId, rejectionIntegReason.trim());
    setRejectionIntegModalData(null);
    setRejectionIntegReason('');
  };

  const handleConfirmInactRejection = () => {
    if (!rejectionInactModalItem || !onRejectInactivation) return;
    if (!rejectionInactReason.trim()) {
      alert('Informe a justificativa técnica para rejeição da inativação.');
      return;
    }
    onRejectInactivation(rejectionInactModalItem.id, rejectionInactReason.trim());
    setRejectionInactModalItem(null);
    setRejectionInactReason('');
  };

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
            Esteira corporativa com aprovação multinível por alçada de valor, validação de orçamentos, saneamento cadastral e integrações entre plantas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUserRole === 'MASTER_ADMIN' ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Alçada Global <strong>Master Admin</strong> · Todas as alçadas (Nível 1, 2 e 3)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
              <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                Usuário: <strong>{currentUserName}</strong> · Alçada: <strong>{currentUserTier === 'ALL' ? 'Todas' : `Nível ${currentUserTier || 1}`}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4 CATEGORY TABS (WORKFLOWS) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        {/* TAB 1: NOVOS CADASTROS PDM */}
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
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            activeCategoryTab === 'NEW_ITEMS' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {counts.pending + counts.duplicate}
          </span>
        </button>

        {/* TAB 2: ALTERAÇÕES CADASTRAIS */}
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
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            activeCategoryTab === 'ALTERATION_REQUESTS' ? 'bg-amber-700 text-amber-100' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {alterationItems.length}
          </span>
        </button>

        {/* TAB 3: INTEGRAÇÕES ENTRE ALMOXARIFADOS */}
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
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            activeCategoryTab === 'INTEGRATION_REQUESTS' ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-800 border border-blue-300'
          }`}>
            {integrationItems.length}
          </span>
        </button>

        {/* TAB 4: SOLICITAÇÕES DE INATIVAÇÃO */}
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
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            activeCategoryTab === 'INACTIVATION_REQUESTS' ? 'bg-rose-700 text-rose-100' : 'bg-rose-100 text-rose-800 border border-rose-300'
          }`}>
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
              <span>Pendente de Triagem ({counts.pending})</span>
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
              <span>Aprovados ({counts.approved})</span>
            </button>

            <button
              onClick={() => setActiveStatusTab('REJECTED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeStatusTab === 'REJECTED'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-300'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejeitados ({counts.rejected})</span>
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

      {/* ========================================================================= */}
      {/* 1. SECTION: NOVOS CADASTROS PDM (COM MULTI-ALÇADA E ORÇAMENTO)           */}
      {/* ========================================================================= */}
      {activeCategoryTab === 'NEW_ITEMS' && (
        <div className="space-y-4">
          {filteredNewItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação nesta etapa de saneamento{searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredNewItems.map((item) => {
              const isDuplicate = item.status === 'FLAGGED_DUPLICATE';
              const isPending = item.status === 'PENDING_REVIEW';
              const isApproved = item.status === 'APPROVED';
              const isRejected = item.status === 'REJECTED';

              const workflow = item.approvalWorkflow;
              const pendingTier = workflow?.currentPendingTier || 1;
              const userCanApprove = canApproveTierFor(item, pendingTier);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${
                    isDuplicate
                      ? 'bg-amber-50/50 border-amber-300'
                      : isPending
                      ? 'bg-white border-blue-200'
                      : isApproved
                      ? 'bg-white border-slate-200'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    
                    {/* LEFT: ITEM IDENTITY & DETAILS */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>

                        {isDuplicate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Duplicidade Identificada ({item.similarityScore || 92}%)</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                            <Clock className="w-3 h-3 text-blue-700" />
                            <span>Aguardando Aprovação · Alçada Nível {pendingTier}</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Homologado no Catálogo Mestre</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3 text-rose-700" />
                            <span>Rejeitado pela Governança</span>
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500">
                          solicitado por <strong className="text-slate-700">{item.requestedByUser || 'Solicitante'}</strong> ({item.requestedByTenantName || 'Unidade PremieRpet'})
                        </span>
                      </div>

                      {/* DESCRIPTION & NARRATIVE */}
                      <div className="font-mono text-xs font-bold text-slate-900">
                        {item.shortDescription}
                      </div>

                      <div className="text-xs text-slate-600 leading-relaxed">
                        {item.longDescription}
                      </div>

                      {item.narrative && item.narrative !== item.longDescription && (
                        <div className="text-[11px] text-slate-600 font-mono bg-slate-50 border border-slate-200 rounded p-1.5">
                          <span className="text-emerald-700 font-bold">Narrativa Complementar: </span>
                          {item.narrative}
                        </div>
                      )}

                      {/* 3 NÍVEIS */}
                      {item.nivel1 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            <strong>Nível 1:</strong> {item.nivel1}
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            <strong>Nível 2:</strong> {item.nivel2}
                          </span>
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            <strong>Nível 3:</strong> {item.nivel3}
                          </span>
                        </div>
                      )}

                      {/* ORÇAMENTO ANEXO CARD */}
                      {item.quotation && (
                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5 text-xs text-blue-950">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-blue-900">
                              <DollarSign className="w-3.5 h-3.5 text-blue-700" />
                              <span>Orçamento Anexo Obrigatório</span>
                            </span>
                            <span className="font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-blue-200">
                              R$ {item.quotation.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block">Fornecedor:</span>
                              <strong>{item.quotation.supplierName}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Nº Cotação:</span>
                              <strong className="font-mono">{item.quotation.quoteNumber}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Arquivo Anexo:</span>
                              <span className="inline-flex items-center gap-1 font-mono text-blue-700 font-semibold">
                                <FileText className="w-3 h-3" />
                                {item.quotation.fileName}
                              </span>
                            </div>
                          </div>
                          {item.quotation.notes && (
                            <p className="text-[10px] text-slate-600 italic">
                              "{item.quotation.notes}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* WORKFLOW MULTI-ALÇADA CARD */}
                      {workflow && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-700" />
                              <span>Alçadas de Aprovação por Valor</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {workflow.estimatedValue <= 1000
                                ? 'Até R$ 1.000 (Apenas Nível 1)'
                                : workflow.estimatedValue <= 10000
                                ? 'Até R$ 10.000 (Níveis 1 e 2)'
                                : 'Acima de R$ 10.000 (Níveis 1, 2 e 3)'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {workflow.steps.map((st) => (
                              <div
                                key={st.tier}
                                className={`p-2 rounded-lg border text-xs space-y-1 ${
                                  st.status === 'APPROVED'
                                    ? 'bg-emerald-50 border-emerald-300'
                                    : st.status === 'PENDING'
                                    ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                                    : st.status === 'REJECTED'
                                    ? 'bg-rose-50 border-rose-300'
                                    : 'bg-white border-slate-200 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                                  <span>{st.tierLabel}</span>
                                  <span className={`px-1.5 py-0.2 rounded ${
                                    st.status === 'APPROVED'
                                      ? 'bg-emerald-200 text-emerald-900'
                                      : st.status === 'PENDING'
                                      ? 'bg-amber-200 text-amber-900'
                                      : st.status === 'REJECTED'
                                      ? 'bg-rose-200 text-rose-900'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {st.status === 'APPROVED' ? 'Aprovado' : st.status === 'PENDING' ? 'Pendente' : st.status === 'REJECTED' ? 'Reprovado' : 'Aguardando'}
                                  </span>
                                </div>
                                {st.approvedByUser && (
                                  <div className="text-[10px] text-slate-600">
                                    Por: <strong>{st.approvedByUser}</strong>
                                    {st.approvedAt && ` (${new Date(st.approvedAt).toLocaleDateString('pt-BR')})`}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* REJECTION REASON DISPLAY */}
                      {item.rejectionReason && (
                        <div className="text-[11px] text-rose-700 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                          Motivo da Reprovação: "{item.rejectionReason}"
                        </div>
                      )}
                    </div>

                    {/* RIGHT: WORKFLOW ACTIONS */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                      {onSelectItemDetail && (
                        <button
                          onClick={() => onSelectItemDetail(item)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha</span>
                        </button>
                      )}

                      {(isDuplicate || isPending) && (
                        <button
                          onClick={() => handleOpenComparison(item)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-amber-800 border border-amber-300 text-xs font-semibold shadow-2xs"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Comparar</span>
                        </button>
                      )}

                      {(isPending || isDuplicate) && (
                        <>
                          <button
                            onClick={() => {
                              if (onApproveTier && workflow && workflow.currentPendingTier) {
                                onApproveTier(item.id, workflow.currentPendingTier);
                              } else {
                                onApproveItem(item.id);
                              }
                            }}
                            disabled={!userCanApprove}
                            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                              userCanApprove
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            title={userCanApprove ? `Aprovar Alçada Nível ${pendingTier}` : `Requer permissão de Aprovador Nível ${pendingTier}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {workflow && workflow.requiredTiers.length > 1 && pendingTier < Math.max(...workflow.requiredTiers)
                                ? `Aprovar Nível ${pendingTier}`
                                : 'Aprovar PDM Final'}
                            </span>
                          </button>

                          {currentUserRole === 'MASTER_ADMIN' && (
                            <button
                              onClick={() => setRejectionModalItem(item)}
                              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reprovar</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECTION: SOLICITAÇÕES DE ALTERAÇÃO & SANEAMENTO CADASTRAL             */}
      {/* ========================================================================= */}
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

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-amber-300 bg-amber-50/40 shadow-xs space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Edit3 className="w-3 h-3" />
                          <span>Alteração Cadastral Solicitada</span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          por <strong>{pendingChange.requestedByUser}</strong> ({pendingChange.requestedByTenantName || 'Unidade'}) em {new Date(pendingChange.requestedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-900">
                        {item.shortDescription}
                      </div>

                      {/* JUSTIFICATIVA TÉCNICA */}
                      <div className="p-3 rounded-xl bg-white border border-amber-200 text-xs text-amber-950">
                        <strong className="block text-slate-700 font-semibold mb-1">
                          Justificativa Técnica do Solicitante:
                        </strong>
                        <p className="italic">{pendingChange.reason}</p>
                      </div>

                      {/* DIFF TABLE */}
                      <div className="rounded-xl border border-amber-200 overflow-hidden bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-amber-100/70 font-mono text-[10px] text-amber-950 border-b border-amber-200">
                            <tr>
                              <th className="py-2 px-3">Campo a Modificar</th>
                              <th className="py-2 px-3">Valor Atual no TOTVS</th>
                              <th className="py-2 px-3">Novo Valor Proposto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 text-[11px] font-mono">
                            {pendingChange.changes.map((ch, idx) => (
                              <tr key={idx} className="hover:bg-amber-50/40">
                                <td className="py-2 px-3 font-semibold text-slate-800">{ch.fieldLabel}</td>
                                <td className="py-2 px-3 text-slate-500 line-through truncate max-w-[200px]">{ch.oldValue || '—'}</td>
                                <td className="py-2 px-3 text-emerald-800 font-bold truncate max-w-[250px]">{ch.newValue || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                      {onSelectItemDetail && (
                        <button
                          onClick={() => onSelectItemDetail(item)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha</span>
                        </button>
                      )}

                      {currentUserRole === 'MASTER_ADMIN' && (
                        <>
                          <button
                            onClick={() => onApproveChangeRequest && onApproveChangeRequest(item.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aprovar Alteração</span>
                          </button>

                          <button
                            onClick={() => setRejectionChangeModalItem(item)}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reprovar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECTION: INTEGRAÇÃO ENTRE ALMOXARIFADOS (DOURADO <-> PORTO AMAZONAS)   */}
      {/* ========================================================================= */}
      {activeCategoryTab === 'INTEGRATION_REQUESTS' && (
        <div className="space-y-4">
          {filteredIntegrations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação de integração de item entre almoxarifados pendente{searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredIntegrations.map(({ item, request }) => (
              <div
                key={request.id}
                className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40 shadow-xs space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {item.totvsCode || item.pdmCode}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3 text-blue-700" />
                        <span>Integração entre Plantas</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        solicitado por <strong>{request.requestedByUser}</strong> ({request.requestedByTenantName}) em {new Date(request.requestedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="font-mono text-xs font-bold text-slate-900">
                      {item.shortDescription}
                    </div>

                    {/* ROUTE & STOCK PARAMETERS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="p-2.5 rounded-xl bg-white border border-blue-200">
                        <span className="text-[10px] text-slate-400 font-mono block">Rota da Integração</span>
                        <strong className="text-xs text-blue-900 font-bold flex items-center gap-1 mt-0.5">
                          <span>Estab. {request.sourcePlant}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span>Estab. {request.targetPlant}</span>
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-blue-200">
                        <span className="text-[10px] text-slate-400 font-mono block">Estoque Seguro Solicitado</span>
                        <strong className="text-xs text-emerald-800 font-bold mt-0.5 block font-mono">
                          {request.requestedSafetyStock} {item.unitOfMeasure || 'UN'}
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-blue-200">
                        <span className="text-[10px] text-slate-400 font-mono block">Ponto de Encomenda Sugerido</span>
                        <strong className="text-xs text-slate-800 font-bold mt-0.5 block font-mono">
                          {request.requestedOrderPoint || 1} {item.unitOfMeasure || 'UN'}
                        </strong>
                      </div>
                    </div>

                    {/* JUSTIFICATIVA */}
                    <div className="p-3 rounded-xl bg-white border border-blue-200 text-xs text-blue-950">
                      <strong className="block text-slate-700 font-semibold mb-1">
                        Justificativa Técnica da Integração:
                      </strong>
                      <p className="italic">{request.reason}</p>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                    {onSelectItemDetail && (
                      <button
                        onClick={() => onSelectItemDetail(item)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Ficha</span>
                      </button>
                    )}

                    {currentUserRole === 'MASTER_ADMIN' && (
                      <>
                        <button
                          onClick={() => onApproveIntegration && onApproveIntegration(item.id, request.id)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aprovar Integração</span>
                        </button>

                        <button
                          onClick={() => setRejectionIntegModalData({ item, requestId: request.id })}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reprovar</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECTION: SOLICITAÇÕES DE INATIVAÇÃO / OBSOLESCÊNCIA                   */}
      {/* ========================================================================= */}
      {activeCategoryTab === 'INACTIVATION_REQUESTS' && (
        <div className="space-y-4">
          {filteredInactivations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
              Nenhuma solicitação de inativação ou obsolescência pendente{searchQuery ? ` com o termo "${searchQuery}"` : ''}.
            </div>
          ) : (
            filteredInactivations.map((item) => {
              const req = item.inactivationRequest;
              if (!req) return null;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-rose-300 bg-rose-50/40 shadow-xs space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.totvsCode || item.pdmCode}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                          <Archive className="w-3 h-3 text-rose-700" />
                          <span>Inativação Solicitada</span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          por <strong>{req.requestedByUser}</strong> ({req.requestedByTenantName}) em {new Date(req.requestedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <div className="font-mono text-xs font-bold text-slate-900">
                        {item.shortDescription}
                      </div>

                      {/* JUSTIFICATIVA */}
                      <div className="p-3 rounded-xl bg-white border border-rose-200 text-xs text-rose-950">
                        <strong className="block text-slate-700 font-semibold mb-1">
                          Motivo Técnico para Inativação:
                        </strong>
                        <p className="italic">{req.reason}</p>
                      </div>

                      {req.replacementItemCode && (
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center gap-2 font-mono">
                          <span className="text-slate-500">Item Substituto Sugerido:</span>
                          <strong className="text-emerald-800">{req.replacementItemCode}</strong>
                        </div>
                      )}
                    </div>

                    {/* ACTIONS */}
                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                      {onSelectItemDetail && (
                        <button
                          onClick={() => onSelectItemDetail(item)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha</span>
                        </button>
                      )}

                      {currentUserRole === 'MASTER_ADMIN' && (
                        <>
                          <button
                            onClick={() => onApproveInactivation && onApproveInactivation(item.id)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Aprovar Inativação</span>
                          </button>

                          <button
                            onClick={() => setRejectionInactModalItem(item)}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reprovar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPARISON MODAL                                                         */}
      {/* ========================================================================= */}
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
                {/* SOLICITAÇÃO */}
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

                {/* ITEM EXISTENTE */}
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

              {currentUserRole === 'MASTER_ADMIN' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onLinkDuplicate(selectedForCompare.requested.id, selectedForCompare.existing.id);
                      setSelectedForCompare(null);
                    }}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Unificar & Vincular ao Código {selectedForCompare.existing.totvsCode || selectedForCompare.existing.pdmCode}</span>
                  </button>

                  <button
                    onClick={() => {
                      onApproveItem(selectedForCompare.requested.id);
                      setSelectedForCompare(null);
                    }}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                  >
                    <span>Criar Como Código Novo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODALS */}
      {/* 1. Novo Cadastro Rejection */}
      {rejectionModalItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Reprovar Cadastro PDM</h3>
                <p className="text-[11px] text-slate-500">
                  Item: <span className="font-mono text-slate-900 font-semibold">{rejectionModalItem.pdmCode}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa Técnica da Reprovação <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Item duplicado com código 5040-4488..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Alteração Cadastral Rejection */}
      {rejectionChangeModalItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Reprovar Alteração Cadastral</h3>
                <p className="text-[11px] text-slate-500">
                  Item: <span className="font-mono text-slate-900 font-semibold">{rejectionChangeModalItem.totvsCode || rejectionChangeModalItem.pdmCode}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa Técnica da Reprovação <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionChangeReason}
                onChange={(e) => setRejectionChangeReason(e.target.value)}
                placeholder="Ex: A classificação Nível 2 solicitada não corresponde à família TOTVS..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionChangeModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmChangeRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Integração Rejection */}
      {rejectionIntegModalData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Reprovar Integração entre Plantas</h3>
                <p className="text-[11px] text-slate-500">
                  Item: <span className="font-mono text-slate-900 font-semibold">{rejectionIntegModalData.item.totvsCode || rejectionIntegModalData.item.pdmCode}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo Técnico para Reprovação da Integração <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionIntegReason}
                onChange={(e) => setRejectionIntegReason(e.target.value)}
                placeholder="Ex: A planta destino não possui os equipamentos compatíveis com este material..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionIntegModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmIntegRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Inativação Rejection */}
      {rejectionInactModalItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-slate-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Reprovar Inativação</h3>
                <p className="text-[11px] text-slate-500">
                  Item: <span className="font-mono text-slate-900 font-semibold">{rejectionInactModalItem.totvsCode || rejectionInactModalItem.pdmCode}</span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo Técnico para Manter o Item Ativo <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionInactReason}
                onChange={(e) => setRejectionInactReason(e.target.value)}
                placeholder="Ex: Item ainda é consumido na linha de empacotamento..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectionInactModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmInactRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
