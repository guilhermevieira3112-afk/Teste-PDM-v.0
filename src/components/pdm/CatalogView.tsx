import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Layers, 
  Copy, 
  Check, 
  Plus, 
  Download, 
  Building2, 
  Eye, 
  Tag, 
  Hash, 
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sliders,
  Sparkles,
  SlidersHorizontal,
  PackageCheck
} from 'lucide-react';
import { PDMItem, UserRole, Tenant, TenantStockItem } from '../../types/pdm';
import { matchTotvsSearch, SearchLogicMode } from '../../utils/totvsSearch';

interface CatalogViewProps {
  items: PDMItem[];
  currentUserRole: UserRole;
  currentTenant: Tenant;
  tenantStocks: TenantStockItem[];
  onOpenPdmBuilder: () => void;
  onAddToStock: (pdmItem: PDMItem) => void;
  onSelectItemDetail: (pdmItem: PDMItem) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  items,
  currentUserRole,
  currentTenant,
  tenantStocks,
  onOpenPdmBuilder,
  onAddToStock,
  onSelectItemDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLogicMode, setSearchLogicMode] = useState<SearchLogicMode>('AND');
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<'ALL' | '10' | '14' | 'BOTH'>('ALL');
  const [selectedSituationFilter, setSelectedSituationFilter] = useState<'ALL' | 'Ativo' | 'Obsoleto'>('ALL');
  const [selectedStockFilter, setSelectedStockFilter] = useState<'ALL' | 'WITH_STOCK' | 'ZERO_STOCK'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Set of PDM item IDs already added to the active tenant's stock
  const stockedPdmIds = useMemo(() => {
    return new Set(tenantStocks.filter((s) => s.tenantId === currentTenant.id).map((s) => s.pdmItemId));
  }, [tenantStocks, currentTenant.id]);

  const approvedItems = useMemo(() => {
    return items.filter((item) => item.status === 'APPROVED');
  }, [items]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchLogicMode, selectedPlantFilter, selectedSituationFilter, selectedStockFilter, pageSize]);

  const filteredItems = useMemo(() => {
    return approvedItems.filter((item) => {
      // Plant / Estabelecimento filter (10 Dourado / 14 Porto Amazonas)
      if (selectedPlantFilter === '10') {
        if (!item.establishments?.['10']) return false;
      } else if (selectedPlantFilter === '14') {
        if (!item.establishments?.['14']) return false;
      } else if (selectedPlantFilter === 'BOTH') {
        if (!item.establishments?.['10'] || !item.establishments?.['14']) return false;
      }

      // Situation filter (Ativo vs Obsoleto from Itens.csv)
      if (selectedSituationFilter !== 'ALL') {
        const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
        if (selectedSituationFilter === 'Ativo' && isObsolete) return false;
        if (selectedSituationFilter === 'Obsoleto' && !isObsolete) return false;
      }

      // Stock filter
      if (selectedStockFilter !== 'ALL') {
        const s10 = item.establishments?.['10']?.saldoEstoque || 0;
        const s14 = item.establishments?.['14']?.saldoEstoque || 0;
        const total = s10 + s14;
        if (selectedStockFilter === 'WITH_STOCK' && total <= 0) return false;
        if (selectedStockFilter === 'ZERO_STOCK' && total > 0) return false;
      }

      // Smart E/OU search query matching across:
      // Item (Col C), Descrição Item (60c - Col AE), Narrativa (200c - Col AF) e Família (Col B)
      if (!searchTerm.trim()) return true;

      const result = matchTotvsSearch(item, searchTerm, searchLogicMode);
      return result.isMatch;
    });
  }, [approvedItems, selectedPlantFilter, selectedSituationFilter, selectedStockFilter, searchTerm, searchLogicMode]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const handleCopyShortDesc = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = [
      'Item_TOTVS',
      'Familia',
      'Un',
      'Situacao',
      'Descricao_Item_60c',
      'Narrativa_Item_200c',
      'Saldo_Estoque_10_Dourado',
      'Saldo_Estoque_14_Porto_Amazonas',
      'Ponto_Encomenda_10',
      'Ponto_Encomenda_14',
      'Estoque_Seguranca_Almoxarifado_10',
      'Estoque_Seguranca_Almoxarifado_14',
      'Tempo_Ressuprimento_10',
      'Tempo_Ressuprimento_14',
      'Ultima_Entrada_10',
      'Ultima_Saida_10',
      'Ultima_Entrada_14',
      'Ultima_Saida_14'
    ];

    const rows = filteredItems.map((item) => {
      const e10 = item.establishments?.['10'];
      const e14 = item.establishments?.['14'];
      return [
        `"${item.totvsCode || item.pdmCode}"`,
        `"${item.totvsFamily || '5040'}"`,
        `"${item.unitOfMeasure || 'UN'}"`,
        `"${item.situation || 'Ativo'}"`,
        `"${(item.shortDescription || '').replace(/"/g, '""')}"`,
        `"${(item.narrative || '').replace(/"/g, '""')}"`,
        `"${e10?.saldoEstoque ?? 0}"`,
        `"${e14?.saldoEstoque ?? 0}"`,
        `"${e10?.pontoEncomenda ?? 0}"`,
        `"${e14?.pontoEncomenda ?? 0}"`,
        `"${e10?.estoqueSegurancaAlmoxarifado ?? 0}"`,
        `"${e14?.estoqueSegurancaAlmoxarifado ?? 0}"`,
        `"${e10?.tempoRessuprimento ?? 0}"`,
        `"${e14?.tempoRessuprimento ?? 0}"`,
        `"${e10?.ultimaEntrada || ''}"`,
        `"${e10?.ultimaSaida || ''}"`,
        `"${e14?.ultimaEntrada || ''}"`,
        `"${e14?.ultimaSaida || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PremieRpet_Catalogo_Mestre_TOTVS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Catálogo Mestre PDM PremieRpet
            </h2>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {approvedItems.length} Itens Homologados
            </span>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              Base TOTVS CE0348 (Estab. 10 Dourado / 14 Porto Amazonas)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pesquisa integrada com operadores lógicos <strong>E/OU</strong> cruzando <strong>Item TOTVS</strong>, <strong>Descrição Curta (60c)</strong> e <strong>Narrativa Técnica (200c)</strong> com saldos preservados de almoxarifado.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
            title="Exportar planilha consolidada TOTVS com saldos de Dourado e Porto Amazonas"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Exportar CSV (TOTVS)</span>
          </button>

          <button
            onClick={onOpenPdmBuilder}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Cadastro PDM</span>
          </button>
        </div>
      </div>

      {/* SEARCH STRIP WITH E/OU SELECTOR & FILTERS */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          
          {/* Main Search Input with E/OU Logic Mode Toggle (7 cols) */}
          <div className="lg:col-span-7 flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por código (ex: 5040-0001), descrição curta (60c) ou narrativa (200c - Festo, SKF, part number)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
              />
            </div>

            {/* Toggle E / OU */}
            <div className="flex items-center rounded-xl bg-white border border-slate-200 p-1 shadow-2xs shrink-0">
              <button
                onClick={() => setSearchLogicMode('AND')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  searchLogicMode === 'AND'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Lógica E (AND): Todos os termos devem estar presentes na descrição curta, narrativa ou código"
              >
                Lógica E
              </button>
              <button
                onClick={() => setSearchLogicMode('OR')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  searchLogicMode === 'OR'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Lógica OU (OR): Qualquer um dos termos digitados é localizado (ampliando resultados)"
              >
                Lógica OU
              </button>
            </div>
          </div>

          {/* Estabelecimentos Filter (3 cols) */}
          <div className="lg:col-span-3">
            <select
              value={selectedPlantFilter}
              onChange={(e) => setSelectedPlantFilter(e.target.value as any)}
              className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
            >
              <option value="ALL">Estabelecimentos: Ambos (10 & 14)</option>
              <option value="10">Apenas Estab. 10 · Dourado / SP</option>
              <option value="14">Apenas Estab. 14 · Porto Amazonas / PR</option>
              <option value="BOTH">Cadastrado em Ambas as Plantas</option>
            </select>
          </div>

          {/* Situation Filter (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={selectedSituationFilter}
              onChange={(e) => setSelectedSituationFilter(e.target.value as any)}
              className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
            >
              <option value="ALL">Situação: Todas</option>
              <option value="Ativo">Apenas Ativos (Itens.csv)</option>
              <option value="Obsoleto">Totalmente Obsoletos</option>
            </select>
          </div>

        </div>

        {/* HELPER SUB-STRIP: Stock filter and hint */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Filtro de Saldo Físico:</span>
            <button
              onClick={() => setSelectedStockFilter('ALL')}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                selectedStockFilter === 'ALL'
                  ? 'bg-slate-800 text-white border-slate-800 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos os Itens
            </button>
            <button
              onClick={() => setSelectedStockFilter('WITH_STOCK')}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                selectedStockFilter === 'WITH_STOCK'
                  ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              Apenas com Saldo &gt; 0
            </button>
            <button
              onClick={() => setSelectedStockFilter('ZERO_STOCK')}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                selectedStockFilter === 'ZERO_STOCK'
                  ? 'bg-slate-700 text-white border-slate-700 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Saldo Zero (0,00)
            </button>
          </div>

          <div className="font-mono text-[10px] text-slate-400">
            Dica: Digite termos combinados como <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800">ROLAMENTO SKF</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800">VALVULA OU ESFERA</code>
          </div>
        </div>
      </div>

      {/* DENSE TECHNICAL TABLE */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Item (Cód. TOTVS)</th>
                <th className="py-3 px-4">Descrição do Item (60c - Col AE)</th>
                <th className="py-3 px-4">Narrativa Técnica (200c - Col AF)</th>
                <th className="py-3 px-4 text-center">Situação</th>
                <th className="py-3 px-4 text-center">Un</th>
                <th className="py-3 px-4 text-right">Saldo Dourado (10)</th>
                <th className="py-3 px-4 text-right">Saldo Paraná (14)</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum item localizado na base TOTVS CE0348 com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isStockedLocally = stockedPdmIds.has(item.id);
                  const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
                  const e10 = item.establishments?.['10'];
                  const e14 = item.establishments?.['14'];

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isObsolete ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      {/* C - ITEM (CÓDIGO TOTVS) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                          <span>{item.totvsCode || item.pdmCode}</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          Família: {item.totvsFamily || '5040'}
                        </div>
                      </td>

                      {/* AE - DESCRIÇÃO DO ITEM (60 CARACTERES) */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-900 font-semibold tracking-wide">
                            {item.shortDescription}
                          </span>
                          <button
                            onClick={() => handleCopyShortDesc(item.id, item.shortDescription)}
                            className="text-slate-400 hover:text-emerald-700 transition-colors p-1 rounded hover:bg-slate-100 shrink-0"
                            title="Copiar descrição de 60 caracteres para o TOTVS"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* AF - NARRATIVA DO ITEM (200 CARACTERES) */}
                      <td className="py-3 px-4 max-w-sm">
                        {item.narrative ? (
                          <div className="text-[11px] text-slate-700 font-mono line-clamp-2" title={item.narrative}>
                            {item.narrative}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem complemento de narrativa</span>
                        )}
                      </td>

                      {/* I - SITUAÇÃO (ITENS.CSV) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          isObsolete
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {item.situation || 'Ativo'}
                        </span>
                      </td>

                      {/* D - UNIDADE DE MEDIDA */}
                      <td className="py-3 px-4 whitespace-nowrap text-center font-mono font-bold text-slate-700">
                        {item.unitOfMeasure || 'UN'}
                      </td>

                      {/* SALDO DOURADO (ESTAB 10) */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono">
                        {e10 ? (
                          <span className={`font-semibold ${e10.saldoEstoque > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {e10.saldoEstoque} {item.unitOfMeasure || 'UN'}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* SALDO PARANÁ (ESTAB 14) */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono">
                        {e14 ? (
                          <span className={`font-semibold ${e14.saldoEstoque > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {e14.saldoEstoque} {item.unitOfMeasure || 'UN'}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* AÇÕES (COLUNA DE AÇÕES ESPECÍFICAS) */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectItemDetail(item)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200 shadow-2xs"
                            title="Abrir aba de ações com estoque de segurança, ponto de encomenda, lead time e ficha completa"
                          >
                            <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Ações & Ficha</span>
                          </button>

                          {currentUserRole === 'UNIT_MANAGER' && (
                            <button
                              onClick={() => onAddToStock(item)}
                              disabled={isStockedLocally}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                                isStockedLocally
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs'
                              }`}
                              title={isStockedLocally ? 'Item já estocado nesta planta' : 'Vincular ao almoxarifado local'}
                            >
                              <Plus className="w-3 h-3 stroke-[2.5]" />
                              <span>{isStockedLocally ? 'Estocado' : 'Estocar'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER STRIP & PAGINATION */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Exibindo <strong className="text-slate-900 font-mono">{filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> a <strong className="text-slate-900 font-mono">{Math.min(currentPage * pageSize, filteredItems.length)}</strong> de <strong className="text-slate-900 font-mono">{filteredItems.length}</strong> itens filtrados (<span className="text-emerald-700 font-semibold">{approvedItems.length}</span> na base oficial TOTVS)
          </div>

          <div className="flex items-center gap-4">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Primeira página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-mono text-xs font-semibold text-slate-800">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Última página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
