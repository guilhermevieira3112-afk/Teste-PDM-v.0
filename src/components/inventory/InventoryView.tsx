import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  ArrowDownRight, 
  ArrowUpRight, 
  AlertTriangle, 
  Building2, 
  Layers, 
  History, 
  Plus, 
  DollarSign, 
  ShieldCheck, 
  MapPin, 
  Clock,
  ArrowRightLeft,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { TenantStockItem, PDMItem, StockMovement, Tenant, UserRole, CriticismLevel } from '../../types/pdm';
import { MovementModal } from './MovementModal';

interface InventoryViewProps {
  tenantStocks: TenantStockItem[];
  pdmItems: PDMItem[];
  movements: StockMovement[];
  currentTenant: Tenant;
  currentUserRole: UserRole;
  onRegisterMovement: (movement: Omit<StockMovement, 'id'>) => void;
  onSelectItemDetail: (pdmItem: PDMItem) => void;
  onOpenCatalog: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  tenantStocks,
  pdmItems,
  movements,
  currentTenant,
  currentUserRole,
  onRegisterMovement,
  onSelectItemDetail,
  onOpenCatalog,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [criticismFilter, setCriticismFilter] = useState<'ALL' | CriticismLevel>('ALL');
  const [situationFilter, setSituationFilter] = useState<'ALL' | 'ACTIVE' | 'OBSOLETE' | 'OBSOLETE_WITH_STOCK'>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL' | 'DIVERGENT' | 'ALIGNED'>('ALL');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

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

