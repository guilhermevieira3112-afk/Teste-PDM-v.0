import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Download,
  Info,
  Building2,
  Search,
  ArrowUpDown,
  X,
  Eye,
} from 'lucide-react';
import { TenantStockItem, StockMovement, PDMItem, Tenant } from '../../types/pdm';
import { calculateABCCurve } from '../../utils/abcCurve';

interface ABCCurveDashboardProps {
  tenantStocks: TenantStockItem[];
  movements: StockMovement[];
  pdmItems: PDMItem[];
  currentTenant: Tenant;
  onSelectItemDetail?: (pdmItem: PDMItem) => void;
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${Math.round(value)}`;
}

export const ABCCurveDashboard: React.FC<ABCCurveDashboardProps> = ({
  tenantStocks,
  movements,
  pdmItems,
  currentTenant,
  onSelectItemDetail,
}) => {
  const [periodMonths, setPeriodMonths] = useState<number>(6);
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [chartItemLimit, setChartItemLimit] = useState<12 | 20 | 30>(20);
  const [sortBy, setSortBy] = useState<'VALUE' | 'QUANTITY' | 'UNIT_COST' | 'CODE'>('VALUE');

  useEffect(() => {
    setSelectedChartIndex(null);
    setActiveHoverIndex(null);
  }, [periodMonths, classFilter, chartItemLimit, sortBy, searchQuery, currentTenant.id]);

  const pdmMap = useMemo(() => new Map(pdmItems.map((p) => [p.id, p])), [pdmItems]);

  const currentStocks = useMemo(
    () => tenantStocks.filter((s) => s.tenantId === currentTenant.id),
    [tenantStocks, currentTenant.id]
  );

  const currentMovements = useMemo(
    () => movements.filter((m) => m.tenantId === currentTenant.id),
    [movements, currentTenant.id]
  );

  // Compute ABC Analysis
  const { items: abcItems, summary } = useMemo(() => {
    return calculateABCCurve(currentStocks, currentMovements, pdmItems, periodMonths);
  }, [currentStocks, currentMovements, pdmItems, periodMonths]);

  // Apply Class Filter, Search, and Quick Sort
  const filteredAbcItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = abcItems.filter((item) => {
      if (classFilter !== 'ALL' && item.abcClass !== classFilter) return false;
      if (!q) return true;
      const pdm = pdmMap.get(item.pdmItemId);
      const matchCode = item.internalCode.toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchTotvs = pdm?.totvsCode?.toLowerCase().includes(q);
      const matchOrig = pdm?.originalDescription?.toLowerCase().includes(q);
      const matchNarr = pdm?.narrative?.toLowerCase().includes(q);
      const matchLong = pdm?.longDescription?.toLowerCase().includes(q);
      return matchCode || matchDesc || matchTotvs || matchOrig || matchNarr || matchLong;
    });

    const sorted = [...list];
    if (sortBy === 'QUANTITY') {
      sorted.sort((a, b) => b.consumedQuantity - a.consumedQuantity);
    } else if (sortBy === 'UNIT_COST') {
      sorted.sort((a, b) => b.unitCost - a.unitCost);
    } else if (sortBy === 'CODE') {
      sorted.sort((a, b) => a.pdmCode.localeCompare(b.pdmCode));
    } else {
      sorted.sort((a, b) => b.consumedValue - a.consumedValue);
    }
    return sorted;
  }, [abcItems, classFilter, pdmMap, searchQuery, sortBy]);

  // Export CSV of ABC analysis
  const handleExportABC = () => {
    const headers = [
      'Ranking',
      'Classe_ABC',
      'Codigo_Interno',
      'Codigo_TOTVS',
      'Descricao',
      'Criticidade',
      'Qtd_Consumida',
      'Custo_Unitario',
      'Valor_Consumido_Total',
      'Pct_Individual',
      'Pct_Acumulado',
    ];

    const rows = filteredAbcItems.map((item, idx) => [
      idx + 1,
      item.abcClass,
      `"${item.internalCode}"`,
      `"${item.pdmCode}"`,
      `"${item.description.replace(/"/g, '""')}"`,
      item.criticism,
      item.consumedQuantity,
      item.unitCost.toFixed(2),
      item.consumedValue.toFixed(2),
      item.percentageOfTotal.toFixed(2) + '%',
      item.accumulatedPercentage.toFixed(2) + '%',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `PremieRpet_Curva_ABC_${currentTenant.code}_${periodMonths}Meses.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Geometry (generous padding & dynamic width so bars/labels never collide)
  const chartSlice = useMemo(
    () => filteredAbcItems.slice(0, chartItemLimit),
    [filteredAbcItems, chartItemLimit]
  );

  const paddingLeft = 86;
  const paddingRight = 64;
  const paddingTop = 36;
  const paddingBottom = 86;
  const chartHeight = 330;
  const chartWidth = Math.max(900, chartSlice.length * 44 + paddingLeft + paddingRight);

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const maxConsumedValue = Math.max(...chartSlice.map((i) => i.consumedValue), 100);
  const xStep = innerWidth / Math.max(1, chartSlice.length);
  const barWidth = Math.min(34, Math.max(16, xStep * 0.56));

  const activeChartIndex = activeHoverIndex ?? selectedChartIndex;
  const activeChartItem =
    activeChartIndex !== null && chartSlice[activeChartIndex]
      ? chartSlice[activeChartIndex]
      : null;
  const activeChartPdmItem = activeChartItem ? pdmMap.get(activeChartItem.pdmItemId) : undefined;

  return (
    <div className="space-y-6">
      {/* HEADER & TIME FILTER (LIGHT THEME) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Curva ABC Industrial PremieRpet</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Princípio de Pareto (80/15/5)
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              Unidade: <strong>{currentTenant.name}</strong> · Base de cálculo: Baixas de OS reais e custo de reposição
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Period selector */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
            {([3, 6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPeriodMonths(m)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  periodMonths === m
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m} Meses
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportABC}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* CLICKABLE SUMMARY KPI CARDS (FILTER BY ABC CLASS) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setClassFilter('ALL')}
          className={`text-left p-4 rounded-2xl border shadow-xs transition-all ${
            classFilter === 'ALL'
              ? 'bg-white border-emerald-500 ring-2 ring-emerald-100'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-slate-500 text-xs mb-1 flex items-center justify-between">
            <span className="font-medium">Consumo Total ({periodMonths} meses)</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            R${' '}
            {summary.totalConsumedValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total de {summary.totalSKUs} SKUs com movimentação · Clique p/ ver todos
          </div>
        </button>

        <button
          type="button"
          onClick={() => setClassFilter((prev) => (prev === 'A' ? 'ALL' : 'A'))}
          className={`text-left p-4 rounded-2xl border shadow-xs transition-all ${
            classFilter === 'A'
              ? 'bg-amber-100/70 border-amber-500 ring-2 ring-amber-200'
              : 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="text-amber-900 text-xs font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Classe A (Críticos Financeiramente)
            </span>
            <span className="font-mono text-[11px]">~80% Valor</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-800">
            R${' '}
            {summary.classA.consumedValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-mono flex items-center justify-between">
            <span>
              {summary.classA.skuCount} SKUs ({summary.classA.skuPercentage.toFixed(1)}%)
            </span>
            <span>{summary.classA.valuePercentage.toFixed(1)}% do valor</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setClassFilter((prev) => (prev === 'B' ? 'ALL' : 'B'))}
          className={`text-left p-4 rounded-2xl border shadow-xs transition-all ${
            classFilter === 'B'
              ? 'bg-blue-100/70 border-blue-500 ring-2 ring-blue-200'
              : 'bg-blue-50/60 border-blue-200 hover:border-blue-300'
          }`}
        >
          <div className="text-blue-900 text-xs font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Classe B (Intermediários)
            </span>
            <span className="font-mono text-[11px]">~15% Valor</span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-800">
            R${' '}
            {summary.classB.consumedValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-mono flex items-center justify-between">
            <span>
              {summary.classB.skuCount} SKUs ({summary.classB.skuPercentage.toFixed(1)}%)
            </span>
            <span>{summary.classB.valuePercentage.toFixed(1)}% do valor</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setClassFilter((prev) => (prev === 'C' ? 'ALL' : 'C'))}
          className={`text-left p-4 rounded-2xl border shadow-xs transition-all ${
            classFilter === 'C'
              ? 'bg-slate-200/70 border-slate-500 ring-2 ring-slate-200'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-slate-700 text-xs font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Classe C (Alto Giro / Baixo Custo)
            </span>
            <span className="font-mono text-[11px]">~5% Valor</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            R${' '}
            {summary.classC.consumedValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono flex items-center justify-between">
            <span>
              {summary.classC.skuCount} SKUs ({summary.classC.skuPercentage.toFixed(1)}%)
            </span>
            <span>{summary.classC.valuePercentage.toFixed(1)}% do valor</span>
          </div>
        </button>
      </div>

      {/* PARETO INTERACTIVE GRAPHIC */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>Gráfico de Pareto · Consumo Financeiro Acumulado</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Eixo Y Esquerdo: valor consumido em R$ · Eixo Y Direito: % acumulado de Pareto · Passe o mouse ou clique na barra para fixar o item.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Item count selector */}
            <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-[11px]">
              {([12, 20, 30] as const).map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => {
                    setChartItemLimit(limit);
                    setActiveHoverIndex(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-mono font-semibold transition-colors ${
                    chartItemLimit === limit
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top {limit}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span className="text-slate-700 font-medium">A</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                <span className="text-slate-700 font-medium">B</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
                <span className="text-slate-700 font-medium">C</span>
              </div>
            </div>
          </div>
        </div>

        {/* SVG CHART CONTAINER */}
        {chartSlice.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Nenhum item encontrado para os filtros aplicados no gráfico.
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto pb-1">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto"
              style={{ minWidth: `${Math.max(700, chartSlice.length * 36)}px` }}
            >
              {/* Grid Lines & Dual Y-Axis Labels */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = paddingTop + innerHeight - (pct / 100) * innerHeight;
                const valAtTick = (pct / 100) * maxConsumedValue;
                return (
                  <g key={pct}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke={pct === 0 ? '#94a3b8' : '#e2e8f0'}
                      strokeWidth={pct === 0 ? 1.5 : 1}
                    />
                    {/* Left Axis Label (R$) */}
                    <text
                      x={paddingLeft - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#475569"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {formatCompactCurrency(valAtTick)}
                    </text>
                    {/* Right Axis Label (%) */}
                    <text
                      x={chartWidth - paddingRight + 10}
                      y={y + 3.5}
                      textAnchor="start"
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {/* 80% Pareto Cutoff Dashed Guide */}
              {(() => {
                const y80 = paddingTop + innerHeight - 0.8 * innerHeight;
                return (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={y80}
                      x2={chartWidth - paddingRight}
                      y2={y80}
                      stroke="#d97706"
                      strokeDasharray="5 4"
                      strokeWidth="1.25"
                    />
                    <rect
                      x={chartWidth - paddingRight - 134}
                      y={y80 - 17}
                      width="130"
                      height="14"
                      rx="3"
                      fill="#fffbeb"
                      stroke="#fcd34d"
                    />
                    <text
                      x={chartWidth - paddingRight - 69}
                      y={y80 - 7}
                      textAnchor="middle"
                      fill="#b45309"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      Corte Classe A (80%)
                    </text>
                  </g>
                );
              })()}

              {/* BARS & ROTATED X-AXIS LABELS */}
              {chartSlice.map((item, idx) => {
                const slotCenter = paddingLeft + idx * xStep + xStep / 2;
                const x = slotCenter - barWidth / 2;
                const barHeight = Math.max(4, (item.consumedValue / maxConsumedValue) * innerHeight);
                const y = paddingTop + innerHeight - barHeight;

                const isA = item.abcClass === 'A';
                const isB = item.abcClass === 'B';
                const fillColor = isA ? '#f59e0b' : isB ? '#3b82f6' : '#94a3b8';
                const isSelected = selectedChartIndex === idx;
                const isActive = activeChartIndex === idx;
                const shortCode = item.internalCode.replace('DOU-', '').replace('PAM-', '');
                const labelY = paddingTop + innerHeight + 12;

                return (
                  <g
                    key={item.pdmItemId}
                    onMouseEnter={() => setActiveHoverIndex(idx)}
                    onMouseLeave={() => setActiveHoverIndex(null)}
                    onClick={() => setSelectedChartIndex((prev) => (prev === idx ? null : idx))}
                    className="cursor-pointer transition-opacity"
                    opacity={activeChartIndex === null || isActive ? 1 : 0.45}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="3"
                      fill={fillColor}
                      stroke={isSelected ? '#0f172a' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                    />

                    {isActive && (
                      <text
                        x={slotCenter}
                        y={Math.max(12, y - 6)}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {formatCompactCurrency(item.consumedValue)}
                      </text>
                    )}

                    {/* Angled X-Axis Label to prevent adjacent overlaps */}
                    <text
                      x={slotCenter}
                      y={labelY}
                      textAnchor="end"
                      transform={`rotate(-40, ${slotCenter}, ${labelY})`}
                      fill={isActive ? '#0f172a' : '#475569'}
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight={isActive ? 'bold' : 'normal'}
                    >
                      {shortCode}
                    </text>
                  </g>
                );
              })}

              {/* ACCUMULATED PERCENTAGE LINE (PARETO) */}
              {chartSlice.length > 0 && (
                <polyline
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartSlice
                    .map((item, idx) => {
                      const x = paddingLeft + idx * xStep + xStep / 2;
                      const y = paddingTop + innerHeight - (item.accumulatedPercentage / 100) * innerHeight;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* LINE MARKERS */}
              {chartSlice.map((item, idx) => {
                const x = paddingLeft + idx * xStep + xStep / 2;
                const y = paddingTop + innerHeight - (item.accumulatedPercentage / 100) * innerHeight;
                const isActive = activeChartIndex === idx;

                return (
                  <circle
                    key={`dot-${item.pdmItemId}`}
                    cx={x}
                    cy={y}
                    r={isActive ? 5 : 3.25}
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="pointer-events-none"
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* ACTIVE / SELECTED ITEM DETAIL CARD */}
        {activeChartItem && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-100">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-white shrink-0 ${
                  activeChartItem.abcClass === 'A'
                    ? 'bg-amber-600'
                    : activeChartItem.abcClass === 'B'
                    ? 'bg-blue-600'
                    : 'bg-slate-500'
                }`}
              >
                Classe {activeChartItem.abcClass}
              </span>
              <span className="font-mono font-bold text-slate-900 shrink-0">
                {activeChartItem.internalCode}
              </span>
              <span className="text-slate-600 truncate max-w-md" title={activeChartItem.description}>
                ({activeChartItem.description})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-slate-700">
              <div>
                Valor Unitário:{' '}
                <strong className="text-slate-900">
                  R${' '}
                  {activeChartItem.unitCost.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
              <div>
                Consumo: <strong className="text-slate-900">{activeChartItem.consumedQuantity} un</strong>
              </div>
              <div>
                Total Consumido:{' '}
                <strong className="text-emerald-700">
                  R${' '}
                  {activeChartItem.consumedValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>
              <div>
                Acumulado:{' '}
                <strong className="text-rose-600">
                  {activeChartItem.accumulatedPercentage.toFixed(1)}%
                </strong>
              </div>

              {selectedChartIndex !== null && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 font-sans">
                  {activeChartPdmItem && onSelectItemDetail && (
                    <button
                      type="button"
                      onClick={() => onSelectItemDetail(activeChartPdmItem)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver Ficha</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedChartIndex(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold transition-colors"
                    title="Limpar seleção"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DETAILED RANKING TABLE WITH ABC CLASS FILTERS & SORT */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>Tabela Classificatória da Curva ABC</span>
              <span className="text-xs text-slate-500 font-normal">
                · Base de Consumo Acumulado (Qtd × Custo Médio)
              </span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Total Consumido: R${' '}
              {summary.totalConsumedValue.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              · {filteredAbcItems.length} SKUs listados
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* ABC Class Filters */}
            <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl text-xs">
              {(['ALL', 'A', 'B', 'C'] as const).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-colors ${
                    classFilter === cls
                      ? cls === 'A'
                        ? 'bg-amber-600 text-white'
                        : cls === 'B'
                        ? 'bg-blue-600 text-white'
                        : cls === 'C'
                        ? 'bg-slate-700 text-white'
                        : 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cls === 'ALL' ? 'Todas' : `Classe ${cls}`}
                </button>
              ))}
            </div>

            {/* Quick Sort */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none"
              >
                <option value="VALUE">Maior Valor Consumido</option>
                <option value="QUANTITY">Maior Quantidade</option>
                <option value="UNIT_COST">Maior Custo Unitário</option>
                <option value="CODE">Código TOTVS (A-Z)</option>
              </select>
            </div>

            {/* Search bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar código, descrição ou narrativa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200"
              />
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-center text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-center">Rank</th>
                <th className="py-3 px-4 text-center">Classe</th>
                <th className="py-3 px-4 text-center">Cód. Interno / TOTVS</th>
                <th className="py-3 px-4 text-center">Descrição Padronizada PDM</th>
                <th className="py-3 px-4 text-center">Criticidade</th>
                <th className="py-3 px-4 text-center">Qtd Consumida</th>
                <th className="py-3 px-4 text-center">Custo Unit</th>
                <th className="py-3 px-4 text-center">Valor Consumido</th>
                <th className="py-3 px-4 text-center">% Indiv.</th>
                <th className="py-3 px-4 text-center">% Acumulada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredAbcItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 text-xs">
                    Nenhum SKU encontrado nesta classe ou filtro de busca.
                  </td>
                </tr>
              ) : (
                filteredAbcItems.slice(0, 60).map((item, idx) => {
                  const isA = item.abcClass === 'A';
                  const isB = item.abcClass === 'B';
                  const pdmItem = pdmMap.get(item.pdmItemId);

                  return (
                    <tr
                      key={item.pdmItemId}
                      onClick={() => {
                        if (pdmItem && onSelectItemDetail) onSelectItemDetail(pdmItem);
                      }}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        pdmItem && onSelectItemDetail ? 'cursor-pointer' : ''
                      } ${isA ? 'bg-amber-50/30' : isB ? 'bg-blue-50/20' : ''}`}
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">#{idx + 1}</td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block font-mono font-bold text-xs px-2.5 py-0.5 rounded ${
                            isA
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isB
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {item.abcClass}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="font-mono font-bold text-slate-900">{item.internalCode}</div>
                        <div className="text-[10px] font-mono text-slate-400">{item.pdmCode}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs md:max-w-md text-center">
                        <div className="font-mono font-semibold text-slate-900">{item.description}</div>
                        {pdmItem?.narrative && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 line-clamp-1 mx-auto" title={pdmItem.narrative}>
                            <span className="text-emerald-700 font-bold">Narrativa: </span>
                            {pdmItem.narrative}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                            item.criticism === 'V'
                              ? 'bg-rose-100 text-rose-800'
                              : item.criticism === 'E'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.criticism}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-900 font-semibold">
                        {item.consumedQuantity} un
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        R${' '}
                        {item.unitCost.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-800">
                        R${' '}
                        {item.consumedValue.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {item.percentageOfTotal.toFixed(2)}%
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-rose-600">
                        {item.accumulatedPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* STRATEGIC RECOMMENDATIONS FOOTER */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-700 space-y-1">
          <div className="font-bold text-emerald-800 flex items-center gap-1.5">
            <Info className="w-4 h-4" />
            <span>Diretrizes de Compras e Suprimentos PremieRpet:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] text-slate-600">
            <div>
              <strong className="text-amber-800">Itens Classe A:</strong> Controle diário, acordos de consignação com
              fornecedores homologados e estoque de segurança reduzido com alta acuracidade.
            </div>
            <div>
              <strong className="text-blue-800">Itens Classe B:</strong> Reposição mensal programada com lotes
              econômicos de compra (LEC) e contagem cíclica bimestral.
            </div>
            <div>
              <strong className="text-slate-800">Itens Classe C:</strong> Estoques maiores com pontos de reposição
              simplificados para otimizar frete e compras consolidadas spot.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
