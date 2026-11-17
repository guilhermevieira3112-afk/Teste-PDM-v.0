import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Building2,
  History,
  Plus,
  DollarSign,
  MapPin,
  ArrowRightLeft,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Check,
  Layers,
} from 'lucide-react';
import { TenantStockItem, PDMItem, StockMovement, Tenant, UserRole, CriticismLevel } from '../../types/pdm';
import { MovementModal } from './MovementModal';

interface InventoryViewProps {
  tenantStocks: TenantStockItem[];
  pdmItems: PDMItem[];
  movements: StockMovement[];
  currentTenant: Tenant;
  currentUserRole: UserRole;
  wmsSyncLabels?: {
    'dourado-sp'?: string;
    'porto-amazonas-pr'?: string;
  };
  initialViewMode?: 'unit' | 'audit';
  onClearInitialViewMode?: () => void;
  onRegisterMovement: (movement: Omit<StockMovement, 'id'>) => void;
  onSelectItemDetail: (pdmItem: PDMItem) => void;
  onOpenCatalog: () => void;
}

interface MergedAuditItem {
  pdmItem: PDMItem;
  itemCode: string;
  familia: string;
  un: string;
  descricao60c: string;
  narrativa200c: string;
  situacao: 'Ativo' | 'Totalmente Obsoleto';
  saldo10: number;
  saldo14: number;
  totalSaldo: number;
  saldoWms10: number;
  enderecoWms10: string;
  saldoWms14: number;
  enderecoWms14: string;
  divergencia10: number;
  divergencia14: number;
  hasObsoleteWithStockAlert: boolean;
  hasDivergenceAlert: boolean;
  pontoEncomenda10: number;
  pontoEncomenda14: number;
  estoqueSeguranca10: number;
  estoqueSeguranca14: number;
  leadTime10: number;
  leadTime14: number;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  tenantStocks,
  pdmItems,
  movements,
  currentTenant,
  wmsSyncLabels,
  initialViewMode,
  onClearInitialViewMode,
  onRegisterMovement,
  onSelectItemDetail,
  onOpenCatalog,
}) => {
  const [viewMode, setViewMode] = useState<'unit' | 'audit'>(initialViewMode || 'unit');

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
      if (onClearInitialViewMode) onClearInitialViewMode();
    }
  }, [initialViewMode, onClearInitialViewMode]);

  // Unit Warehouse Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [criticismFilter, setCriticismFilter] = useState<'ALL' | CriticismLevel>('ALL');
  const [situationFilter, setSituationFilter] = useState<'ALL' | 'ACTIVE' | 'OBSOLETE' | 'OBSOLETE_WITH_STOCK'>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL' | 'DIVERGENT' | 'ALIGNED'>('ALL');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Consolidated 4-Base Audit Filters (moved from TotvsImportView)
  const [auditFilter, setAuditFilter] = useState<
    'all' | 'active' | 'divergent' | 'obsolete' | 'obsolete-with-stock'
  >('all');
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');
  const [auditPage, setAuditPage] = useState<number>(1);

  // Active movement modal item
  const [movementModalData, setMovementModalData] = useState<{
    stockItem: TenantStockItem;
    pdmItem: PDMItem;
  } | null>(null);

  // Map of PDM items
  const pdmMap = useMemo(() => new Map(pdmItems.map((p) => [p.id, p])), [pdmItems]);

  // Current tenant's stocks
  const currentStocks = useMemo(() => {
    return tenantStocks.filter((s) => s.tenantId === currentTenant.id);
  }, [tenantStocks, currentTenant.id]);

  // Fast stock lookup maps across both plants for consolidated 4-base audit
  const stockMap10 = useMemo(() => {
    const map = new Map<string, TenantStockItem>();
    tenantStocks
      .filter((s) => s.tenantId === 'dourado-sp')
      .forEach((s) => {
        map.set(s.pdmItemId, s);
      });
    return map;
  }, [tenantStocks]);

  const stockMap14 = useMemo(() => {
    const map = new Map<string, TenantStockItem>();
    tenantStocks
      .filter((s) => s.tenantId === 'porto-amazonas-pr')
      .forEach((s) => {
        map.set(s.pdmItemId, s);
      });
    return map;
  }, [tenantStocks]);

  // Current tenant's movements
  const currentMovements = useMemo(() => {
    return movements
      .filter((m) => m.tenantId === currentTenant.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, currentTenant.id]);

  // Filtered stocks (Local Unit View)
  const filteredStocks = useMemo(() => {
    return currentStocks.filter((stock) => {
      const pdm = pdmMap.get(stock.pdmItemId);
      if (!pdm) return false;

      const isObsolete = pdm.situation?.toLowerCase().includes('obsoleto') || stock.status === 'INACTIVE';
      if (situationFilter === 'ACTIVE' && isObsolete) return false;
      if (situationFilter === 'OBSOLETE' && !isObsolete) return false;

      const totvs = stock.totvsStock ?? stock.currentStock ?? 0;
      const wms = stock.wmsStock ?? 0;
      const isLow = totvs <= stock.minimumStock;
      const isDivergent = Math.abs(totvs - wms) > 0.001;

      if (situationFilter === 'OBSOLETE_WITH_STOCK' && (!isObsolete || (totvs <= 0 && wms <= 0))) return false;
      if (criticismFilter !== 'ALL' && stock.criticism !== criticismFilter) return false;
      if (stockStatusFilter === 'LOW' && !isLow) return false;
      if (stockStatusFilter === 'NORMAL' && isLow) return false;
      if (stockStatusFilter === 'DIVERGENT' && !isDivergent) return false;
      if (stockStatusFilter === 'ALIGNED' && isDivergent) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const addrMatch =
        (stock.wmsAddress && stock.wmsAddress.toLowerCase().includes(term)) ||
        (stock.storageLocation && stock.storageLocation.toLowerCase().includes(term));

      return (
        stock.internalCode.toLowerCase().includes(term) ||
        (pdm.totvsCode && pdm.totvsCode.toLowerCase().includes(term)) ||
        pdm.pdmCode.toLowerCase().includes(term) ||
        pdm.shortDescription.toLowerCase().includes(term) ||
        (pdm.originalDescription && pdm.originalDescription.toLowerCase().includes(term)) ||
        (pdm.narrative && pdm.narrative.toLowerCase().includes(term)) ||
        (pdm.longDescription && pdm.longDescription.toLowerCase().includes(term)) ||
        addrMatch
      );
    });
  }, [currentStocks, pdmMap, criticismFilter, situationFilter, stockStatusFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, criticismFilter, situationFilter, stockStatusFilter, currentTenant.id]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditFilter, auditSearchTerm]);

  // Unit KPIs
  const activeCount = useMemo(() => {
    return currentStocks.filter((s) => {
      const pdm = pdmMap.get(s.pdmItemId);
      const isObsolete = pdm?.situation?.toLowerCase().includes('obsoleto') || s.status === 'INACTIVE';
      return !isObsolete;
    }).length;
  }, [currentStocks, pdmMap]);

  const obsoleteCount = useMemo(() => {
    return currentStocks.filter((s) => {
      const pdm = pdmMap.get(s.pdmItemId);
      return pdm?.situation?.toLowerCase().includes('obsoleto') || s.status === 'INACTIVE';
    }).length;
  }, [currentStocks, pdmMap]);

  const obsoleteWithStockCount = useMemo(() => {
    return currentStocks.filter((s) => {
      const pdm = pdmMap.get(s.pdmItemId);
      const isObsolete = pdm?.situation?.toLowerCase().includes('obsoleto') || s.status === 'INACTIVE';
      const totvs = s.totvsStock ?? s.currentStock ?? 0;
      const wms = s.wmsStock ?? 0;
      return isObsolete && (totvs > 0 || wms > 0);
    }).length;
  }, [currentStocks, pdmMap]);

  const totalLockedCapitalTotvs = useMemo(() => {
    return currentStocks.reduce((sum, s) => sum + (s.totvsStock ?? s.currentStock) * s.unitCost, 0);
  }, [currentStocks]);

  const totalSKUs = currentStocks.length;

  const lowStockCount = useMemo(() => {
    return currentStocks.filter((s) => (s.totvsStock ?? s.currentStock) <= s.minimumStock).length;
  }, [currentStocks]);

  const divergentStockCount = useMemo(() => {
    return currentStocks.filter((s) => {
      const totvs = s.totvsStock ?? s.currentStock ?? 0;
      const wms = s.wmsStock ?? 0;
      return Math.abs(totvs - wms) > 0.001;
    }).length;
  }, [currentStocks]);

  // Consolidated 4-Base Audit Items (moved from TotvsImportView)
  const auditItems = useMemo<MergedAuditItem[]>(() => {
    return pdmItems.map((item) => {
      const itemCode = item.totvsCode || item.pdmCode;
      const e10 = item.establishments?.['10'];
      const e14 = item.establishments?.['14'];
      const stk10 = stockMap10.get(item.id);
      const stk14 = stockMap14.get(item.id);

      const s10 = stk10?.totvsStock ?? stk10?.currentStock ?? e10?.saldoEstoque ?? 0;
      const s14 = stk14?.totvsStock ?? stk14?.currentStock ?? e14?.saldoEstoque ?? 0;
      const total = s10 + s14;
      const isObsolete = item.situation?.toLowerCase().includes('obsoleto') ?? false;

      const wms10 = stk10?.wmsStock ?? 0;
      const addr10 =
        stk10?.wmsAddress || (stk10?.storageLocation?.includes('-') ? stk10.storageLocation : '');

      const wms14 = stk14?.wmsStock ?? 0;
      const addr14 =
        stk14?.wmsAddress || (stk14?.storageLocation?.includes('-') ? stk14.storageLocation : '');

      const div10 = Math.round((wms10 - s10) * 100) / 100;
      const div14 = Math.round((wms14 - s14) * 100) / 100;
      const hasDivergence = Math.abs(div10) > 0.001 || Math.abs(div14) > 0.001;

      return {
        pdmItem: item,
        itemCode,
        familia: item.totvsFamily || '5040',
        un: item.unitOfMeasure || 'UN',
        descricao60c: item.shortDescription || item.originalDescription || '',
        narrativa200c: item.narrative || '',
        situacao: isObsolete ? 'Totalmente Obsoleto' : 'Ativo',
        saldo10: s10,
        saldo14: s14,
        totalSaldo: total,
        saldoWms10: wms10,
        enderecoWms10: addr10,
        saldoWms14: wms14,
        enderecoWms14: addr14,
        divergencia10: div10,
        divergencia14: div14,
        hasObsoleteWithStockAlert: isObsolete && (total > 0 || wms10 > 0 || wms14 > 0),
        hasDivergenceAlert: hasDivergence,
        pontoEncomenda10: e10?.pontoEncomenda ?? 0,
        pontoEncomenda14: e14?.pontoEncomenda ?? 0,
        estoqueSeguranca10: e10?.estoqueSegurancaAlmoxarifado ?? 0,
        estoqueSeguranca14: e14?.estoqueSegurancaAlmoxarifado ?? 0,
        leadTime10: e10?.tempoRessuprimento ?? 0,
        leadTime14: e14?.tempoRessuprimento ?? 0,
      };
    });
  }, [pdmItems, stockMap10, stockMap14]);

  const filteredAuditItems = useMemo(() => {
    return auditItems.filter((item) => {
      if (auditFilter === 'active' && item.situacao !== 'Ativo') return false;
      if (auditFilter === 'obsolete' && item.situacao !== 'Totalmente Obsoleto') return false;
      if (auditFilter === 'obsolete-with-stock' && !item.hasObsoleteWithStockAlert) return false;
      if (auditFilter === 'divergent' && !item.hasDivergenceAlert) return false;

      if (auditSearchTerm.trim()) {
        const query = auditSearchTerm.toLowerCase();
        return (
          item.itemCode.toLowerCase().includes(query) ||
          item.descricao60c.toLowerCase().includes(query) ||
          item.narrativa200c.toLowerCase().includes(query) ||
          item.enderecoWms10.toLowerCase().includes(query) ||
          item.enderecoWms14.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [auditItems, auditFilter, auditSearchTerm]);

  const auditStats = useMemo(() => {
    return {
      total: auditItems.length,
      active: auditItems.filter((i) => i.situacao === 'Ativo').length,
      obsolete: auditItems.filter((i) => i.situacao === 'Totalmente Obsoleto').length,
      obsoleteWithStock: auditItems.filter((i) => i.hasObsoleteWithStockAlert).length,
      divergent: auditItems.filter((i) => i.hasDivergenceAlert).length,
    };
  }, [auditItems]);

  const handleExportAuditCSV = () => {
    const headers = [
      'Item_TOTVS',
      'Familia',
      'Un',
      'Situacao_Cadastral',
      'Descricao_60c',
      'Narrativa_200c',
      'Saldo_TOTVS_Dourado_10',
      'Saldo_WMS_Dourado_10',
      'Divergencia_Dourado',
      'Endereco_WMS_Dourado',
      'Saldo_TOTVS_Parana_14',
      'Saldo_WMS_Parana_14',
      'Divergencia_Parana',
      'Endereco_WMS_Parana',
      'Estoque_Maximo_Sugerido_10',
      'Estoque_Maximo_Sugerido_14',
      'Estoque_Seguranca_10',
      'Estoque_Seguranca_14',
      'Lead_Time_10_Dias',
      'Lead_Time_14_Dias',
      'Alerta_Obsoleto_Com_Saldo',
      'Alerta_Divergencia_WMS_TOTVS',
    ];

    const rows = filteredAuditItems.map((i) => [
      `"${i.itemCode}"`,
      `"${i.familia}"`,
      `"${i.un}"`,
      `"${i.situacao}"`,
      `"${i.descricao60c.replace(/"/g, '""')}"`,
      `"${i.narrativa200c.replace(/"/g, '""')}"`,
      i.saldo10,
      i.saldoWms10,
      i.divergencia10,
      `"${i.enderecoWms10}"`,
      i.saldo14,
      i.saldoWms14,
      i.divergencia14,
      `"${i.enderecoWms14}"`,
      i.pontoEncomenda10,
      i.pontoEncomenda14,
      i.estoqueSeguranca10,
      i.estoqueSeguranca14,
      i.leadTime10,
      i.leadTime14,
      i.hasObsoleteWithStockAlert ? 'SIM' : 'NAO',
      i.hasDivergenceAlert ? 'SIM - DIVERGENTE' : 'NAO - ALINHADO',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PremieRpet_Auditoria_4Bases_TOTVS_WMS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentTenantWmsSync =
    currentTenant.id === 'dourado-sp'
      ? wmsSyncLabels?.['dourado-sp']
      : wmsSyncLabels?.['porto-amazonas-pr'];

  return (
    <div className="space-y-6">
      {/* HEADER BANNER (LIGHT THEME) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Almoxarifado Industrial & Auditoria WMS</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {currentTenant.name} ({currentTenant.code})
              </span>
            </h2>
            {currentTenantWmsSync && (
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>WMS atualizado nas consultas ({currentTenantWmsSync})</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {currentTenant.unitType} ·{' '}
              <strong>Conciliação Integrada: TOTVS (CE0348) vs. WMS Físico (Estoque Peças)</strong>
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Sub-view Switcher: Unidade Local vs Auditoria Consolidada */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('unit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'unit'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Almoxarifado {currentTenant.code}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'audit'
                  ? 'bg-white text-emerald-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>Auditoria 4 Bases</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportAuditCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
            title="Exportar planilha consolidada de auditoria e saldos TOTVS × WMS"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Exportar Auditoria (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
          >
            <History className="w-4 h-4 text-emerald-700" />
            <span>Extrato ({currentMovements.length})</span>
          </button>

          <button
            type="button"
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Estocar Item</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: ALMOXARIFADO DA UNIDADE LOCAL                               */}
      {/* =================================================================== */}
      {viewMode === 'unit' && (
        <>
          {/* KPI METRIC CARDS (LIGHT THEME) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">SKUs Cadastrados na Planta</span>
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {totalSKUs.toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] mt-1 flex items-center justify-between font-mono">
                <span className="text-emerald-700 font-bold">{activeCount.toLocaleString('pt-BR')} Ativos</span>
                <span className="text-slate-400">·</span>
                <span className="text-rose-700 font-bold">{obsoleteCount.toLocaleString('pt-BR')} Obsoletos</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">Saldo Valorizado TOTVS</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                R${' '}
                {totalLockedCapitalTotvs.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Base CE0348 (Saldo Estoque × Custo Médio)
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                divergentStockCount > 0 ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={divergentStockCount > 0 ? 'text-amber-800 font-bold' : 'text-slate-500 font-medium'}>
                  Divergências TOTVS vs. WMS
                </span>
                <ArrowRightLeft className={`w-4 h-4 ${divergentStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div
                className={`text-2xl font-bold font-mono ${
                  divergentStockCount > 0 ? 'text-amber-900' : 'text-slate-900'
                }`}
              >
                {divergentStockCount} SKUs
              </div>
              <div className="text-[11px] text-amber-800/80 mt-1">
                {divergentStockCount > 0 ? 'Discrepância física vs. contábil a sanar' : '100% dos saldos conciliados'}
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                lowStockCount > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={lowStockCount > 0 ? 'text-rose-700 font-bold' : 'text-slate-500 font-medium'}>
                  Abaixo do Ponto de Reposição
                </span>
                <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
              </div>
              <div className={`text-2xl font-bold font-mono ${lowStockCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {lowStockCount} SKUs
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Sugerida abertura de Solicitação de Compra</div>
            </div>
          </div>

          {/* SEARCH AND FILTERS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="relative md:col-span-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por código TOTVS, endereço WMS (ex: 03-008), descrição ou narrativa técnica..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={situationFilter}
                onChange={(e) => setSituationFilter(e.target.value as any)}
                className={`w-full py-2.5 px-3 bg-white border rounded-xl text-xs font-semibold shadow-2xs focus:outline-none focus:ring-2 ${
                  situationFilter === 'OBSOLETE'
                    ? 'border-rose-300 text-rose-800 bg-rose-50/40 focus:border-rose-600 focus:ring-rose-100'
                    : situationFilter === 'ACTIVE'
                    ? 'border-emerald-300 text-emerald-800 bg-emerald-50/40 focus:border-emerald-600 focus:ring-emerald-100'
                    : situationFilter === 'OBSOLETE_WITH_STOCK'
                    ? 'border-amber-300 text-amber-800 bg-amber-50/40 focus:border-amber-600 focus:ring-amber-100'
                    : 'border-slate-200 text-slate-800 focus:border-emerald-600 focus:ring-emerald-100'
                }`}
              >
                <option value="ALL">
                  Todas as Situações ({activeCount} Ativos · {obsoleteCount} Obsoletos)
                </option>
                <option value="ACTIVE">Somente Itens Ativos ({activeCount.toLocaleString('pt-BR')})</option>
                <option value="OBSOLETE">
                  Somente Totalmente Obsoletos ({obsoleteCount.toLocaleString('pt-BR')})
                </option>
                {obsoleteWithStockCount > 0 && (
                  <option value="OBSOLETE_WITH_STOCK">
                    Obsoletos com Saldo em Estoque ({obsoleteWithStockCount})
                  </option>
                )}
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
              >
                <option value="ALL">Todos os Níveis de Estoque</option>
                <option value="DIVERGENT">Apenas com Divergência (TOTVS ≠ WMS)</option>
                <option value="ALIGNED">Apenas Saldos Conciliados (TOTVS = WMS)</option>
                <option value="LOW">Somente Alerta de Mínimo</option>
                <option value="NORMAL">Nível Nominal Adequado</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                value={criticismFilter}
                onChange={(e) => setCriticismFilter(e.target.value as any)}
                className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
              >
                <option value="ALL">Criticidade VED</option>
                <option value="V">Classe V - Vital</option>
                <option value="E">Classe E - Essencial</option>
                <option value="D">Classe D - Desejável</option>
              </select>
            </div>
          </div>

          {/* DENSE LOCAL INVENTORY TABLE */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">ITEM</th>
                    <th className="py-3 px-4 text-center">Descrição PDM Padronizada</th>
                    <th className="py-3 px-4 text-center">Endereço WMS (Posição Física)</th>
                    <th className="py-3 px-4 text-center">Criticidade</th>
                    <th className="py-3 px-4 text-center bg-emerald-50 text-emerald-900 border-x border-emerald-100">
                      SALDO ATUAL TOTVS
                    </th>
                    <th className="py-3 px-4 text-center bg-blue-50 text-blue-900 border-r border-blue-100">
                      SALDO ATUAL WMS
                    </th>
                    <th className="py-3 px-4 text-center">Conciliação</th>
                    <th className="py-3 px-4 text-center">Mín / Seg</th>
                    <th className="py-3 px-4 text-center">Custo Médio</th>
                    <th className="py-3 px-4 text-center">Valor Total</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                        Nenhum item localizado no almoxarifado desta unidade para o filtro aplicado.
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((stock) => {
                      const pdm = pdmMap.get(stock.pdmItemId);
                      if (!pdm) return null;

                      const totvsStock = stock.totvsStock ?? stock.currentStock ?? 0;
                      const wmsStock = stock.wmsStock ?? 0;
                      const divergence = Math.round((wmsStock - totvsStock) * 100) / 100;
                      const isDivergent = Math.abs(divergence) > 0.001;
                      const isLow = totvsStock <= stock.minimumStock;
                      const totalStockValue = totvsStock * stock.unitCost;

                      const isItemObsolete =
                        pdm.situation?.toLowerCase().includes('obsoleto') || stock.status === 'INACTIVE';
                      const hasObsoleteWithStockAlert = isItemObsolete && (totvsStock > 0 || wmsStock > 0);

                      return (
                        <tr
                          key={stock.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            hasObsoleteWithStockAlert
                              ? 'bg-amber-50/30'
                              : isLow
                              ? 'bg-rose-50/30'
                              : isDivergent
                              ? 'bg-amber-50/15'
                              : ''
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            <span className="font-mono font-bold text-emerald-800">
                              {pdm.totvsCode || pdm.pdmCode || stock.internalCode.replace(/^(DOU|PAM)-/i, '')}
                            </span>
                            <div className="mt-1">
                              <span
                                className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isItemObsolete
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isItemObsolete ? 'Totalmente Obsoleto' : 'Ativo'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-sm text-center">
                            <div className="font-mono font-bold text-slate-900 text-xs">{pdm.shortDescription}</div>
                            {(pdm.narrative || pdm.longDescription) && (
                              <div
                                className="text-[10px] text-slate-400 font-mono truncate max-w-sm mx-auto mt-0.5"
                                title={pdm.narrative || pdm.longDescription}
                              >
                                <span className="font-semibold text-emerald-800">Narrativa: </span>
                                {pdm.narrative || pdm.longDescription}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-slate-700 text-center">
                            {(() => {
                              const hasValidWms =
                                Boolean(stock.wmsAddress) &&
                                stock.wmsAddress !== 'Pendente WMS' &&
                                stock.wmsAddress !== 'Almox Central Dourado / Setor A' &&
                                stock.wmsAddress !== 'Não consta';
                              const fallbackLocation =
                                !stock.storageLocation ||
                                stock.storageLocation === 'Almox Central Dourado / Setor A' ||
                                stock.storageLocation === 'Almox Central Dourado' ||
                                stock.storageLocation === 'Pendente WMS'
                                  ? 'Não consta'
                                  : stock.storageLocation;
                              return (
                                <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                  <MapPin
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      hasValidWms ? 'text-blue-600' : 'text-slate-400'
                                    }`}
                                  />
                                  {hasValidWms ? (
                                    <span
                                      className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                                      title={stock.wmsAddress}
                                    >
                                      {stock.wmsAddress}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-slate-400 italic">
                                      {fallbackLocation}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            <span
                              className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                stock.criticism === 'V'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : stock.criticism === 'E'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {stock.criticism} ·{' '}
                              {stock.criticism === 'V'
                                ? 'Vital'
                                : stock.criticism === 'E'
                                ? 'Essencial'
                                : 'Desejável'}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono bg-emerald-50/20 border-x border-emerald-100">
                            <span
                              className={`text-sm font-bold ${
                                isLow ? 'text-rose-600 font-extrabold' : 'text-emerald-900'
                              }`}
                            >
                              {totvsStock} {pdm.unitOfMeasure || 'UN'}
                            </span>
                            <div className="text-[10px] text-slate-400 font-sans">Base CE0348</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono bg-blue-50/20 border-r border-blue-100">
                            <span className="text-sm font-bold text-blue-900">
                              {wmsStock} {pdm.unitOfMeasure || 'UN'}
                            </span>
                            <div className="text-[10px] text-slate-400 font-sans">WMS Peças</div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono text-[11px]">
                            {!isDivergent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Conciliado</span>
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  divergence > 0
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                                }`}
                                title={`Divergência: WMS possui ${divergence > 0 ? '+' : ''}${divergence} em relação ao TOTVS.`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>Δ {divergence > 0 ? `+${divergence}` : divergence}</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono text-slate-500 text-[11px]">
                            <div>Mín: {stock.minimumStock}</div>
                            <div className="text-[10px] text-slate-400">
                              Seg: {stock.safetyStockWarehouse ?? stock.safetyStock}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono text-slate-700">
                            R$ {stock.unitCost.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono font-bold text-emerald-800">
                            R${' '}
                            {totalStockValue.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectItemDetail(pdm)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                                title="Ver ficha técnica, posição WMS e parâmetros TOTVS do item"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-700" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setMovementModalData({ stockItem: stock, pdmItem: pdm })}
                                className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-2xs"
                                title="Lançar entrada, saída por OS ou devolução"
                              >
                                Movimentar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Exibindo <strong>{filteredStocks.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> a{' '}
                <strong>{Math.min(currentPage * pageSize, filteredStocks.length)}</strong> de{' '}
                <strong>{filteredStocks.length}</strong> itens no almoxarifado de {currentTenant.name}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <span className="font-mono text-xs">
                  Pág. {currentPage} de {Math.max(1, Math.ceil(filteredStocks.length / pageSize))}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= Math.ceil(filteredStocks.length / pageSize)}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: AUDITORIA CONSOLIDADA 4 BASES (DOURADO + PARANÁ)           */}
      {/* MOVED FROM Carga & Auditoria TOTVS INTO Almoxarifado Local          */}
      {/* =================================================================== */}
      {viewMode === 'audit' && (
        <div className="space-y-4">
          {/* WMS Update Status Strip */}
          {(wmsSyncLabels?.['dourado-sp'] || wmsSyncLabels?.['porto-amazonas-pr']) && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center gap-4 text-xs text-emerald-900">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Saldos WMS atualizados em tempo real nas consultas:</span>
              </div>
              {wmsSyncLabels?.['dourado-sp'] && (
                <span className="font-mono text-[11px] bg-white px-2.5 py-0.5 rounded border border-emerald-200">
                  Base 3 Dourado: {wmsSyncLabels['dourado-sp']}
                </span>
              )}
              {wmsSyncLabels?.['porto-amazonas-pr'] && (
                <span className="font-mono text-[11px] bg-white px-2.5 py-0.5 rounded border border-emerald-200">
                  Base 4 Porto Amazonas: {wmsSyncLabels['porto-amazonas-pr']}
                </span>
              )}
            </div>
          )}

          {/* 4 AUDIT KPI SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Total SKUs Auditados</span>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {auditStats.total.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10px] text-slate-500">Estabelecimentos 10 (DOU) e 14 (PAM)</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-mono uppercase text-emerald-700 block">Itens Ativos</span>
              <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
                {auditStats.active.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10px] text-slate-500">Validados via Itens.csv (SB1)</span>
            </div>

            <div
              className={`p-4 rounded-xl border shadow-2xs ${
                auditStats.divergent > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-amber-800 block font-bold">
                Divergências TOTVS vs. WMS
              </span>
              <div className="text-xl font-bold font-mono text-amber-900 mt-0.5">
                {auditStats.divergent.toLocaleString('pt-BR')} SKUs
              </div>
              <span className="text-[10px] text-amber-800">Divergência entre CE0348 e WMS Físico</span>
            </div>

            <div
              className={`p-4 rounded-xl border shadow-2xs ${
                auditStats.obsoleteWithStock > 0 ? 'bg-rose-50/70 border-rose-300' : 'bg-white border-slate-200'
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-rose-800 block font-bold">
                Alerta: Obsoleto com Saldo
              </span>
              <div className="text-xl font-bold font-mono text-rose-900 mt-0.5">
                {auditStats.obsoleteWithStock} SKUs
              </div>
              <span className="text-[10px] text-rose-800">Itens inativos que ainda têm saldo físico</span>
            </div>
          </div>

          {/* AUDIT FILTER BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por código TOTVS (ex: 5040-0007), endereço WMS (ex: 03-008), descrição curta ou narrativa técnica..."
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setAuditFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  auditFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Todos ({auditStats.total})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  auditFilter === 'active'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-emerald-800 border border-slate-200 hover:bg-emerald-50'
                }`}
              >
                Ativos ({auditStats.active})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('divergent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  auditFilter === 'divergent'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50'
                }`}
              >
                Divergências WMS ({auditStats.divergent})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('obsolete')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  auditFilter === 'obsolete'
                    ? 'bg-rose-700 text-white'
                    : 'bg-white text-rose-800 border border-slate-200 hover:bg-rose-50'
                }`}
              >
                Obsoletos ({auditStats.obsolete})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('obsolete-with-stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  auditFilter === 'obsolete-with-stock'
                    ? 'bg-rose-900 text-white'
                    : 'bg-white text-rose-900 border border-rose-300 hover:bg-rose-50'
                }`}
              >
                Obsoleto c/ Estoque ({auditStats.obsoleteWithStock})
              </button>
            </div>
          </div>

          {/* DENSE AUDIT TABLE (DOURADO + PARANÁ) */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">ITEM</th>
                    <th className="py-3 px-4 text-center">DESCRIÇÃO DO ITEM</th>
                    <th className="py-3 px-4 text-center">NARRATIVA TÉCNICA</th>
                    <th className="py-3 px-4 text-center">Situação (Itens)</th>
                    <th className="py-3 px-4 text-center bg-emerald-50 text-emerald-950 border-x border-emerald-100">
                      Dourado (10) TOTVS / WMS
                    </th>
                    <th className="py-3 px-4 text-center bg-purple-50 text-purple-950 border-r border-purple-100">
                      Paraná (14) TOTVS / WMS
                    </th>
                    <th className="py-3 px-4 text-center">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredAuditItems.slice((auditPage - 1) * pageSize, auditPage * pageSize).map((item) => (
                    <tr
                      key={item.itemCode}
                      onClick={() => onSelectItemDetail(item.pdmItem)}
                      className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${
                        item.hasObsoleteWithStockAlert
                          ? 'bg-rose-50/30'
                          : item.hasDivergenceAlert
                          ? 'bg-amber-50/30'
                          : item.situacao === 'Totalmente Obsoleto'
                          ? 'bg-slate-50/30 text-slate-500'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-center font-mono font-bold text-emerald-800">
                        {item.itemCode}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          Família {item.familia} · {item.un}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs text-center font-mono font-semibold text-slate-900">
                        {item.descricao60c}
                      </td>

                      <td className="py-3 px-4 max-w-sm text-center">
                        {item.narrativa200c ? (
                          <div className="text-[11px] text-slate-700 font-mono line-clamp-2 mx-auto" title={item.narrativa200c}>
                            {item.narrativa200c}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sem narrativa complementar</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                            item.situacao === 'Totalmente Obsoleto'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {item.situacao}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono bg-emerald-50/20 border-x border-emerald-100">
                        <div>
                          <span className="text-slate-500 text-[10px]">TOTVS: </span>
                          <span className={item.saldo10 > 0 ? 'font-bold text-emerald-800' : 'text-slate-400'}>
                            {item.saldo10} {item.un}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">WMS: </span>
                          <span className={item.saldoWms10 > 0 ? 'font-bold text-amber-900' : 'text-slate-400'}>
                            {item.saldoWms10} {item.un}
                          </span>
                        </div>
                        {item.enderecoWms10 && (
                          <div
                            className="text-[10px] text-blue-700 truncate max-w-[140px] mx-auto mt-0.5 flex items-center justify-center gap-1"
                            title={item.enderecoWms10}
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{item.enderecoWms10}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono bg-purple-50/20 border-r border-purple-100">
                        <div>
                          <span className="text-slate-500 text-[10px]">TOTVS: </span>
                          <span className={item.saldo14 > 0 ? 'font-bold text-emerald-800' : 'text-slate-400'}>
                            {item.saldo14} {item.un}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">WMS: </span>
                          <span className={item.saldoWms14 > 0 ? 'font-bold text-purple-900' : 'text-slate-400'}>
                            {item.saldoWms14} {item.un}
                          </span>
                        </div>
                        {item.enderecoWms14 && (
                          <div
                            className="text-[10px] text-blue-700 truncate max-w-[140px] mx-auto mt-0.5 flex items-center justify-center gap-1"
                            title={item.enderecoWms14}
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{item.enderecoWms14}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.hasObsoleteWithStockAlert ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-700" />
                            <span>Obsoleto c/ Estoque</span>
                          </span>
                        ) : item.hasDivergenceAlert ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            <ArrowRightLeft className="w-3 h-3 text-amber-700" />
                            <span>Divergência WMS</span>
                          </span>
                        ) : item.totalSaldo > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            <span>Saldos Conciliados</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">Sem Saldo Físico</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs text-slate-600">
              <div>
                Exibindo{' '}
                <strong>{filteredAuditItems.length === 0 ? 0 : (auditPage - 1) * pageSize + 1}</strong> a{' '}
                <strong>{Math.min(auditPage * pageSize, filteredAuditItems.length)}</strong> de{' '}
                <strong>{filteredAuditItems.length}</strong> itens auditados
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="font-mono text-xs">
                  Pág. {auditPage} de {Math.max(1, Math.ceil(filteredAuditItems.length / pageSize))}
                </span>
                <button
                  type="button"
                  onClick={() => setAuditPage((p) => p + 1)}
                  disabled={auditPage >= Math.ceil(filteredAuditItems.length / pageSize)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENT REGISTRATION MODAL */}
      {movementModalData && (
        <MovementModal
          isOpen={true}
          onClose={() => setMovementModalData(null)}
          stockItem={movementModalData.stockItem}
          pdmItem={movementModalData.pdmItem}
          currentTenant={currentTenant}
          onRegisterMovement={onRegisterMovement}
        />
      )}

      {/* HISTORY MODAL / DRAWER */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Extrato de Movimentações · {currentTenant.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Histórico de baixas para Ordens de Serviço (OS), manutenções e recebimento fiscal TOTVS.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto px-4 pb-4">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3 text-center">Data/Hora</th>
                    <th className="py-2.5 px-3 text-center">Tipo</th>
                    <th className="py-2.5 px-3 text-center">Cód. TOTVS / Item</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3 text-center">Custo Unit</th>
                    <th className="py-2.5 px-3 text-center">Total (R$)</th>
                    <th className="py-2.5 px-3 text-center">Centro de Custo</th>
                    <th className="py-2.5 px-3 text-center">Documento OS/NF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {currentMovements.map((mov) => {
                    const pdm = pdmMap.get(mov.pdmItemId);
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-slate-500 text-[11px]">
                          {new Date(mov.date).toLocaleDateString('pt-BR')}{' '}
                          {new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {mov.type === 'IN' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              <ArrowDownRight className="w-3 h-3" /> ENTRADA
                            </span>
                          )}
                          {mov.type === 'OUT' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              <ArrowUpRight className="w-3 h-3" /> SAÍDA
                            </span>
                          )}
                          {mov.type === 'RETURN' && (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              DEVOLUÇÃO
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="font-mono text-slate-900 font-semibold">
                            {pdm?.totvsCode || pdm?.pdmCode || 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs mx-auto">{pdm?.shortDescription}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                          {mov.quantity} {pdm?.unitOfMeasure || 'UN'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          R$ {mov.unitCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800">
                          R${' '}
                          {mov.totalValue.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700 text-[11px] whitespace-nowrap">
                          {mov.costCenter}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {mov.documentNumber}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
