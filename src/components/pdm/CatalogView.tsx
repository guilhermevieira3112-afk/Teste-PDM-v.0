import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  Plus, 
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sliders,
  X
} from 'lucide-react';
import { PDMItem, UserRole, Tenant, TenantStockItem } from '../../types/pdm';
import { matchTotvsTokens } from '../../utils/totvsSearch';

const DogPawOutlineIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Four outer toes */}
    <ellipse cx="5.5" cy="9.5" rx="1.6" ry="2.2" transform="rotate(-18 5.5 9.5)" />
    <ellipse cx="9.6" cy="6.2" rx="1.6" ry="2.3" transform="rotate(-6 9.6 6.2)" />
    <ellipse cx="14.4" cy="6.2" rx="1.6" ry="2.3" transform="rotate(6 14.4 6.2)" />
    <ellipse cx="18.5" cy="9.5" rx="1.6" ry="2.2" transform="rotate(18 18.5 9.5)" />
    {/* Main metacarpal pad */}
    <path d="M12 11.2c-2.6 0-5.1 2.2-5.1 4.8 0 1.8 1.3 2.9 2.9 2.9.9 0 1.5-.4 2.2-.4s1.3.4 2.2.4c1.6 0 2.9-1.1 2.9-2.9 0-2.6-2.5-4.8-5.1-4.8z" />
  </svg>
);

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
  const [validatedTerms, setValidatedTerms] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<'ALL' | '10' | '14' | 'BOTH'>('ALL');
  const [selectedSituationFilter, setSelectedSituationFilter] = useState<'ALL' | 'Ativo' | 'Obsoleto'>('ALL');
  const [selectedStockFilter, setSelectedStockFilter] = useState<'ALL' | 'WITH_STOCK' | 'ZERO_STOCK'>('ALL');
  const [selectedNivel1Filter, setSelectedNivel1Filter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Set of PDM item IDs already added to the active tenant's stock
  const stockedPdmIds = useMemo(() => {
    return new Set(tenantStocks.filter((s) => s.tenantId === currentTenant.id).map((s) => s.pdmItemId));
  }, [tenantStocks, currentTenant.id]);

  const approvedItems = useMemo(() => {
    return items.filter((item) => item.status === 'APPROVED');
  }, [items]);

  // Unique Nível 1 list for filtering
  const availableNiveis1 = useMemo(() => {
    const set = new Set<string>();
    approvedItems.forEach((i) => {
      if (i.nivel1) set.add(i.nivel1);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [approvedItems]);

  // Combine validated chips + active draft words for strict AND filtering
  const activeSearchTokens = useMemo(() => {
    const draftTokens = searchDraft
      .trim()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const combined: string[] = [];
    for (const term of [...validatedTerms, ...draftTokens]) {
      const lower = term.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        combined.push(term);
      }
    }
    return combined;
  }, [validatedTerms, searchDraft]);

  // Commit draft text into validated search term chip(s)
  const commitDraftTerm = (rawText?: string) => {
    const textToCommit = (rawText !== undefined ? rawText : searchDraft).trim();
    if (!textToCommit) return;

    const newTokens = textToCommit
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (newTokens.length === 0) return;

    setValidatedTerms((prev) => {
      const existingLower = new Set(prev.map((t) => t.toLowerCase()));
      const additions = newTokens.filter((t) => !existingLower.has(t.toLowerCase()));
      return [...prev, ...additions];
    });
    setSearchDraft('');
    searchInputRef.current?.focus();
  };

  const removeValidatedTerm = (indexToRemove: number) => {
    setValidatedTerms((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    searchInputRef.current?.focus();
  };

  const handleClearSearch = () => {
    setValidatedTerms([]);
    setSearchDraft('');
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      if (searchDraft.trim()) {
        e.preventDefault();
        commitDraftTerm();
      }
    } else if (e.key === ' ') {
      if (searchDraft.trim()) {
        e.preventDefault();
        commitDraftTerm();
      }
    } else if (e.key === 'Backspace' && !searchDraft && validatedTerms.length > 0) {
      setValidatedTerms((prev) => prev.slice(0, -1));
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTokens, selectedPlantFilter, selectedSituationFilter, selectedStockFilter, selectedNivel1Filter, pageSize]);

  const filteredItems = useMemo(() => {
    return approvedItems.filter((item) => {
      // Nível 1 Filter (MRO)
      if (selectedNivel1Filter !== 'ALL' && item.nivel1 !== selectedNivel1Filter) {
        return false;
      }

      const e10 = item.establishments?.['10'];
      const e14 = item.establishments?.['14'];
      const plantStr = (item.totvsPlant || '').toLowerCase();
      const belongsTo10 = Boolean(e10) || plantStr.includes('dourado');
      const belongsTo14 = Boolean(e14) || plantStr.includes('paran') || plantStr.includes('porto');

      // Plant / Estabelecimento filter (10 Dourado / 14 Porto Amazonas)
      if (selectedPlantFilter === '10') {
        if (!belongsTo10) return false;
      } else if (selectedPlantFilter === '14') {
        if (!belongsTo14) return false;
      } else if (selectedPlantFilter === 'BOTH') {
        if (!belongsTo10 || !belongsTo14) return false;
      }

      // Situation filter (Ativo vs Obsoleto from Itens.csv)
      if (selectedSituationFilter !== 'ALL') {
        const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
        if (selectedSituationFilter === 'Ativo' && isObsolete) return false;
        if (selectedSituationFilter === 'Obsoleto' && !isObsolete) return false;
      }

      // Stock filter scoped accurately to the selected establishment
      if (selectedStockFilter !== 'ALL') {
        const s10 = e10?.saldoEstoque || 0;
        const s14 = e14?.saldoEstoque || 0;
        let relevantStock = s10 + s14;
        if (selectedPlantFilter === '10') {
          relevantStock = s10;
        } else if (selectedPlantFilter === '14') {
          relevantStock = s14;
        }

        if (selectedStockFilter === 'WITH_STOCK' && relevantStock <= 0) return false;
        if (selectedStockFilter === 'ZERO_STOCK' && relevantStock > 0) return false;
      }

      // Strict AND search across Descrição do Item (60c) + Narrativa do Item (200c) + Código/Família/NCM
      if (activeSearchTokens.length === 0) return true;

      const result = matchTotvsTokens(item, activeSearchTokens);
      return result.isMatch;
    });
  }, [
    approvedItems,
    selectedNivel1Filter,
    selectedPlantFilter,
    selectedSituationFilter,
    selectedStockFilter,
    activeSearchTokens,
  ]);

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

  const showCol10 = selectedPlantFilter !== '14';
  const showCol14 = selectedPlantFilter !== '10';
  const tableColSpan = 6 + (showCol10 ? 1 : 0) + (showCol14 ? 1 : 0);

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
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Campo de consulta de itens, inclusão de itens e novos cadastros
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
            title="Exportar planilha consolidada com os itens da consulta atual"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Exportar consulta atual</span>
          </button>

          <div className="hidden sm:block h-8 w-px bg-slate-200" />

          {/* SEPARATED HIGHLIGHTED ACTION BUTTON: NOVO CADASTRO PDM WITH DOG PAW OUTLINE */}
          <button
            onClick={onOpenPdmBuilder}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-all shadow-md hover:shadow-lg border border-amber-400 ring-2 ring-amber-500/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.75]" />
            <span>Novo Cadastro PDM</span>
            <DogPawOutlineIcon className="w-4 h-4 text-slate-900/75 ml-0.5" />
          </button>
        </div>
      </div>

      {/* SEARCH STRIP (MULTI-TERM VALIDATED CHIPS + FILTERS) */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          
          {/* Main Validated Token Search Input (6 cols) */}
          <div className="lg:col-span-6">
            <div
              onClick={() => searchInputRef.current?.focus()}
              className="min-h-[42px] w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 shadow-2xs flex flex-wrap items-center gap-1.5 cursor-text transition-all"
            >
              <Search className="w-4 h-4 text-slate-400 shrink-0 mr-0.5" />

              {/* Validated Search Term Chips */}
              {validatedTerms.map((term, index) => (
                <span
                  key={`${term}-${index}`}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-mono text-[11px] font-bold shadow-2xs"
                >
                  <Check className="w-3 h-3 text-emerald-600 stroke-[2.75] shrink-0" />
                  <span>{term}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValidatedTerm(index);
                    }}
                    className="p-0.5 rounded hover:bg-emerald-200/70 text-emerald-700 hover:text-emerald-950 transition-colors"
                    title={`Remover termo "${term}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  validatedTerms.length === 0
                    ? 'Digite um termo e valide com ✓ ou Enter (ex: ROLAMENTO)...'
                    : 'Adicionar próximo termo e validar com ✓...'
                }
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1 min-w-[160px] py-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
              />

              {/* Validate Term Check Button */}
              {searchDraft.trim().length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    commitDraftTerm();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition-colors shrink-0 shadow-2xs"
                  title="Validar e fixar termo na pesquisa"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                  <span>Validar</span>
                </button>
              )}

              {/* Clear All Search Terms */}
              {(validatedTerms.length > 0 || searchDraft.length > 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearSearch();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Nível 1 Filter (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={selectedNivel1Filter}
              onChange={(e) => setSelectedNivel1Filter(e.target.value)}
              className="w-full min-h-[42px] py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
            >
              <option value="ALL">Nível 1: Todos ({availableNiveis1.length})</option>
              {availableNiveis1.map((n1) => (
                <option key={n1} value={n1}>
                  {n1}
                </option>
              ))}
            </select>
          </div>

          {/* Estabelecimentos Filter (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={selectedPlantFilter}
              onChange={(e) => setSelectedPlantFilter(e.target.value as 'ALL' | '10' | '14' | 'BOTH')}
              className="w-full min-h-[42px] py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
            >
              <option value="ALL">Estabelecimentos: Ambos</option>
              <option value="10">Estab. 10 · Dourado</option>
              <option value="14">Estab. 14 · Porto Amazonas</option>
              <option value="BOTH">Em Ambas as Plantas</option>
            </select>
          </div>

          {/* Situation Filter (2 cols) */}
          <div className="lg:col-span-2">
            <select
              value={selectedSituationFilter}
              onChange={(e) => setSelectedSituationFilter(e.target.value as 'ALL' | 'Ativo' | 'Obsoleto')}
              className="w-full min-h-[42px] py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
            >
              <option value="ALL">Situação: Todas</option>
              <option value="Ativo">Apenas Ativos</option>
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

          <div className="font-mono text-[10px] text-slate-500">
            Dica: Digite uma palavra, valide com <strong className="text-emerald-700">✓</strong> (ou Enter/Espaço) e adicione outros termos (ex: <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800">✓ ROLAMENTO</code> + <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800">✓ SKF</code>) para cruzar Descrição e Narrativa.
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
                {showCol10 && <th className="py-3 px-4 text-right">Saldo Dourado (10)</th>}
                {showCol14 && <th className="py-3 px-4 text-right">Saldo Paraná (14)</th>}
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum item localizado na base com os filtros selecionados.
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
                        {item.nivel1 && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {item.nivel1}
                            </span>
                            {item.nivel2 && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                › {item.nivel2}
                              </span>
                            )}
                          </div>
                        )}
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
                      {showCol10 && (
                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono">
                          {e10 ? (
                            <span className={`font-semibold ${e10.saldoEstoque > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {e10.saldoEstoque} {item.unitOfMeasure || 'UN'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                      )}

                      {/* SALDO PARANÁ (ESTAB 14) */}
                      {showCol14 && (
                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono">
                          {e14 ? (
                            <span className={`font-semibold ${e14.saldoEstoque > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {e14.saldoEstoque} {item.unitOfMeasure || 'UN'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                      )}

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
