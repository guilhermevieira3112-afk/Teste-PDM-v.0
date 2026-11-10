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
  ExternalLink
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
  initialTab?: 'actions' | 'totvs' | 'pdm';
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  tenantStock,
  currentTenant,
  currentUserRole,
  onAddToStock,
  initialTab = 'actions',
}) => {
  if (!isOpen || !item) return null;

  const [activeModalTab, setActiveModalTab] = useState<'actions' | 'totvs' | 'pdm'>(initialTab);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (field: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
  const e10 = item.establishments?.['10'];
  const e14 = item.establishments?.['14'];

  const totalStockBothPlants = (e10?.saldoEstoque || 0) + (e14?.saldoEstoque || 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
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
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Família: {item.totvsFamily || '5040'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Un: {item.unitOfMeasure || 'UN'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                {item.shortDescription}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveModalTab('actions')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition-all ${
              activeModalTab === 'actions'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Aba Ações & Estoques TOTVS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
              Estab. 10 & 14
            </span>
          </button>

          <button
            onClick={() => setActiveModalTab('totvs')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition-all ${
              activeModalTab === 'totvs'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Ficha Cadastral (60c & 200c)</span>
          </button>

          <button
            onClick={() => setActiveModalTab('pdm')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition-all ${
              activeModalTab === 'pdm'
                ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Parâmetros PDM & Fiscal</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {/* TAB 1: ABA AÇÕES & ESTOQUES POR ESTABELECIMENTO */}
          {activeModalTab === 'actions' && (
            <div className="space-y-4">
              
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
                <div className="text-[11px] text-slate-500">
                  Planta Ativa no Sistema: <strong>{currentTenant.name} ({currentTenant.code})</strong>
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

        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
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
    </div>
  );
};
