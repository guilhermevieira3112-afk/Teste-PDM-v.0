import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Building2, 
  Package, 
  ShieldCheck, 
  Layers, 
  Clock, 
  ArrowDownRight, 
  ArrowUpRight, 
  Tag, 
  FileText,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ExternalLink,
  MapPin,
  History,
  Edit3,
  ArrowRight,
  DollarSign,
  ArrowRightLeft,
  Archive,
  Paperclip,
  Lock
} from 'lucide-react';
import { PDMItem, TenantStockItem, Tenant, UserRole } from '../../types/pdm';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PDMItem | null;
  tenantStock?: TenantStockItem | null;
  currentTenant: Tenant;
  currentUserRole: UserRole;
  onAddToStock?: (pdmItem: PDMItem) => void;
  onOpenEdit?: (pdmItem: PDMItem) => void;
  onRequestIntegration?: (item: PDMItem, data: {
    sourcePlant: string;
    targetPlant: string;
    requestedSafetyStock: number;
    requestedOrderPoint?: number;
    reason: string;
  }) => void;
  onRequestInactivation?: (item: PDMItem, data: {
    reason: string;
    replacementItemCode?: string;
  }) => void;
  initialTab?: 'actions' | 'totvs' | 'pdm' | 'history';
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  tenantStock,
  currentTenant,
  currentUserRole,
  onAddToStock,
  onOpenEdit,
  onRequestIntegration,
  onRequestInactivation,
  initialTab = 'actions',
}) => {
  if (!isOpen || !item) return null;

  const [activeModalTab, setActiveModalTab] = useState<'actions' | 'totvs' | 'pdm' | 'history'>(initialTab);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modals for Integration and Inactivation
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [integSourcePlant, setIntegSourcePlant] = useState<'10' | '14'>('10');
  const [integTargetPlant, setIntegTargetPlant] = useState<'10' | '14'>('14');
  const [integSafetyStock, setIntegSafetyStock] = useState<number>(5);
  const [integOrderPoint, setIntegOrderPoint] = useState<number>(2);
  const [integReason, setIntegReason] = useState<string>('');
  const [integError, setIntegError] = useState<string | null>(null);

  const [isInactivationModalOpen, setIsInactivationModalOpen] = useState(false);
  const [inactReason, setInactReason] = useState<string>('');
  const [inactReplacement, setInactReplacement] = useState<string>('');
  const [inactError, setInactError] = useState<string | null>(null);

  const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
  const hasPendingInactivation = item.inactivationRequest?.status === 'PENDING';
  const isAlreadyInactivated = isObsolete || item.inactivationRequest?.status === 'APPROVED';

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmitIntegration = () => {
    setIntegError(null);
    if (!integReason.trim()) {
      setIntegError('Informe a justificativa técnica para solicitação de integração entre almoxarifados.');
      return;
    }
    if (!integSafetyStock || Number(integSafetyStock) < 1) {
      setIntegError('Informe uma quantidade válida de estoque seguro para a unidade de destino.');
      return;
    }
    if (onRequestIntegration) {
      onRequestIntegration(item, {
        sourcePlant: integSourcePlant,
        targetPlant: integTargetPlant,
        requestedSafetyStock: Number(integSafetyStock) || 1,
        requestedOrderPoint: Number(integOrderPoint) || 1,
        reason: integReason.trim(),
      });
    }
    setIsIntegrationModalOpen(false);
    setIntegReason('');
    setIntegError(null);
  };

  const handleSubmitInactivation = () => {
    setInactError(null);
    if (hasPendingInactivation) {
      setInactError('Já existe uma solicitação de inativação em andamento para este item.');
      return;
    }
    if (isAlreadyInactivated) {
      setInactError('Este item já encontra-se inativado / Totalmente Obsoleto.');
      return;
    }
    if (!inactReason.trim()) {
      setInactError('Informe a justificativa técnica para solicitação de inativação.');
      return;
    }
    if (onRequestInactivation) {
      onRequestInactivation(item, {
        reason: inactReason.trim(),
        replacementItemCode: inactReplacement.trim() || undefined,
      });
    }
    setIsInactivationModalOpen(false);
    setInactReason('');
    setInactReplacement('');
    setInactError(null);
  };

  const e10 = item.establishments?.['10'];
  const e14 = item.establishments?.['14'];
  const originSafetyStock = item.establishments?.[integSourcePlant]?.estoqueSegurancaAlmoxarifado ?? 0;

  const totalStockBothPlants = (e10?.saldoEstoque || 0) + (e14?.saldoEstoque || 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isObsolete ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isObsolete ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Item TOTVS: {item.totvsCode || item.pdmCode}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isObsolete
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {item.situation || 'Ativo'}
                </span>
                {item.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Direto TOTVS · Não Classificado
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Classificado PDM
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Família: {item.totvsFamily || '5040'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Un: {item.unitOfMeasure || 'UN'}
                </span>
                {item.nivel1 && (
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {item.nivel1}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                {item.shortDescription}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onOpenEdit && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEdit(item);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-all active:scale-95"
                title="Editar Classificação dos 3 Níveis, Descrição, Narrativa, NCM e Foto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Item</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="shrink-0 flex items-end border-b border-slate-200 bg-slate-100/80 px-6 pt-3 gap-2 text-xs font-medium overflow-x-auto min-h-[54px]">
          <button
            onClick={() => setActiveModalTab('actions')}
            className={`flex items-center gap-2 py-3 px-4 min-h-[44px] border-b-2 font-semibold transition-all shrink-0 ${
              activeModalTab === 'actions'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Aba Ações & Estoques TOTVS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Estab. 10 & 14
            </span>
          </button>

          <button
            onClick={() => setActiveModalTab('totvs')}
            className={`flex items-center gap-2 py-3 px-4 min-h-[44px] border-b-2 font-semibold transition-all shrink-0 ${
              activeModalTab === 'totvs'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Ficha Cadastral (60c & 200c)</span>
          </button>

          <button
            onClick={() => setActiveModalTab('pdm')}
            className={`flex items-center gap-2 py-3 px-4 min-h-[44px] border-b-2 font-semibold transition-all shrink-0 ${
              activeModalTab === 'pdm'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Parâmetros PDM & Fiscal</span>
          </button>

          <button
            onClick={() => setActiveModalTab('history')}
            className={`flex items-center gap-2 py-3 px-4 min-h-[44px] border-b-2 font-semibold transition-all shrink-0 ${
              activeModalTab === 'history'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>Histórico & Auditoria</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
              {item.changeHistory?.length || 0}
            </span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {/* CALLOUT: ITEM CADASTRADO DIRETO NO TOTVS */}
          {item.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-bold text-amber-950">
                    Item Cadastrado Diretamente no TOTVS (Pendente de Saneamento PDM)
                  </strong>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                    Este item foi gerado no ERP Protheus sem aprovação prévia de governança e sem classificação dos 3 níveis MRO.
                  </p>
                </div>
              </div>
              {onOpenEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenEdit(item);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-2xs transition-colors whitespace-nowrap"
                >
                  Classificar Item Agora
                </button>
              )}
            </div>
          )}
          
          {/* TAB 1: ABA AÇÕES & ESTOQUES POR ESTABELECIMENTO */}
          {activeModalTab === 'actions' && (
            <div className="space-y-4">
              
              {/* CLASSIFICAÇÃO MRO DOS NÍVEIS (Classificacao_Almoxarifado_MRO_Padronizado) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-900 text-xs">
                      Classificação Almoxarifado MRO (Estrutura de 3 Níveis)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Padronizado PremieRpet
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-mono block">Nível 1 · Grupo Macro</span>
                    <strong className="text-xs text-slate-900 font-semibold block truncate">
                      {item.nivel1 || 'Mecânica e Transmissão'}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-mono block">Nível 2 · Subgrupo / Família</span>
                    <strong className="text-xs text-slate-900 font-semibold block truncate">
                      {item.nivel2 || item.totvsFamily || 'Elementos de Fixação'}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-mono block">Nível 3 · Subgrupo Específico</span>
                    <strong className="text-xs text-emerald-800 font-bold block truncate">
                      {item.nivel3 || 'Item Homologado'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* SUMMARY BANNER */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-500">
                    Posição Consolidada PremieRpet
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                    <span>Saldo Total nas Unidades:</span>
                    <span className="font-mono text-emerald-800 text-base">
                      {totalStockBothPlants} {item.unitOfMeasure || 'UN'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span>Planta Ativa: <strong>{currentTenant.name} ({currentTenant.code})</strong></span>
                  {tenantStock?.wmsAddress && (
                    <span className="font-mono text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-bold">
                      <MapPin className="w-3 h-3 text-blue-600" />
                      <span>Posição WMS: {tenantStock.wmsAddress}</span>
                    </span>
                  )}
                  {tenantStock?.wmsStock !== undefined && (
                    <span className="font-mono text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px]">
                      Saldo WMS: <strong>{tenantStock.wmsStock} {item.unitOfMeasure || 'UN'}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* ESTABELECIMENTOS 10 E 14 COMPARATIVE CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* ESTABELECIMENTO 10: DOURADO/SP */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-mono font-bold text-xs flex items-center justify-center">
                        10
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Estabelecimento 10</h4>
                        <span className="text-[11px] text-slate-500">Unidade Dourado / SP</span>
                      </div>
                    </div>
                    {e10 ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Ativo em Dourado
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        Sem cadastro 10
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans">Saldo Estoque (Atual):</span>
                      <strong className={`text-sm ${
                        (e10?.saldoEstoque || 0) > 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}>
                        {e10?.saldoEstoque ?? 0} {item.unitOfMeasure || 'UN'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans" title="Lote mínimo para compra">
                        Ponto Encomenda (Lote Mínimo):
                      </span>
                      <span className="font-semibold text-slate-800">
                        {e10?.pontoEncomenda ?? 0} {item.unitOfMeasure || 'UN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans">
                        Estoque de segurança almoxarifado:
                      </span>
                      <span className="font-semibold text-emerald-800">
                        {e10?.estoqueSegurancaAlmoxarifado ?? 0} {item.unitOfMeasure || 'UN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tempo Ressuprimento (Lead Time):</span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        {e10?.tempoRessuprimento ?? 0} dias
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Última Entrada:</span>
                      </span>
                      <span className="text-slate-700 font-medium">
                        {e10?.ultimaEntrada || 'Sem registro'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 font-sans flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                        <span>Última Saída:</span>
                      </span>
                      <span className="text-slate-700 font-medium">
                        {e10?.ultimaSaida || 'Sem registro'}
                      </span>
                    </div>
                  </div>

                  {currentUserRole === 'UNIT_MANAGER' && currentTenant.id === 'dourado-sp' && onAddToStock && (
                    <button
                      onClick={() => {
                        onClose();
                        onAddToStock(item);
                      }}
                      className="w-full mt-2 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Atualizar Almoxarifado Dourado (10)</span>
                    </button>
                  )}
                </div>

                {/* ESTABELECIMENTO 14: PORTO AMAZONAS/PR */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 font-mono font-bold text-xs flex items-center justify-center">
                        14
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Estabelecimento 14</h4>
                        <span className="text-[11px] text-slate-500">Unidade Porto Amazonas / PR</span>
                      </div>
                    </div>
                    {e14 ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Ativo em Porto Amazonas
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        Sem cadastro 14
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans">Saldo Estoque (Atual):</span>
                      <strong className={`text-sm ${
                        (e14?.saldoEstoque || 0) > 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}>
                        {e14?.saldoEstoque ?? 0} {item.unitOfMeasure || 'UN'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans" title="Lote mínimo para compra">
                        Ponto Encomenda (Lote Mínimo):
                      </span>
                      <span className="font-semibold text-slate-800">
                        {e14?.pontoEncomenda ?? 0} {item.unitOfMeasure || 'UN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans">
                        Estoque de segurança almoxarifado:
                      </span>
                      <span className="font-semibold text-emerald-800">
                        {e14?.estoqueSegurancaAlmoxarifado ?? 0} {item.unitOfMeasure || 'UN'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tempo Ressuprimento (Lead Time):</span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        {e14?.tempoRessuprimento ?? 0} dias
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-sans flex items-center gap-1">
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Última Entrada:</span>
                      </span>
                      <span className="text-slate-700 font-medium">
                        {e14?.ultimaEntrada || 'Sem registro'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 font-sans flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                        <span>Última Saída:</span>
                      </span>
                      <span className="text-slate-700 font-medium">
                        {e14?.ultimaSaida || 'Sem registro'}
                      </span>
                    </div>
                  </div>

                  {currentUserRole === 'UNIT_MANAGER' && currentTenant.id === 'porto-amazonas-pr' && onAddToStock && (
                    <button
                      onClick={() => {
                        onClose();
                        onAddToStock(item);
                      }}
                      className="w-full mt-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Atualizar Almoxarifado Porto Amazonas (14)</span>
                    </button>
                  )}
                </div>

              </div>

              {/* GOVERNANCE ACTIONS STRIP: INTEGRAÇÃO ENTRE ALMOXARIFADOS & INATIVAÇÃO */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-900 text-xs">
                      Ações de Governança & Fila Master para este Item
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Aprovação Centralizada Master
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* BOTÃO INTEGRAÇÃO ENTRE ALMOXARIFADOS */}
                  <div className="p-3.5 rounded-xl bg-white border border-blue-200 space-y-2 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-blue-700 shrink-0" />
                        <strong className="text-xs text-slate-900">Integração entre Almoxarifados</strong>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Solicite a parametrização e vinculação deste item à outra unidade (Dourado/SP ↔ Porto Amazonas/PR) informando a quantidade segura de estoque.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const target = currentTenant.id === 'porto-amazonas-pr' ? '14' : '10';
                        const source = target === '14' ? '10' : '14';
                        setIntegTargetPlant(target);
                        setIntegSourcePlant(source);
                        setIntegError(null);
                        setIsIntegrationModalOpen(true);
                      }}
                      className="w-full mt-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Solicitar Integração de Almoxarifado</span>
                    </button>
                  </div>

                  {/* BOTÃO INATIVAÇÃO / OBSOLESCÊNCIA */}
                  <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-2 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-rose-700 shrink-0" />
                        <strong className="text-xs text-slate-900">Solicitar Inativação do Item</strong>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Submeta para a fila de governança a solicitação de inativação/obsolescência deste material com justificativa técnica.
                      </p>
                      {hasPendingInactivation && item.inactivationRequest && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-950 flex items-start gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          <span>
                            Solicitação em andamento por <strong>{item.inactivationRequest.requestedByUser}</strong>. Aguardando análise da Governança Master; não é permitido abrir outra solicitação.
                          </span>
                        </div>
                      )}
                      {!hasPendingInactivation && isAlreadyInactivated && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0 mt-0.5" />
                          <span>Item já inativado / classificado como Totalmente Obsoleto.</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={hasPendingInactivation || isAlreadyInactivated}
                      onClick={() => {
                        if (hasPendingInactivation || isAlreadyInactivated) return;
                        setInactError(null);
                        setIsInactivationModalOpen(true);
                      }}
                      className={`w-full mt-2 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs ${
                        hasPendingInactivation || isAlreadyInactivated
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {hasPendingInactivation ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Inativação em Andamento</span>
                        </>
                      ) : isAlreadyInactivated ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Item Já Inativado</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>Solicitar Inativação do Item</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: FICHA CADASTRAL TOTVS (60c & 200c) */}
          {activeModalTab === 'totvs' && (
            <div className="space-y-4">
              
              {/* DESCRIÇÃO CURTA ERP (MÁX 60 CARACTERES) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="font-semibold text-slate-800">
                    Descrição do Item (Coluna AE - Máximo 60 caracteres TOTVS):
                  </span>
                  <span className="font-mono text-emerald-800 font-bold">
                    {item.shortDescription.length} / 60c
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-emerald-950 font-bold text-xs select-all">
                  <span>{item.shortDescription}</span>
                  <button
                    onClick={() => handleCopy('short', item.shortDescription)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-700 transition-colors px-2 py-0.5 rounded hover:bg-slate-100 shrink-0"
                    title="Copiar descrição de 60c para o TOTVS"
                  >
                    {copiedField === 'short' ? <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'short' ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* NARRATIVA DO ITEM (COLUNA AF - ATÉ 200 CARACTERES) */}
              <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-emerald-950">
                      Narrativa do Item (Coluna AF - Complemento de Narrativa até 200 caracteres):
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                      Indexado Busca E/OU
                    </span>
                  </div>
                  <span className="font-mono text-emerald-800 font-bold">
                    {(item.narrative || '').length} / 200c
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-white border border-emerald-200 font-mono text-slate-900 text-xs select-all">
                  <span className="leading-relaxed">
                    {item.narrative || <em className="text-slate-400">Sem complemento de narrativa cadastrado no TOTVS.</em>}
                  </span>
                  {item.narrative && (
                    <button
                      onClick={() => handleCopy('narrative', item.narrative || '')}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-700 transition-colors px-2 py-0.5 rounded hover:bg-slate-100 shrink-0 mt-0.5"
                      title="Copiar narrativa de 200c para o TOTVS"
                    >
                      {copiedField === 'narrative' ? <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'narrative' ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* DADOS CADASTRAIS COMPLEMENTARES */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Código TOTVS (Item)</span>
                  <strong className="text-xs font-mono text-emerald-900">{item.totvsCode || item.pdmCode}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Família (Col B)</span>
                  <strong className="text-xs font-mono text-slate-800">{item.totvsFamily || '5040'}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Unidade (Col D)</span>
                  <strong className="text-xs font-mono text-slate-800">{item.unitOfMeasure || 'UN'}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Valor Unitário Base</span>
                  <strong className="text-xs font-mono text-slate-800">
                    {item.baseValue && item.baseValue > 0
                      ? `R$ ${item.baseValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Sob Consulta'}
                  </strong>
                </div>
              </div>

              {/* NÍVEIS MRO NA FICHA */}
              <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-2">
                <span className="text-[11px] font-mono font-bold text-emerald-900 block">
                  Classificação Estruturada MRO (Padronização PremieRpet):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-[10px] text-slate-400 font-mono block">Nível 1 (Macro)</span>
                    <span className="text-xs font-semibold text-slate-800">{item.nivel1 || 'Mecânica e Transmissão'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-[10px] text-slate-400 font-mono block">Nível 2 (Subgrupo)</span>
                    <span className="text-xs font-semibold text-slate-800">{item.nivel2 || item.totvsFamily || 'Elementos de Fixação'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-emerald-200">
                    <span className="text-[10px] text-slate-400 font-mono block">Nível 3 (Específico)</span>
                    <span className="text-xs font-bold text-emerald-800">{item.nivel3 || 'Item Homologado'}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: PARÂMETROS PDM & FISCAL */}
          {activeModalTab === 'pdm' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="block font-semibold text-slate-700">
                  Narrativa Técnica Formatada PDM (Engenharia & Confiabilidade):
                </span>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 leading-relaxed font-mono">
                  {item.longDescription || item.shortDescription}
                </div>
              </div>

              {/* CLASSIFICAÇÃO FISCAL E ATRIBUTOS */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Parâmetro / Atributo</th>
                      <th className="py-2.5 px-3">Especificação Técnica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr className="bg-slate-50/70">
                      <td className="py-2 px-3 text-slate-500">Classificação Fiscal (NCM)</td>
                      <td className="py-2 px-3 text-emerald-800 font-bold">{item.ncm || '8482.10.10'}</td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <td className="py-2 px-3 text-slate-500">Código UNSPSC</td>
                      <td className="py-2 px-3 text-slate-700">{item.unspsc || '31171504'}</td>
                    </tr>
                    {Object.entries(item.attributes || {}).map(([key, val]) => (
                      <tr key={key} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500 font-medium capitalize">{key.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3 text-slate-900 font-semibold">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: HISTÓRICO & AUDITORIA DE ALTERAÇÕES */}
          {activeModalTab === 'history' && (
            <div className="space-y-4">
              
              {/* ORÇAMENTO ANEXADO (SE DISPONÍVEL) */}
              {item.quotation && (
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-700" />
                      <strong className="text-xs font-bold text-blue-950">
                        Orçamento & Proposta Comercial Anexa
                      </strong>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                      Cotação Homologada
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] text-slate-400 font-mono block">Fornecedor Cotado</span>
                      <strong className="text-slate-900 font-semibold">{item.quotation.supplierName}</strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] text-slate-400 font-mono block">Nº Cotação / Orçamento</span>
                      <strong className="text-blue-900 font-mono">{item.quotation.quoteNumber}</strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                      <span className="text-[10px] text-slate-400 font-mono block">Valor Estimado Base</span>
                      <strong className="text-emerald-800 font-mono">
                        R$ {item.quotation.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-100 text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-600" />
                      <span className="font-mono text-slate-800 text-[11px] font-semibold">{item.quotation.fileName}</span>
                      {item.quotation.fileSize && (
                        <span className="text-[10px] text-slate-400 font-mono">({item.quotation.fileSize})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">
                      Documento Arquivado
                    </span>
                  </div>

                  {item.quotation.notes && (
                    <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded border border-blue-100">
                      {item.quotation.notes}
                    </p>
                  )}
                </div>
              )}

              {/* MATRIZ DE APROVAÇÃO MULTI-ALÇADA POR VALOR */}
              {item.approvalWorkflow && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <strong className="text-xs font-bold text-slate-900">
                        Esteira de Alçadas de Aprovação por Valor (Governança PremieRpet)
                      </strong>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.approvalWorkflow.requiredTiers.length} alçada(s) requerida(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {item.approvalWorkflow.steps.map((st) => (
                      <div 
                        key={st.tier} 
                        className={`p-3 rounded-xl border space-y-1.5 ${
                          st.status === 'APPROVED'
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : st.status === 'PENDING'
                            ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                            : st.status === 'REJECTED'
                            ? 'bg-rose-50 border-rose-300'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase">
                            Alçada {st.tier}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            st.status === 'APPROVED'
                              ? 'bg-emerald-200/80 text-emerald-900'
                              : st.status === 'PENDING'
                              ? 'bg-amber-200/80 text-amber-900'
                              : st.status === 'REJECTED'
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {st.status === 'APPROVED' ? 'Aprovado' : st.status === 'PENDING' ? 'Pendente' : st.status === 'REJECTED' ? 'Reprovado' : 'Aguardando'}
                          </span>
                        </div>
                        <strong className="text-xs text-slate-800 block truncate">{st.tierLabel}</strong>
                        {st.approvedByUser && (
                          <div className="text-[10px] text-slate-600">
                            Aprovador: <strong>{st.approvedByUser}</strong>
                            {st.approvedAt && <div className="text-slate-400 font-mono">{new Date(st.approvedAt).toLocaleDateString('pt-BR')}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HISTÓRICO DE INTEGRAÇÕES ENTRE ALMOXARIFADOS */}
              {item.integrationRequests && item.integrationRequests.length > 0 && (
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                      <span>Solicitações de Integração entre Almoxarifados</span>
                    </span>
                    <span className="text-[10px] font-mono text-blue-800">
                      {item.integrationRequests.length} registro(s)
                    </span>
                  </div>
                  <div className="space-y-2 pt-1">
                    {item.integrationRequests.map((integ) => (
                      <div key={integ.id} className="p-2.5 rounded-lg bg-white border border-blue-200 text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-900">
                            Estabelecimento {integ.sourcePlant} ➔ Estabelecimento {integ.targetPlant}
                          </span>
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                            integ.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : integ.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {integ.status === 'APPROVED' ? 'Integrado' : integ.status === 'REJECTED' ? 'Rejeitado' : 'Em Análise'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Estoque de Segurança Solicitado: <strong>{integ.requestedSafetyStock} {item.unitOfMeasure || 'UN'}</strong>
                          {integ.requestedOrderPoint && ` · Ponto de Encomenda: ${integ.requestedOrderPoint}`}
                        </div>
                        <div className="text-[10px] text-slate-500 italic">
                          "{integ.reason}" - por {integ.requestedByUser} em {new Date(integ.requestedAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SOLICITAÇÃO DE INATIVAÇÃO (SE HOUVER) */}
              {item.inactivationRequest && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-2 text-rose-950">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-rose-900">
                      <Archive className="w-4 h-4 text-rose-700" />
                      <span>Solicitação de Inativação / Obsolescência</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                      {item.inactivationRequest.status === 'APPROVED' ? 'Inativado' : item.inactivationRequest.status === 'REJECTED' ? 'Recusado' : 'Aguardando Master'}
                    </span>
                  </div>
                  <p className="text-xs italic bg-white/80 p-2 rounded border border-rose-200">
                    "{item.inactivationRequest.reason}"
                  </p>
                  <div className="text-[10px] text-rose-800 font-mono flex items-center justify-between">
                    <span>Solicitante: {item.inactivationRequest.requestedByUser}</span>
                    <span>Data: {new Date(item.inactivationRequest.requestedAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}

              {/* PENDING CHANGE CALLOUT (SE HOUVER SOLICITAÇÃO NA FILA) */}
              {item.pendingChange && (
                <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-700 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-amber-950">
                            Solicitação de Alteração em Análise
                          </strong>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200/70 text-amber-900 border border-amber-300">
                            Fila de Governança
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-800">
                          Solicitado por <strong>{item.pendingChange.requestedByUser}</strong> ({item.pendingChange.requestedByTenantName || 'Unidade'}) em {new Date(item.pendingChange.requestedAt).toLocaleDateString('pt-BR')} às {new Date(item.pendingChange.requestedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200 text-[11px] text-amber-950">
                    <strong className="font-semibold block text-slate-700 mb-0.5">Justificativa técnica:</strong>
                    <p className="italic">{item.pendingChange.reason}</p>
                  </div>

                  <div className="rounded-lg border border-amber-200 overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-100/60 font-mono text-[10px] text-amber-950 border-b border-amber-200">
                        <tr>
                          <th className="py-1.5 px-3">Campo a Alterar</th>
                          <th className="py-1.5 px-3">Valor Atual</th>
                          <th className="py-1.5 px-3">Novo Valor Proposto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-[11px] font-mono">
                        {item.pendingChange.changes.map((ch, idx) => (
                          <tr key={idx} className="bg-amber-50/30">
                            <td className="py-2 px-3 font-semibold text-slate-700">{ch.fieldLabel}</td>
                            <td className="py-2 px-3 text-slate-500 line-through truncate max-w-[150px]">{ch.oldValue || '—'}</td>
                            <td className="py-2 px-3 text-emerald-800 font-bold truncate max-w-[200px]">{ch.newValue || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TIMELINE DE REVISÕES / AUDITORIA */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-700" />
                    <h4 className="font-bold text-slate-900 text-xs">
                      Trilha de Auditoria & Alterações Cadastrais (PremieRpet Governance)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {item.changeHistory?.length || 0} registro(s) auditado(s)
                  </span>
                </div>

                {(!item.changeHistory || item.changeHistory.length === 0) ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Nenhuma alteração cadastral registrada</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Este item permanece com os dados originais importados da carga TOTVS.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {item.changeHistory.map((rev) => (
                      <div 
                        key={rev.id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              rev.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : rev.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {rev.status === 'APPROVED' ? 'Aprovado & Efetivado' : rev.status === 'REJECTED' ? 'Rejeitado pela Governança' : 'Pendente'}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {rev.requestedByUser}
                            </span>
                            {rev.requestedByTenantName && (
                              <span className="text-[10px] text-slate-500">
                                ({rev.requestedByTenantName})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {new Date(rev.timestamp).toLocaleDateString('pt-BR')} às {new Date(rev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* JUSTIFICATIVA */}
                        {rev.reason && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <strong className="text-slate-700 font-semibold">Justificativa técnica: </strong>
                            <span>{rev.reason}</span>
                          </div>
                        )}

                        {/* REJEIÇÃO */}
                        {rev.rejectionReason && (
                          <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                            <strong className="text-rose-800 font-semibold">Motivo da Rejeição: </strong>
                            <span>{rev.rejectionReason}</span>
                          </div>
                        )}

                        {/* APROVADOR */}
                        {rev.approvedByUser && (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              Aprovador Master: <strong>{rev.approvedByUser}</strong>
                              {rev.approvedAt && ` em ${new Date(rev.approvedAt).toLocaleDateString('pt-BR')}`}
                            </span>
                          </div>
                        )}

                        {/* TABELA DE DIFF */}
                        {rev.changes && rev.changes.length > 0 && (
                          <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="py-1 px-2.5">Campo Alterado</th>
                                  <th className="py-1 px-2.5">Valor Anterior</th>
                                  <th className="py-1 px-2.5">Novo Valor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                                {rev.changes.map((ch, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="py-1.5 px-2.5 font-semibold text-slate-700">{ch.fieldLabel}</td>
                                    <td className="py-1.5 px-2.5 text-slate-500 line-through truncate max-w-[150px]">{ch.oldValue || '—'}</td>
                                    <td className="py-1.5 px-2.5 text-emerald-800 font-bold truncate max-w-[200px]">{ch.newValue || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            TOTVS Protheus · Base Oficial CE0348 & Itens
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Fechar Ficha
          </button>
        </div>

      </div>

      {/* MODAL 1: SOLICITAR INTEGRAÇÃO ENTRE ALMOXARIFADOS */}
      {isIntegrationModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Solicitar Integração de Item entre Almoxarifados
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    Código: <strong className="text-slate-900">{item.totvsCode || item.pdmCode}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIntegrationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {integError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{integError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-950 font-medium">
                Esta solicitação será submetida à <strong>Fila de Governança Master</strong> para aprovação corporativa e parametrização exclusiva na unidade de destino.
              </div>

              {/* Plant selection (automatically kept distinct) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Unidade de Origem
                  </label>
                  <select
                    value={integSourcePlant}
                    onChange={(e) => {
                      const nextSource = e.target.value as '10' | '14';
                      setIntegSourcePlant(nextSource);
                      setIntegTargetPlant(nextSource === '10' ? '14' : '10');
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-semibold"
                  >
                    <option value="10">Estabelecimento 10 (Dourado/SP)</option>
                    <option value="14">Estabelecimento 14 (Porto Amazonas/PR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Unidade de Destino
                  </label>
                  <select
                    value={integTargetPlant}
                    onChange={(e) => {
                      const nextTarget = e.target.value as '10' | '14';
                      setIntegTargetPlant(nextTarget);
                      setIntegSourcePlant(nextTarget === '10' ? '14' : '10');
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-semibold text-blue-900"
                  >
                    <option value="14">Estabelecimento 14 (Porto Amazonas/PR)</option>
                    <option value="10">Estabelecimento 10 (Dourado/SP)</option>
                  </select>
                </div>
              </div>

              {/* Estoque Seguro: Origem (somente leitura) vs Destino (editável) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Estoque Seguro Origem (Estab. {integSourcePlant})
                    </label>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      <Lock className="w-2.5 h-2.5" /> Fixo
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={`${originSafetyStock} ${item.unitOfMeasure || 'UN'}`}
                    className="w-full text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 font-mono font-bold cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Não é permitido alterar o estoque seguro da unidade de origem.
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200 space-y-1.5">
                  <label className="block text-[11px] font-semibold text-blue-950">
                    Estoque Seguro Destino (Estab. {integTargetPlant}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={integSafetyStock}
                    onChange={(e) => setIntegSafetyStock(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-blue-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-[10px] text-blue-800 block">
                    Quantidade segura solicitada em {item.unitOfMeasure || 'UN'} para o destino.
                  </span>
                </div>
              </div>

              {/* Ponto de Encomenda da Unidade de Destino */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Ponto de Encomenda Sugerido para o Destino (Estab. {integTargetPlant})
                </label>
                <input
                  type="number"
                  min={1}
                  value={integOrderPoint}
                  onChange={(e) => setIntegOrderPoint(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Justificativa */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Justificativa Técnica da Integração <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={integReason}
                  onChange={(e) => setIntegReason(e.target.value)}
                  placeholder="Ex: Item padronizado em Dourado que passará a ser utilizado na manutenção preventiva das extrusoras da planta Paraná..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsIntegrationModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitIntegration}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Enviar para Governança Master</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SOLICITAR INATIVAÇÃO / OBSOLESCÊNCIA */}
      {isInactivationModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Solicitar Inativação / Obsolescência do Item
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    Código: <strong className="text-slate-900">{item.totvsCode || item.pdmCode}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInactivationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inactError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{inactError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-950 font-medium">
                Esta solicitação passará pela <strong>Fila de Governança Master</strong>. Se aprovada, o status do item será alterado para <strong>Totalmente Obsoleto</strong> no ERP TOTVS e catálogo PDM.
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Justificativa Técnica para Inativação <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={inactReason}
                  onChange={(e) => setInactReason(e.target.value)}
                  placeholder="Ex: Item descontinuado pelo fabricante OEM ou substituído por versão blindada..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Código do Item Substituto Sugerido (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5040-0042 ou PDM-00129"
                  value={inactReplacement}
                  onChange={(e) => setInactReplacement(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsInactivationModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={hasPendingInactivation || isAlreadyInactivated}
                onClick={handleSubmitInactivation}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Enviar Solicitação de Inativação</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