  // Current tenant's movements
  const currentMovements = useMemo(() => {
    return movements
      .filter((m) => m.tenantId === currentTenant.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, currentTenant.id]);

  // Filtered stocks
  const filteredStocks = useMemo(() => {
    return currentStocks.filter((stock) => {
      const pdm = pdmMap.get(stock.pdmItemId);
      if (!pdm) return false;

      // Situation filter: Ativo vs Obsoleto (Base Itens.csv Coluna I)
      const isObsolete = pdm.situation?.toLowerCase().includes('obsoleto') || stock.status === 'INACTIVE';
      if (situationFilter === 'ACTIVE' && isObsolete) return false;
      if (situationFilter === 'OBSOLETE' && !isObsolete) return false;

      const totvs = stock.totvsStock ?? stock.currentStock ?? 0;
      const wms = stock.wmsStock ?? 0;
      const isLow = totvs <= stock.minimumStock;
      const isDivergent = Math.abs(totvs - wms) > 0.001;

      if (situationFilter === 'OBSOLETE_WITH_STOCK' && (!isObsolete || (totvs <= 0 && wms <= 0))) return false;

      // Criticism filter
      if (criticismFilter !== 'ALL' && stock.criticism !== criticismFilter) return false;

      // Low stock & Divergence filter
      if (stockStatusFilter === 'LOW' && !isLow) return false;
      if (stockStatusFilter === 'NORMAL' && isLow) return false;
      if (stockStatusFilter === 'DIVERGENT' && !isDivergent) return false;
      if (stockStatusFilter === 'ALIGNED' && isDivergent) return false;

      // Search term (Cross-references internal code, TOTVS code, short description, technical narrative, and WMS address)
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const addrMatch = (stock.wmsAddress && stock.wmsAddress.toLowerCase().includes(term)) ||
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

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, criticismFilter, situationFilter, stockStatusFilter]);

  // Situation counts
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

  // KPI Calculations
  const totalLockedCapitalTotvs = useMemo(() => {
    return currentStocks.reduce((sum, s) => sum + (s.totvsStock ?? s.currentStock) * s.unitCost, 0);
  }, [currentStocks]);

  const totalLockedCapitalWms = useMemo(() => {
    return currentStocks.reduce((sum, s) => sum + (s.wmsStock ?? 0) * s.unitCost, 0);
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

  const totalWmsPieces = useMemo(() => {
    return currentStocks.reduce((sum, s) => sum + (s.wmsStock ?? 0), 0);
  }, [currentStocks]);

  const totalTotvsPieces = useMemo(() => {
    return currentStocks.reduce((sum, s) => sum + (s.totvsStock ?? s.currentStock ?? 0), 0);
  }, [currentStocks]);

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER (LIGHT THEME) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Almoxarifado Industrial & WMS</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {currentTenant.name} ({currentTenant.code})
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTenant.unitType} · <strong>Conciliação Integrada: TOTVS Protheus (CE0348) vs. WMS Físico (Estoque Peças)</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
          >
            <History className="w-4 h-4 text-emerald-700" />
            <span>Extrato de Baixas ({currentMovements.length})</span>
          </button>

          <button
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Estocar Item do Catálogo</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS (LIGHT THEME) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SKUs */}
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

        {/* Capital Imobilizado TOTVS */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Saldo Valorizado TOTVS</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            R$ {totalLockedCapitalTotvs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Base CE0348 (Saldo Estoque × Custo Médio)
          </div>
        </div>

        {/* Auditoria Divergências WMS vs TOTVS */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          divergentStockCount > 0 ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={divergentStockCount > 0 ? 'text-amber-800 font-bold' : 'text-slate-500 font-medium'}>
              Divergências TOTVS vs. WMS
            </span>
            <ArrowRightLeft className={`w-4 h-4 ${divergentStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${divergentStockCount > 0 ? 'text-amber-900' : 'text-slate-900'}`}>
            {divergentStockCount} SKUs
          </div>
          <div className="text-[11px] text-amber-800/80 mt-1">
            {divergentStockCount > 0 ? 'Discrepância física vs. contábil a sanar' : '100% dos saldos conciliados'}
          </div>
        </div>

        {/* Itens Abaixo do Mínimo */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          lowStockCount > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={lowStockCount > 0 ? 'text-rose-700 font-bold' : 'text-slate-500 font-medium'}>
              Abaixo do Ponto de Reposição
            </span>
            <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono ${lowStockCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {lowStockCount} SKUs
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Sugerida abertura de Solicitação de Compra
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS (LIGHT THEME) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* BUSCA GERAL */}
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

        {/* FILTRO: SITUAÇÃO (ATIVO OU OBSOLETO) */}
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
            <option value="ALL">Todas as Situações ({activeCount} Ativos · {obsoleteCount} Obsoletos)</option>
            <option value="ACTIVE">🟢 Somente Itens Ativos ({activeCount.toLocaleString('pt-BR')})</option>
            <option value="OBSOLETE">🔴 Somente Totalmente Obsoletos ({obsoleteCount.toLocaleString('pt-BR')})</option>
            {obsoleteWithStockCount > 0 && (
              <option value="OBSOLETE_WITH_STOCK">⚠️ Obsoletos com Saldo em Estoque ({obsoleteWithStockCount})</option>
            )}
          </select>
        </div>

        {/* FILTRO: SALDOS & CONCILIAÇÃO TOTVS vs WMS */}
        <div className="md:col-span-3">
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value as any)}
            className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
          >
            <option value="ALL">Todos os Níveis de Estoque</option>
            <option value="DIVERGENT">⚠️ Apenas com Divergência (TOTVS ≠ WMS)</option>
            <option value="ALIGNED">✓ Apenas Saldos Conciliados (TOTVS = WMS)</option>
            <option value="LOW">Somente Alerta de Mínimo</option>
            <option value="NORMAL">Nível Nominal Adequado</option>
          </select>
        </div>

        {/* FILTRO: CRITICIDADE VED */}
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

      {/* DENSE LOCAL INVENTORY TABLE (LIGHT THEME) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Cód. Interno / TOTVS</th>
                <th className="py-3 px-4">Descrição PDM Padronizada</th>
                <th className="py-3 px-4">Endereço WMS (Posição Física)</th>
                <th className="py-3 px-4 text-center">Criticidade</th>
                <th className="py-3 px-4 text-right bg-emerald-50/50 text-emerald-900 border-x border-emerald-100">
                  SALDO ATUAL TOTVS
                </th>
                <th className="py-3 px-4 text-right bg-blue-50/50 text-blue-900 border-r border-blue-100">
                  SALDO ATUAL WMS
                </th>
                <th className="py-3 px-4 text-center">Conciliação</th>
                <th className="py-3 px-4 text-right">Mín / Seg</th>
                <th className="py-3 px-4 text-right">Custo Médio</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
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
                  const wmsAddressDisplay = stock.wmsAddress || stock.storageLocation || 'Pendente WMS';

                  const isItemObsolete = pdm.situation?.toLowerCase().includes('obsoleto') || stock.status === 'INACTIVE';
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
                      {/* INTERNAL CODE & SITUAÇÃO */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-800">
                          {stock.internalCode}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400">
                          TOTVS: {pdm.totvsCode || pdm.pdmCode}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              isItemObsolete
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                            title={`Situação Cadastral: ${isItemObsolete ? 'Totalmente Obsoleto no Protheus' : 'Ativo no Protheus'}`}
                          >
                            {isItemObsolete ? 'Totalmente Obsoleto' : 'Ativo'}
                          </span>
                        </div>
                      </td>

                      {/* DESCRIPTION & NARRATIVE */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-mono font-semibold text-slate-900 text-xs">
                          {pdm.shortDescription}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5" title={pdm.originalDescription || pdm.longDescription}>
                          {pdm.originalDescription || pdm.longDescription}
                        </div>
                        {(pdm.narrative || pdm.longDescription) && (
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-sm mt-0.5" title={pdm.narrative || pdm.longDescription}>
                            <span className="font-semibold text-emerald-800">Narrativa: </span>
                            {pdm.narrative || pdm.longDescription}
                          </div>
                        )}
                      </td>

                      {/* PHYSICAL LOCATION / WMS ADDRESS (COLUNA E) */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {stock.wmsAddress && stock.wmsAddress !== 'Pendente WMS' ? (
                            <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200" title={stock.wmsAddress}>
                              {stock.wmsAddress}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 italic">
                              {stock.storageLocation || 'Pendente WMS'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CRITICISM (VED) */}
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
                          {stock.criticism} · {stock.criticism === 'V' ? 'Vital' : stock.criticism === 'E' ? 'Essencial' : 'Desejável'}
                        </span>
                      </td>

                      {/* 1. SALDO ATUAL TOTVS (CE0348 COLUNA G) */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono bg-emerald-50/20 border-x border-emerald-100">
                        <span
                          className={`text-sm font-bold ${
                            isLow ? 'text-rose-600 font-extrabold' : 'text-emerald-900'
                          }`}
                        >
                          {totvsStock} {pdm.unitOfMeasure || 'UN'}
                        </span>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Base CE0348
                        </div>
                      </td>

                      {/* 2. SALDO ATUAL WMS (ESTOQUE PEÇAS COLUNA D QTD) */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono bg-blue-50/20 border-r border-blue-100">
                        <span className="text-sm font-bold text-blue-900">
                          {wmsStock} {pdm.unitOfMeasure || 'UN'}
                        </span>
                        <div className="text-[10px] text-slate-400 font-sans">
                          WMS Peças
                        </div>
                      </td>

                      {/* CONCILIAÇÃO & DELTA */}
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

                      {/* MIN / SAFETY */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-slate-500 text-[11px]">
                        <div>Mín: {stock.minimumStock}</div>
                        <div className="text-[10px] text-slate-400">Seg: {stock.safetyStockWarehouse ?? stock.safetyStock}</div>
                      </td>

                      {/* UNIT COST */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-slate-700">
                        R$ {stock.unitCost.toFixed(2)}
                      </td>

                      {/* TOTAL VALUE */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-emerald-800">
                        R$ {totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectItemDetail(pdm)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                            title="Ver ficha técnica, posição WMS e parâmetros TOTVS do item"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-700" />
                          </button>
                          <button
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

        {/* PAGINATION AND FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Exibindo <strong>{Math.min(filteredStocks.length, (currentPage - 1) * pageSize + 1)}</strong> a <strong>{Math.min(currentPage * pageSize, filteredStocks.length)}</strong> de <strong>{filteredStocks.length}</strong> itens no almoxarifado de {currentTenant.name}
          </div>
          
          <div className="flex items-center gap-2">
            <button
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
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= Math.ceil(filteredStocks.length / pageSize)}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>


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

      {/* HISTORY MODAL / DRAWER (LIGHT THEME) */}
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
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase">
                    <th className="py-2.5 px-3">Data/Hora</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Cód. TOTVS / Item</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Custo Unit</th>
                    <th className="py-2.5 px-3 text-right">Total (R$)</th>
                    <th className="py-2.5 px-3">Centro de Custo</th>
                    <th className="py-2.5 px-3">Documento OS/NF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {currentMovements.map((mov) => {
                    const pdm = pdmMap.get(mov.pdmItemId);
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                          {new Date(mov.date).toLocaleDateString('pt-BR')} {new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
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
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-slate-900 font-semibold">
                            {pdm?.totvsCode || pdm?.pdmCode || 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">
                            {pdm?.shortDescription}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {mov.quantity} {pdm?.unitOfMeasure || 'UN'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          R$ {mov.unitCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                          R$ {mov.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 text-[11px] whitespace-nowrap">
                          {mov.costCenter}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
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
