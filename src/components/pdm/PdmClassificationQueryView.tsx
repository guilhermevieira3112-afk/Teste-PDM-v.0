import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Layers, 
  Copy, 
  Check, 
  Download, 
  Eye, 
  Tag, 
  Hash, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Sliders, 
  X, 
  RotateCcw,
  Sparkles,
  ListTree,
  FolderTree,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { PDMItem, UserRole, Tenant } from '../../types/pdm';
import { PdmNivelItem, getNiveis1List, getNiveis2List, getNiveis3List } from '../../data/pdmNiveisData';
import { matchTotvsSearch, SearchLogicMode } from '../../utils/totvsSearch';

interface PdmClassificationQueryViewProps {
  items: PDMItem[];
  currentUserRole: UserRole;
  currentTenant: Tenant;
  niveis: PdmNivelItem[];
  onSelectItemDetail: (pdmItem: PDMItem) => void;
  onOpenEdit?: (pdmItem: PDMItem) => void;
  onOpenPdmBuilder?: () => void;
}

export const PdmClassificationQueryView: React.FC<PdmClassificationQueryViewProps> = ({
  items,
  currentUserRole,
  currentTenant,
  niveis,
  onSelectItemDetail,
  onOpenEdit,
  onOpenPdmBuilder,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLogicMode, setSearchLogicMode] = useState<SearchLogicMode>('AND');
  const [selectedN1, setSelectedN1] = useState<string>('ALL');
  const [selectedN2, setSelectedN2] = useState<string>('ALL');
  const [selectedN3, setSelectedN3] = useState<string>('ALL');
  const [selectedSituationFilter, setSelectedSituationFilter] = useState<'ALL' | 'Ativo' | 'Obsoleto'>('ALL');
  const [selectedOriginFilter, setSelectedOriginFilter] = useState<'ALL' | 'PDM_HOMOLOGADO' | 'TOTVS_SEM_CLASSIFICACAO'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Approved items only in catalog
  const approvedItems = useMemo(() => {
    return items.filter((item) => item.status === 'APPROVED');
  }, [items]);

  // Derived classification options from current niveis
  const niveis1Options = useMemo(() => {
    const fromNiveis = getNiveis1List(niveis);
    if (fromNiveis.length > 0) return fromNiveis;
    const set = new Set<string>();
    approvedItems.forEach((i) => {
      if (i.nivel1) set.add(i.nivel1);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [niveis, approvedItems]);

  const niveis2Options = useMemo(() => {
    if (selectedN1 === 'ALL') {
      const set = new Set<string>();
      approvedItems.forEach((i) => {
        if (i.nivel2) set.add(i.nivel2);
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    const fromNiveis = getNiveis2List(niveis, selectedN1);
    if (fromNiveis.length > 0) return fromNiveis;
    const set = new Set<string>();
    approvedItems.forEach((i) => {
      if (i.nivel1 === selectedN1 && i.nivel2) set.add(i.nivel2);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [niveis, approvedItems, selectedN1]);

  const niveis3Options = useMemo(() => {
    if (selectedN1 === 'ALL' && selectedN2 === 'ALL') {
      const set = new Set<string>();
      approvedItems.forEach((i) => {
        if (i.nivel3) set.add(i.nivel3);
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
    if (selectedN1 !== 'ALL' && selectedN2 !== 'ALL') {
      const fromNiveis = getNiveis3List(niveis, selectedN1, selectedN2);
      if (fromNiveis.length > 0) return fromNiveis;
    }
    const set = new Set<string>();
    approvedItems.forEach((i) => {
      if (
        (selectedN1 === 'ALL' || i.nivel1 === selectedN1) &&
        (selectedN2 === 'ALL' || i.nivel2 === selectedN2) &&
        i.nivel3
      ) {
        set.add(i.nivel3);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [niveis, approvedItems, selectedN1, selectedN2]);

  // Counts of items per Nivel 1 for quick navigation badges
  const n1ItemCounts = useMemo(() => {
    const map = new Map<string, number>();
    approvedItems.forEach((i) => {
      if (i.nivel1) {
        map.set(i.nivel1, (map.get(i.nivel1) || 0) + 1);
      }
    });
    return map;
  }, [approvedItems]);

  // Handle Nivel 1 change
  const handleSelectN1 = (val: string) => {
    setSelectedN1(val);
    setSelectedN2('ALL');
    setSelectedN3('ALL');
  };

  // Handle Nivel 2 change
  const handleSelectN2 = (val: string) => {
    setSelectedN2(val);
    setSelectedN3('ALL');
  };

  // Origin breakdown counts (homologados vs cadastrados direto no TOTVS sem saneamento)
  const unclassifiedCount = useMemo(() => {
    return approvedItems.filter((i) => i.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' || i.isClassified === false).length;
  }, [approvedItems]);

  const classifiedCount = useMemo(() => {
    return approvedItems.filter((i) => i.classificationOrigin !== 'TOTVS_SEM_CLASSIFICACAO' && i.isClassified !== false).length;
  }, [approvedItems]);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchLogicMode, selectedN1, selectedN2, selectedN3, selectedSituationFilter, selectedOriginFilter, pageSize]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedN1('ALL');
    setSelectedN2('ALL');
    setSelectedN3('ALL');
    setSelectedSituationFilter('ALL');
    setSelectedOriginFilter('ALL');
  };

  const hasActiveFilters = 
    searchTerm.trim() !== '' || 
    selectedN1 !== 'ALL' || 
    selectedN2 !== 'ALL' || 
    selectedN3 !== 'ALL' || 
    selectedSituationFilter !== 'ALL' ||
    selectedOriginFilter !== 'ALL';

  // Filter items
  const filteredItems = useMemo(() => {
    return approvedItems.filter((item) => {
      // 1. Nível 1 Filter
      if (selectedN1 !== 'ALL' && item.nivel1 !== selectedN1) {
        return false;
      }

      // 2. Nível 2 Filter
      if (selectedN2 !== 'ALL' && item.nivel2 !== selectedN2) {
        return false;
      }

      // 3. Nível 3 Filter
      if (selectedN3 !== 'ALL' && item.nivel3 !== selectedN3) {
        return false;
      }

      // 4. Situation Filter
      if (selectedSituationFilter !== 'ALL') {
        const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
        if (selectedSituationFilter === 'Ativo' && isObsolete) return false;
        if (selectedSituationFilter === 'Obsoleto' && !isObsolete) return false;
      }

      // 5. Origin Filter (Homologado PDM vs Direto TOTVS sem classificação)
      if (selectedOriginFilter === 'PDM_HOMOLOGADO') {
        if (item.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' || item.isClassified === false) return false;
      } else if (selectedOriginFilter === 'TOTVS_SEM_CLASSIFICACAO') {
        if (item.classificationOrigin !== 'TOTVS_SEM_CLASSIFICACAO' && item.isClassified !== false) return false;
      }

      // 6. Text Search (E / OU logic across item code, description 60c, narrative 200c, family)
      if (!searchTerm.trim()) return true;

      const result = matchTotvsSearch(item, searchTerm, searchLogicMode);
      return result.isMatch;
    });
  }, [approvedItems, selectedN1, selectedN2, selectedN3, selectedSituationFilter, selectedOriginFilter, searchTerm, searchLogicMode]);

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
      'Origem_Cadastro',
      'Nivel_1_Grupo_Macro',
      'Nivel_2_Subgrupo_Familia',
      'Nivel_3_Subgrupo_Especifico',
      'Descricao_Item_60c',
      'Narrativa_Item_200c',
      'Situacao',
      'Unidade_Medida'
    ];

    const rows = filteredItems.map((item) => [
      `"${item.totvsCode || item.pdmCode}"`,
      `"${item.totvsFamily || '5040'}"`,
      `"${item.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' ? 'Direto TOTVS (Sem Saneamento)' : 'Homologado PDM'}"`,
      `"${item.nivel1 || ''}"`,
      `"${item.nivel2 || ''}"`,
      `"${item.nivel3 || ''}"`,
      `"${(item.shortDescription || '').replace(/"/g, '""')}"`,
      `"${(item.narrative || '').replace(/"/g, '""')}"`,
      `"${item.situation || 'Ativo'}"`,
      `"${item.unitOfMeasure || 'UN'}"`
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Consulta_Classificacao_PDM_PremieRpet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      
      {/* ALERTA DE ITENS CADASTRADOS DIRETOS NO TOTVS SEM CLASSIFICAÇÃO PDM */}
      {unclassifiedCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 border border-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                  Auditoria de Governança
                </span>
                <span className="text-xs font-mono font-bold text-amber-950">
                  {unclassifiedCount.toLocaleString('pt-BR')} itens diretos do TOTVS pendentes de saneamento
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1">
                Foram identificados itens cadastrados diretamente no Protheus sem aprovação prévia e sem os 3 níveis MRO. Use o filtro abaixo para localizá-los e clique em <strong>Classificar</strong> para enviar à Fila de Governança.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedOriginFilter === 'TOTVS_SEM_CLASSIFICACAO' ? (
              <button
                onClick={() => setSelectedOriginFilter('ALL')}
                className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors shadow-2xs"
              >
                Mostrar Todos os Itens
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedOriginFilter('TOTVS_SEM_CLASSIFICACAO');
                  setSelectedN1('ALL');
                  setSelectedN2('ALL');
                  setSelectedN3('ALL');
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Ver Pendentes de Classificação ({unclassifiedCount})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. HERO & PURPOSE BANNER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <ListTree className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  Consulta Geral para Todos os Usuários
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Base Oficial MRO Padronizada
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight mt-1">
                Consulta por Classificação PDM (3 Níveis MRO)
              </h2>
              <p className="text-xs text-slate-500">
                Explore o catálogo completo organizado por Grupo Macro (Nível 1), Subgrupo/Família (Nível 2) e Subgrupo Específico (Nível 3).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all"
              title="Exportar registros filtrados em CSV com a árvore de classificação"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar Consulta CSV</span>
            </button>

            {onOpenPdmBuilder && (
              <button
                onClick={onOpenPdmBuilder}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Novo PDM</span>
              </button>
            )}
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Itens Encontrados</span>
            <strong className="text-base font-bold text-emerald-900">
              {filteredItems.length.toLocaleString('pt-BR')}
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Origem PDM</span>
            <div className="text-xs font-bold mt-0.5 truncate">
              {selectedOriginFilter === 'ALL' && <span className="text-slate-700">Todas as Origens</span>}
              {selectedOriginFilter === 'PDM_HOMOLOGADO' && <span className="text-emerald-700">Homologados ({classifiedCount})</span>}
              {selectedOriginFilter === 'TOTVS_SEM_CLASSIFICACAO' && <span className="text-amber-700">Pendente TOTVS ({unclassifiedCount})</span>}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Nível 1 Ativo</span>
            <span className="text-xs font-bold text-slate-800 truncate block">
              {selectedN1 === 'ALL' ? 'Todos os 16 Grupos' : selectedN1}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Nível 2 Ativo</span>
            <span className="text-xs font-bold text-slate-800 truncate block">
              {selectedN2 === 'ALL' ? `Todos (${niveis2Options.length})` : selectedN2}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Nível 3 Ativo</span>
            <span className="text-xs font-bold text-emerald-800 truncate block">
              {selectedN3 === 'ALL' ? `Todos (${niveis3Options.length})` : selectedN3}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CASCADING CLASSIFICATION FILTER STRIP */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        
        {/* ROW 1: TEXT SEARCH & E/OU TOGGLE & SELECTORS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Pesquisar por Código TOTVS (ex: 5040-0001), Descrição 60c ou Narrativa 200c..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 font-medium"
              />
            </div>

            {/* E / OU Mode Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200 p-1 shadow-2xs shrink-0">
              <button
                onClick={() => setSearchLogicMode('AND')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  searchLogicMode === 'AND'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Lógica E: Todos os termos pesquisados devem estar no item"
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
                title="Lógica OU: Qualquer um dos termos pesquisados é localizado"
              >
                Lógica OU
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
            {/* Origin Filter */}
            <select
              value={selectedOriginFilter}
              onChange={(e) => setSelectedOriginFilter(e.target.value as any)}
              className="flex-1 min-w-[170px] py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white font-semibold shadow-2xs"
            >
              <option value="ALL">Origem: Todas ({approvedItems.length})</option>
              <option value="PDM_HOMOLOGADO">Homologado via PDM ({classifiedCount})</option>
              <option value="TOTVS_SEM_CLASSIFICACAO">Direto TOTVS · Pendente ({unclassifiedCount})</option>
            </select>

            {/* Situation Filter */}
            <select
              value={selectedSituationFilter}
              onChange={(e) => setSelectedSituationFilter(e.target.value as any)}
              className="w-36 py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white font-semibold shadow-2xs"
            >
              <option value="ALL">Situação: Todas</option>
              <option value="Ativo">Apenas Ativos</option>
              <option value="Obsoleto">Obsoletos</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0"
                title="Limpar todos os filtros de pesquisa e classificação"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: THE 3 CASCADING LEVEL SELECTORS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Nível 1 · Grupo Macro */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                <span>Nível 1 · Grupo Macro Industrial</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {niveis1Options.length} grupos
              </span>
            </div>
            <select
              value={selectedN1}
              onChange={(e) => handleSelectN1(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
            >
              <option value="ALL">Todos os Grupos Macro (Nível 1)</option>
              {niveis1Options.map((n1) => (
                <option key={n1} value={n1}>
                  {n1} ({n1ItemCounts.get(n1) || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Nível 2 · Subgrupo / Família */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                <span>Nível 2 · Subgrupo / Família</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {niveis2Options.length} subgrupos
              </span>
            </div>
            <select
              value={selectedN2}
              onChange={(e) => handleSelectN2(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-semibold shadow-2xs"
            >
              <option value="ALL">
                {selectedN1 === 'ALL' ? 'Todos os Subgrupos (Nível 2)' : `Todos os Subgrupos de ${selectedN1}`}
              </option>
              {niveis2Options.map((n2) => (
                <option key={n2} value={n2}>
                  {n2}
                </option>
              ))}
            </select>
          </div>

          {/* Nível 3 · Subgrupo Específico */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                <span>Nível 3 · Subgrupo Específico</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {niveis3Options.length} específicos
              </span>
            </div>
            <select
              value={selectedN3}
              onChange={(e) => setSelectedN3(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 font-semibold shadow-2xs"
            >
              <option value="ALL">
                {selectedN2 === 'ALL' ? 'Todos os Específicos (Nível 3)' : `Todos de ${selectedN2}`}
              </option>
              {niveis3Options.map((n3) => (
                <option key={n3} value={n3}>
                  {n3}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* QUICK PILLS FOR NÍVEL 1 CATEGORIES */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Acesso Rápido por Grupo Macro:</span>
            {selectedN1 !== 'ALL' && (
              <button
                onClick={() => handleSelectN1('ALL')}
                className="text-emerald-700 hover:underline cursor-pointer"
              >
                Ver todos
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => handleSelectN1('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all ${
                selectedN1 === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({approvedItems.length.toLocaleString('pt-BR')})
            </button>
            {niveis1Options.map((n1) => {
              const count = n1ItemCounts.get(n1) || 0;
              const isSelected = selectedN1 === n1;
              return (
                <button
                  key={n1}
                  onClick={() => handleSelectN1(isSelected ? 'ALL' : n1)}
                  className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{n1}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. DENSE TECHNICAL TABLE (SEM COLUNAS DE SALDO) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Item (Cód. TOTVS)</th>
                <th className="py-3 px-3 text-center">Origem PDM</th>
                <th className="py-3 px-3">Nível 1 · Grupo Macro</th>
                <th className="py-3 px-3">Nível 2 · Subgrupo / Família</th>
                <th className="py-3 px-3">Nível 3 · Subgrupo Específico</th>
                <th className="py-3 px-4">Descrição do Item (60c - Col AE)</th>
                <th className="py-3 px-4">Narrativa Técnica (200c - Col AF)</th>
                <th className="py-3 px-3 text-center">Situação</th>
                <th className="py-3 px-3 text-center">Un</th>
                <th className="py-3 px-4 text-center">Ações & Governança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum item localizado na classificação PDM com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isObsolete = item.situation?.toLowerCase().includes('obsoleto');
                  const isUnclassified = item.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' || item.isClassified === false;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isUnclassified ? 'bg-amber-50/20' : isObsolete ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      {/* C - ITEM (CÓDIGO TOTVS) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-emerald-800 text-xs flex items-center gap-1.5">
                          <span>{item.totvsCode || item.pdmCode}</span>
                          {item.pendingChange && (
                            <span 
                              className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold"
                              title="Solicitação de alteração cadastral em análise na Fila de Governança"
                            >
                              Alteração Pendente
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          Família: {item.totvsFamily || '5040'}
                        </div>
                      </td>

                      {/* ORIGEM / STATUS PDM */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isUnclassified ? (
                          <span 
                            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300"
                            title="Item cadastrado diretamente no TOTVS Protheus sem prévia classificação ou saneamento PDM"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Direto TOTVS</span>
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200"
                            title="Item saneado e homologado pelo PDM PremieRpet"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Homologado</span>
                          </span>
                        )}
                      </td>

                      {/* NÍVEL 1: GRUPO MACRO */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                          isUnclassified 
                            ? 'text-amber-900 bg-amber-50 border-amber-200' 
                            : 'text-emerald-900 bg-emerald-50 border-emerald-200'
                        }`}>
                          {item.nivel1 || 'Pendente de Classificação'}
                        </span>
                      </td>

                      {/* NÍVEL 2: SUBGRUPO / FAMÍLIA */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-block text-[11px] font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.nivel2 || item.totvsFamily || 'Geral'}
                        </span>
                      </td>

                      {/* NÍVEL 3: SUBGRUPO ESPECÍFICO */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-block text-[11px] font-mono font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {item.nivel3 || 'Item Homologado'}
                        </span>
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
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {item.shortDescription.length} / 60c
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
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          isObsolete
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {item.situation || 'Ativo'}
                        </span>
                      </td>

                      {/* D - UNIDADE DE MEDIDA */}
                      <td className="py-3 px-3 whitespace-nowrap text-center font-mono font-bold text-slate-700">
                        {item.unitOfMeasure || 'UN'}
                      </td>

                      {/* AÇÕES / FICHA & GOVERNANÇA */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectItemDetail(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs transition-colors shadow-2xs"
                            title="Abrir Ficha de Informações do Item com os 3 Níveis MRO e Estoques"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Ficha</span>
                          </button>

                          {onOpenEdit && (
                            <button
                              onClick={() => onOpenEdit(item)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-2xs ${
                                isUnclassified
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                              }`}
                              title={
                                isUnclassified
                                  ? 'Classificar os 3 níveis MRO deste item pendente e submeter para governança'
                                  : 'Editar classificação de níveis, descrições, NCM ou foto do item'
                              }
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isUnclassified ? 'Classificar' : 'Editar'}</span>
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

        {/* PAGINATION FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>Mostrando</span>
            <span className="font-mono font-bold text-slate-900">
              {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            <span>a</span>
            <span className="font-mono font-bold text-slate-900">
              {Math.min(currentPage * pageSize, filteredItems.length)}
            </span>
            <span>de</span>
            <span className="font-mono font-bold text-slate-900">
              {filteredItems.length.toLocaleString('pt-BR')}
            </span>
            <span>itens</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span>Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono font-semibold text-xs focus:outline-none focus:border-emerald-600"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1 font-mono">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100"
                title="Primeira página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-800">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100"
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
