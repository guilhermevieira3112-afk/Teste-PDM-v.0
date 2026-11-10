import React, { useState, useMemo } from 'react';
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
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'NORMAL'>('ALL');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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

      // Criticism filter
      if (criticismFilter !== 'ALL' && stock.criticism !== criticismFilter) return false;

      // Low stock filter
      const isLow = stock.currentStock <= stock.minimumStock;
      if (stockStatusFilter === 'LOW' && !isLow) return false;
      if (stockStatusFilter === 'NORMAL' && isLow) return false;

      // Search term (Cross-references internal code, TOTVS code, short description, and technical narrative)
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        stock.internalCode.toLowerCase().includes(term) ||
        (pdm.totvsCode && pdm.totvsCode.toLowerCase().includes(term)) ||
        pdm.pdmCode.toLowerCase().includes(term) ||
        pdm.shortDescription.toLowerCase().includes(term) ||
        (pdm.originalDescription && pdm.originalDescription.toLowerCase().includes(term)) ||
        (pdm.narrative && pdm.narrative.toLowerCase().includes(term)) ||
        (pdm.longDescription && pdm.longDescription.toLowerCase().includes(term)) ||
        stock.storageLocation.toLowerCase().includes(term)
      );
    });
  }, [currentStocks, pdmMap, criticismFilter, stockStatusFilter, searchTerm]);

  // KPI Calculations
  const totalLockedCapital = useMemo(() => {
    return currentStocks.reduce((sum, s) => sum + s.currentStock * s.unitCost, 0);
  }, [currentStocks]);

  const totalSKUs = currentStocks.length;

  const lowStockCount = useMemo(() => {
    return currentStocks.filter((s) => s.currentStock <= s.minimumStock).length;
  }, [currentStocks]);

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER (LIGHT THEME) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Almoxarifado Industrial</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {currentTenant.name} ({currentTenant.code})
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTenant.unitType} · <strong>Dados Físicos & Custos Confidenciais desta Planta</strong></span>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total SKUs */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">SKUs Ativos na Planta</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {totalSKUs}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Itens vinculados à governança PremieRpet
          </div>
        </div>

        {/* Capital Imobilizado */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Capital Imobilizado em Estoque</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            R$ {totalLockedCapital.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            Soma de (Saldo Atual × Custo Médio Local)
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
        <div className="relative md:col-span-6">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por código interno, TOTVS, descrição ou narrativa técnica (Festo, Andritz, part number)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={criticismFilter}
            onChange={(e) => setCriticismFilter(e.target.value as any)}
            className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
          >
            <option value="ALL">Todas as Criticidades VED</option>
            <option value="V">Classe V - Vital (Parada de Linha)</option>
            <option value="E">Classe E - Essencial (Operação Limitada)</option>
            <option value="D">Classe D - Desejável (Não Impeditivo)</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value as any)}
            className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
          >
            <option value="ALL">Todos os Níveis de Estoque</option>
            <option value="LOW">Somente Alerta de Mínimo</option>
            <option value="NORMAL">Nível Nominal Adequado</option>
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
                <th className="py-3 px-4">Localização Física</th>
                <th className="py-3 px-4 text-center">Criticidade</th>
                <th className="py-3 px-4 text-right">Saldo Atual</th>
                <th className="py-3 px-4 text-right">Mín / Seg</th>
                <th className="py-3 px-4 text-right">Custo Médio</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum item localizado no almoxarifado desta unidade.
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => {
                  const pdm = pdmMap.get(stock.pdmItemId);
                  if (!pdm) return null;

                  const isLow = stock.currentStock <= stock.minimumStock;
                  const totalStockValue = stock.currentStock * stock.unitCost;

                  return (
                    <tr
                      key={stock.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isLow ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* INTERNAL CODE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-800">
                          {stock.internalCode}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400">
                          TOTVS: {pdm.totvsCode || pdm.pdmCode}
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

                      {/* PHYSICAL LOCATION */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{stock.storageLocation}</span>
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

                      {/* CURRENT STOCK */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono">
                        <span
                          className={`text-sm font-bold ${
                            isLow ? 'text-rose-600 font-extrabold' : 'text-slate-900'
                          }`}
                        >
                          {stock.currentStock} {pdm.unitOfMeasure || 'UN'}
                        </span>
                      </td>

                      {/* MIN / SAFETY */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-slate-500 text-[11px]">
                        <div>Mín: {stock.minimumStock}</div>
                        <div className="text-[10px] text-slate-400">Seg: {stock.safetyStock}</div>
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
                            title="Ver ficha técnica e parâmetros TOTVS do item"
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

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando <strong className="text-slate-800">{filteredStocks.length}</strong> de <strong className="text-slate-800">{currentStocks.length}</strong> itens estocados nesta planta
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Inventário Contínuo PremieRpet
          </span>
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
