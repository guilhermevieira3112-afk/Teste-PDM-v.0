import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar, 
  Download, 
  Info, 
  Building2, 
  CheckCircle2, 
  AlertTriangle,
  Search
} from 'lucide-react';
import { TenantStockItem, StockMovement, PDMItem, Tenant, ABCAnalysisItem, ABCSummary } from '../../types/pdm';
import { calculateABCCurve } from '../../utils/abcCurve';

interface ABCCurveDashboardProps {
  tenantStocks: TenantStockItem[];
  movements: StockMovement[];
  pdmItems: PDMItem[];
  currentTenant: Tenant;
}

export const ABCCurveDashboard: React.FC<ABCCurveDashboardProps> = ({
  tenantStocks,
  movements,
  pdmItems,
  currentTenant,
}) => {
  const [periodMonths, setPeriodMonths] = useState<number>(6);
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // PDM items map for quick lookup including narrative
  const pdmMap = useMemo(() => new Map(pdmItems.map((p) => [p.id, p])), [pdmItems]);

  // Filter stocks and movements for current tenant
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

  // Filtered ABC items checking code, description and narrative
  const filteredAbcItems = useMemo(() => {
    if (!searchQuery.trim()) return abcItems;
    const q = searchQuery.toLowerCase();
    return abcItems.filter((item) => {
      const pdm = pdmMap.get(item.pdmItemId);
      const matchCode = item.internalCode.toLowerCase().includes(q) || item.pdmCode.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchTotvs = pdm?.totvsCode?.toLowerCase().includes(q);
      const matchOrig = pdm?.originalDescription?.toLowerCase().includes(q);
      const matchNarr = pdm?.narrative?.toLowerCase().includes(q);
      const matchLong = pdm?.longDescription?.toLowerCase().includes(q);
      return matchCode || matchDesc || matchTotvs || matchOrig || matchNarr || matchLong;
    });
  }, [abcItems, pdmMap, searchQuery]);

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

    const rows = abcItems.map((item, idx) => [
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
      'data:text/csv;charset=utf-8,' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
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

  // SVG Chart Geometry
  const chartWidth = 840;
  const chartHeight = 280;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 30;
  const paddingBottom = 45;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // Chart data: display top 24 items in Pareto chart for crystal clear layout
  const chartSlice = useMemo(() => abcItems.slice(0, 24), [abcItems]);
  const maxConsumedValue = Math.max(...chartSlice.map((i) => i.consumedValue), 100);
  const barWidth = chartSlice.length > 0 ? Math.max(14, (innerWidth / chartSlice.length) * 0.55) : 20;

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
            <span>Unidade: <strong>{currentTenant.name}</strong> · Base de cálculo: Baixas de OS reais e custo de reposição</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Period selector */}
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              onClick={() => setPeriodMonths(3)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                periodMonths === 3
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3 Meses
            </button>
            <button
              onClick={() => setPeriodMonths(6)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                periodMonths === 6
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 Meses
            </button>
            <button
              onClick={() => setPeriodMonths(12)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                periodMonths === 12
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 Meses
            </button>
          </div>

          <button
            onClick={handleExportABC}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* SUMMARY KPI CARDS (LIGHT THEME) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* GRAND TOTAL */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs mb-1 flex items-center justify-between">
            <span className="font-medium">Consumo Total ({periodMonths} meses)</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            R$ {summary.totalConsumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total de {summary.totalSKUs} SKUs com movimentação
          </div>
        </div>

        {/* CLASSE A */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-xs">
          <div className="text-amber-900 text-xs font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Classe A (Críticos Financeiramente)
            </span>
            <span className="font-mono text-[11px]">~80% Valor</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-800">
            R$ {summary.classA.consumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 font-mono flex items-center justify-between">
            <span>{summary.classA.skuCount} SKUs ({summary.classA.skuPercentage.toFixed(1)}% do total)</span>
            <span>{summary.classA.valuePercentage.toFixed(1)}% do valor</span>
          </div>
        </div>

        {/* CLASSE B */}
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-xs">
          <div className="text-blue-900 text-xs font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Classe B (Intermediários)
            </span>
            <span className="font-mono text-[11px]">~15% Valor</span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-800">
            R$ {summary.classB.consumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-blue-700 mt-1 font-mono flex items-center justify-between">
            <span>{summary.classB.skuCount} SKUs ({summary.classB.skuPercentage.toFixed(1)}% do total)</span>
            <span>{summary.classB.valuePercentage.toFixed(1)}% do valor</span>
          </div>
        </div>

        {/* CLASSE C */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
          <div className="text-slate-700 text-xs font-bold mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Classe C (Alto Giro / Baixo Custo)
            </span>
            <span className="font-mono text-[11px]">~5% Valor</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-800">
            R$ {summary.classC.consumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono flex items-center justify-between">
            <span>{summary.classC.skuCount} SKUs ({summary.classC.skuPercentage.toFixed(1)}% do total)</span>
            <span>{summary.classC.valuePercentage.toFixed(1)}% do valor</span>
          </div>
        </div>

      </div>

      {/* PARETO INTERACTIVE GRAPHIC (LIGHT THEME) */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>Gráfico de Pareto · Consumo Financeiro Acumulado</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Barras indicam o valor consumido no período (Eixo Y Esquerdo); Linha vermelha representa o percentual acumulado de Pareto (Eixo Y Direito).
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
              <span className="text-slate-700 font-medium">Classe A</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
              <span className="text-slate-700 font-medium">Classe B</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
              <span className="text-slate-700 font-medium">Classe C</span>
            </div>
          </div>
        </div>

        {/* SVG CHART CONTAINER */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto min-w-[650px] overflow-visible"
          >
            {/* Grid Lines */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = paddingTop + innerHeight - (pct / 100) * innerHeight;
              return (
                <g key={pct}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={pct === 80 || pct === 95 ? '4 4' : undefined}
                    strokeWidth={pct === 80 || pct === 95 ? 1.5 : 1}
                  />
                  {/* Right Axis Label (%) */}
                  <text
                    x={chartWidth - paddingRight + 8}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* 80% Cutoff Reference Label */}
            <text
              x={chartWidth - paddingRight - 110}
              y={paddingTop + innerHeight - (80 / 100) * innerHeight - 5}
              fill="#d97706"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              Limite Classe A (80%)
            </text>

            {/* BARS FOR EACH TOP SKU */}
            {chartSlice.map((item, idx) => {
              const xStep = innerWidth / (chartSlice.length || 1);
              const x = paddingLeft + idx * xStep + (xStep - barWidth) / 2;
              const barHeight = Math.max(4, (item.consumedValue / maxConsumedValue) * innerHeight);
              const y = paddingTop + innerHeight - barHeight;

              const isA = item.abcClass === 'A';
              const isB = item.abcClass === 'B';
              const fillColor = isA ? '#f59e0b' : isB ? '#3b82f6' : '#94a3b8';

              const isHovered = activeHoverIndex === idx;

              return (
                <g
                  key={item.pdmItemId}
                  onMouseEnter={() => setActiveHoverIndex(idx)}
                  onMouseLeave={() => setActiveHoverIndex(null)}
                  className="cursor-pointer transition-opacity"
                  opacity={activeHoverIndex === null || isHovered ? 1 : 0.4}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="3"
                    fill={fillColor}
                  />

                  {/* SKU Code label on X axis */}
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - paddingBottom + 16}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {item.internalCode.replace('DOU-', '').replace('PAM-', '')}
                  </text>
                </g>
              );
            })}

            {/* ACCUMULATED PERCENTAGE LINE (PARETO) */}
            {chartSlice.length > 0 && (
              <polyline
                fill="none"
                stroke="#dc2626"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartSlice
                  .map((item, idx) => {
                    const xStep = innerWidth / chartSlice.length;
                    const x = paddingLeft + idx * xStep + xStep / 2;
                    const y = paddingTop + innerHeight - (item.accumulatedPercentage / 100) * innerHeight;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}

            {/* LINE MARKERS */}
            {chartSlice.map((item, idx) => {
              const xStep = innerWidth / chartSlice.length;
              const x = paddingLeft + idx * xStep + xStep / 2;
              const y = paddingTop + innerHeight - (item.accumulatedPercentage / 100) * innerHeight;
              const isHovered = activeHoverIndex === idx;

              return (
                <circle
                  key={`dot-${item.pdmItemId}`}
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3.5}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all"
                />
              );
            })}
          </svg>
        </div>

        {/* ACTIVE ITEM HOVER DETAIL CARD */}
        {activeHoverIndex !== null && chartSlice[activeHoverIndex] && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-100">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-white ${
                  chartSlice[activeHoverIndex].abcClass === 'A'
                    ? 'bg-amber-600'
                    : chartSlice[activeHoverIndex].abcClass === 'B'
                    ? 'bg-blue-600'
                    : 'bg-slate-500'
                }`}
              >
                Classe {chartSlice[activeHoverIndex].abcClass}
              </span>
              <span className="font-mono font-bold text-slate-900">
                {chartSlice[activeHoverIndex].internalCode}
              </span>
              <span className="text-slate-600">
                ({chartSlice[activeHoverIndex].description})
              </span>
            </div>

            <div className="flex items-center gap-4 font-mono text-slate-700">
              <div>
                Consumo: <strong className="text-slate-900">{chartSlice[activeHoverIndex].consumedQuantity} un</strong>
              </div>
              <div>
                Total Consumido:{' '}
                <strong className="text-emerald-700">
                  R$ {chartSlice[activeHoverIndex].consumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                Acumulado:{' '}
                <strong className="text-rose-600">
                  {chartSlice[activeHoverIndex].accumulatedPercentage.toFixed(1)}%
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED RANKING TABLE (LIGHT THEME) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>Tabela Classificatória da Curva ABC</span>
              <span className="text-xs text-slate-500 font-normal">
                · Base de Consumo Acumulado (Qtd × Custo Médio)
              </span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Total Consumido: R$ {summary.totalConsumedValue.toFixed(2)} · {filteredAbcItems.length} SKUs listados
            </span>
          </div>

          {/* Search bar cross-referencing code, description and narrative */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar código, descrição ou narrativa técnica..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-center">Rank</th>
                <th className="py-3 px-4 text-center">Classe</th>
                <th className="py-3 px-4">Cód. Interno / TOTVS</th>
                <th className="py-3 px-4">Descrição Padronizada PDM</th>
                <th className="py-3 px-4 text-center">Criticidade</th>
                <th className="py-3 px-4 text-right">Qtd Consumida</th>
                <th className="py-3 px-4 text-right">Custo Unit</th>
                <th className="py-3 px-4 text-right">Valor Consumido</th>
                <th className="py-3 px-4 text-right">% Indiv.</th>
                <th className="py-3 px-4 text-right">% Acumulada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredAbcItems.slice(0, 50).map((item, idx) => {
                const isA = item.abcClass === 'A';
                const isB = item.abcClass === 'B';

                return (
                  <tr
                    key={item.pdmItemId}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isA ? 'bg-amber-50/30' : isB ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    {/* RANK */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </td>

                    {/* CLASSE */}
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

                    {/* CODES */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">
                        {item.internalCode}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {item.pdmCode}
                      </div>
                    </td>

                    {/* DESCRIPTION */}
                    <td className="py-3 px-4 max-w-xs md:max-w-md">
                      <div className="font-mono font-semibold text-slate-900">
                        {item.description}
                      </div>
                      {pdmMap.get(item.pdmItemId)?.narrative && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 line-clamp-1" title={pdmMap.get(item.pdmItemId)?.narrative}>
                          <span className="text-emerald-700 font-bold">Narrativa: </span>
                          {pdmMap.get(item.pdmItemId)?.narrative}
                        </div>
                      )}
                    </td>

                    {/* CRITICISM */}
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

                    {/* QTD CONSUMIDA */}
                    <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">
                      {item.consumedQuantity} un
                    </td>

                    {/* CUSTO UNIT */}
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      R$ {item.unitCost.toFixed(2)}
                    </td>

                    {/* VALOR CONSUMIDO */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                      R$ {item.consumedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* % INDIVIDUAL */}
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {item.percentageOfTotal.toFixed(2)}%
                    </td>

                    {/* % ACUMULADA */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      {item.accumulatedPercentage.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
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
              <strong className="text-amber-800">Itens Classe A:</strong> Controle diário, acordos de consignação com fornecedores homologados e estoque de segurança reduzido com alta acuracidade.
            </div>
            <div>
              <strong className="text-blue-800">Itens Classe B:</strong> Reposição mensal programada com lotes econômicos de compra (LEC) e contagem cíclica bimestral.
            </div>
            <div>
              <strong className="text-slate-800">Itens Classe C:</strong> Estoques maiores com pontos de reposição simplificados para otimizar frete e compras consolidadas spot.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
