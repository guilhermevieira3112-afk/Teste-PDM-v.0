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
  Search
} from 'lucide-react';
import { PDMItem, PDMStatus, UserRole, Tenant } from '../../types/pdm';

interface GovernanceViewProps {
  items: PDMItem[];
  currentUserRole: UserRole;
  currentTenant: Tenant;
  onApproveItem: (itemId: string) => void;
  onRejectItem: (itemId: string, reason: string) => void;
  onLinkDuplicate: (itemId: string, targetPdmId: string) => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  items,
  currentUserRole,
  currentTenant,
  onApproveItem,
  onRejectItem,
  onLinkDuplicate,
}) => {
  const [activeStatusTab, setActiveStatusTab] = useState<PDMStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForCompare, setSelectedForCompare] = useState<{
    requested: PDMItem;
    existing: PDMItem;
  } | null>(null);

  const [rejectionModalItem, setRejectionModalItem] = useState<PDMItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Count items by status
  const counts = useMemo(() => {
    return {
      pending: items.filter((i) => i.status === 'PENDING_REVIEW').length,
      duplicate: items.filter((i) => i.status === 'FLAGGED_DUPLICATE').length,
      approved: items.filter((i) => i.status === 'APPROVED').length,
      rejected: items.filter((i) => i.status === 'REJECTED').length,
      all: items.length,
    };
  }, [items]);

  // Filtered list with status and cross-referencing search (code, description, narrative)
  const filteredQueue = useMemo(() => {
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
      return matchCode || matchDesc || matchNarr;
    });
  }, [items, activeStatusTab, searchQuery]);

  const handleOpenComparison = (requestedItem: PDMItem) => {
    if (requestedItem.duplicateOfId) {
      const existing = items.find((i) => i.id === requestedItem.duplicateOfId);
      if (existing) {
        setSelectedForCompare({ requested: requestedItem, existing });
        return;
      }
    }
    // Fallback: find any approved item in the same specific subgroup
    const fallback = items.find(
      (i) => i.status === 'APPROVED' && i.specificSubgroupId === requestedItem.specificSubgroupId
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

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER (LIGHT THEME) */}
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
            Esteira corporativa para validação técnica, enriquecimento paramétrico e bloqueio de cadastros duplicados entre Dourado/SP e Porto Amazonas/PR.
          </p>
        </div>

        {currentUserRole !== 'MASTER_ADMIN' && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
            <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              Visão de solicitante da <strong>{currentTenant.name}</strong>. Aprovações são exclusivas do Master Admin.
            </span>
          </div>
        )}
      </div>

      {/* STATUS TABS & SEARCH BAR (LIGHT THEME) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* SEARCH BAR (cross-referencing code, description, narrative) */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar código, descrição ou narrativa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* QUEUE CARDS (LIGHT THEME) */}
      <div className="space-y-3">
        {filteredQueue.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-400 text-xs shadow-xs">
            Nenhuma solicitação nesta etapa de saneamento{searchQuery ? ` com o termo "${searchQuery}"` : ''}.
          </div>
        ) : (
          filteredQueue.map((item) => {
            const isDuplicate = item.status === 'FLAGGED_DUPLICATE';
            const isPending = item.status === 'PENDING_REVIEW';
            const isApproved = item.status === 'APPROVED';
            const isRejected = item.status === 'REJECTED';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all shadow-xs ${
                  isDuplicate
                    ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
                    : isPending
                    ? 'bg-blue-50/40 border-blue-200 hover:border-blue-300'
                    : isApproved
                    ? 'bg-white border-slate-200'
                    : 'bg-rose-50/40 border-rose-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* LEFT: ITEM IDENTITY & DETAILS */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {item.totvsCode || item.pdmCode}
                      </span>

                      {/* STATUS BADGE */}
                      {isDuplicate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Duplicidade Identificada ({item.similarityScore || 92}%)</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                          <Clock className="w-3 h-3 text-blue-700" />
                          <span>Aguardando Triagem Master</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Ativo no Catálogo Mestre</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          <XCircle className="w-3 h-3 text-rose-700" />
                          <span>Rejeitado pela Governança</span>
                        </span>
                      )}

                      {/* SOLICITANTE */}
                      <span className="text-[11px] text-slate-500">
                        solicitado por <strong className="text-slate-700">{item.requestedByUser || 'Master Admin'}</strong> ({item.requestedByTenantName || 'PremieRpet Central'})
                      </span>
                    </div>

                    {/* ERP SHORT DESCRIPTION */}
                    <div className="font-mono text-xs font-bold text-slate-900">
                      {item.shortDescription}
                    </div>

                    {/* TECHNICAL LONG NARRATIVE / NARRATIVE */}
                    <div className="text-xs text-slate-600">
                      {item.longDescription}
                    </div>

                    {/* TOTVS NARRATIVE FIELD IF DISTINCT */}
                    {item.narrative && item.narrative !== item.longDescription && item.narrative !== item.shortDescription && (
                      <div className="text-[11px] text-slate-600 font-mono bg-slate-50 border border-slate-200 rounded p-1.5">
                        <span className="text-emerald-700 font-bold">Narrativa Protheus: </span>
                        {item.narrative}
                      </div>
                    )}

                    {/* NOTES OR REJECTION REASON */}
                    {item.notes && (
                      <div className="text-[11px] text-slate-500 italic">
                        Justificativa: "{item.notes}"
                      </div>
                    )}
                    {item.rejectionReason && (
                      <div className="text-[11px] text-rose-700 font-semibold">
                        Motivo da Rejeição: "{item.rejectionReason}"
                      </div>
                    )}
                  </div>

                  {/* RIGHT: GOVERNANCE WORKFLOW ACTIONS */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    
                    {/* SIDE BY SIDE COMPARISON BUTTON */}
                    {(isDuplicate || isPending) && (
                      <button
                        onClick={() => handleOpenComparison(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-amber-800 border border-amber-300 text-xs font-semibold transition-colors shadow-2xs"
                        title="Comparar lado a lado com item existente no catálogo"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Comparar Lado a Lado</span>
                      </button>
                    )}

                    {/* MASTER ACTIONS */}
                    {currentUserRole === 'MASTER_ADMIN' && (isPending || isDuplicate) && (
                      <>
                        <button
                          onClick={() => onApproveItem(item.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-2xs"
                          title="Aprovar e homologar no catálogo global com PDM definitivo"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aprovar PDM</span>
                        </button>

                        <button
                          onClick={() => setRejectionModalItem(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold transition-colors"
                          title="Reprovar solicitação e registrar parecer"
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

      {/* SIDE-BY-SIDE COMPARISON MODAL (LIGHT THEME) */}
      {selectedForCompare && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
            
            {/* COMPARISON HEADER */}
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

            {/* COMPARISON BODY */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* COLUMN 1: SOLICITAÇÃO (NOVO ITEM) */}
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
                    {selectedForCompare.requested.narrative && (
                      <div className="mt-1.5 p-1.5 rounded bg-white border border-amber-200 text-[10px] font-mono text-slate-600">
                        <strong className="text-amber-800">Narrativa TOTVS:</strong> {selectedForCompare.requested.narrative}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-amber-200">
                    <span className="text-xs font-semibold text-slate-700 block">Atributos Preenchidos:</span>
                    {Object.entries(selectedForCompare.requested.attributes).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-amber-100 font-mono">
                        <span className="text-slate-500">{key}:</span>
                        <span className="text-slate-900 font-semibold">{val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-500 pt-2 border-t border-amber-200">
                    Solicitado por: <strong>{selectedForCompare.requested.requestedByUser}</strong>
                    <br />
                    Unidade: {selectedForCompare.requested.requestedByTenantName}
                  </div>
                </div>

                {/* COLUMN 2: ITEM MESTRE JÁ EXISTENTE */}
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
                    {selectedForCompare.existing.narrative && (
                      <div className="mt-1.5 p-1.5 rounded bg-white border border-emerald-200 text-[10px] font-mono text-slate-600">
                        <strong className="text-emerald-800">Narrativa TOTVS:</strong> {selectedForCompare.existing.narrative}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-emerald-200">
                    <span className="text-xs font-semibold text-slate-700 block">Atributos Oficiais:</span>
                    {Object.entries(selectedForCompare.existing.attributes).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-emerald-100 font-mono">
                        <span className="text-slate-500">{key}:</span>
                        <span className="text-emerald-900 font-semibold">{val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-emerald-800 pt-2 border-t border-emerald-200 font-medium">
                    Status: Cadastrado no ERP TOTVS ({selectedForCompare.existing.totvsPlant || 'Corporativo'}).
                  </div>
                </div>

              </div>

              {/* GOVERNANCE RECOMMENDATION */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Parecer Técnico do Saneamento:</span>
                </div>
                Recomenda-se rejeitar a criação de um novo código e vincular a solicitação ao código TOTVS existente{' '}
                <strong className="font-mono text-emerald-900">{selectedForCompare.existing.totvsCode || selectedForCompare.existing.pdmCode}</strong>, pois representam o mesmo material físico.
              </div>

            </div>

            {/* COMPARISON FOOTER */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedForCompare(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
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
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Unificar & Vincular ao Código {selectedForCompare.existing.totvsCode || selectedForCompare.existing.pdmCode}</span>
                  </button>

                  <button
                    onClick={() => {
                      onApproveItem(selectedForCompare.requested.id);
                      setSelectedForCompare(null);
                    }}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors"
                  >
                    <span>Criar Como Código Novo</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL (LIGHT THEME) */}
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
                Justificativa Técnica da Reprovação
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Item duplicado com código 5040-4488. Ou: Faltam informações de classe de vedação..."
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

    </div>
  );
};
