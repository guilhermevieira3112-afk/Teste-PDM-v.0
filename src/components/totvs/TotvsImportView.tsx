import React, { useState, useMemo, useEffect } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Download, 
  RefreshCw, 
  Layers, 
  Filter, 
  ShieldCheck, 
  ArrowRight, 
  Eye, 
  FileText, 
  Clock, 
  Check, 
  X,
  AlertCircle,
  Building2,
  Database,
  Sliders,
  Sparkles,
  PackageCheck,
  TrendingDown
} from 'lucide-react';
import { PDMItem, UserRole, Tenant, TenantStockItem } from '../../types/pdm';

interface TotvsImportViewProps {
  existingPdmItems: PDMItem[];
  currentUserRole: UserRole;
  currentTenant: Tenant;
  onIntegrateItems?: (newItems: PDMItem[]) => void;
  onIntegrateMergedBases?: (mergedItems: PDMItem[], mergedStocks: TenantStockItem[]) => void;
  onOpenPdmBuilder?: (itemInitialData?: Partial<PDMItem>) => void;
}

interface MergedAuditItem {
  itemCode: string;
  familia: string;
  un: string;
  descricao60c: string;
  narrativa200c: string;
  situacao: 'Ativo' | 'Totalmente Obsoleto';
  saldo10: number;
  saldo14: number;
  totalSaldo: number;
  pontoEncomenda10: number;
  pontoEncomenda14: number;
  estoqueSeguranca10: number;
  estoqueSeguranca14: number;
  leadTime10: number;
  leadTime14: number;
  hasObsoleteWithStockAlert: boolean;
}

export const TotvsImportView: React.FC<TotvsImportViewProps> = ({
  existingPdmItems,
  currentUserRole,
  currentTenant,
  onIntegrateItems,
  onIntegrateMergedBases,
  onOpenPdmBuilder,
}) => {
  // File 1: CE0348 State
  const [ce0348FileName, setCe0348FileName] = useState<string>('CE0348_49897a73.csv (Oficial PremieRpet)');
  const [ce0348FileSize, setCe0348FileSize] = useState<string>('4.5 MB');
  const [ce0348Loaded, setCe0348Loaded] = useState<boolean>(true);
  const [ce0348TotalLines, setCe0348TotalLines] = useState<number>(17977);
  const [ce0348Estab10Count, setCe0348Estab10Count] = useState<number>(7212);
  const [ce0348Estab14Count, setCe0348Estab14Count] = useState<number>(10751);

  // File 2: Itens.csv State
  const [itensFileName, setItensFileName] = useState<string>('Itens_b9147881.csv (Oficial PremieRpet)');
  const [itensFileSize, setItensFileSize] = useState<string>('2.0 MB');
  const [itensLoaded, setItensLoaded] = useState<boolean>(true);
  const [itensTotalLines, setItensTotalLines] = useState<number>(14044);
  const [itensActiveCount, setItensActiveCount] = useState<number>(8878);
  const [itensObsoleteCount, setItensObsoleteCount] = useState<number>(4252);

  // Merge State
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeSuccess, setMergeSuccess] = useState<boolean>(true); // Pre-simulated initially
  const [lastMergedTime, setLastMergedTime] = useState<string>('Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

  // Audit Table State
  const [auditFilter, setAuditFilter] = useState<'all' | 'active' | 'obsolete' | 'with-stock' | 'obsolete-with-stock'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAuditItem, setSelectedAuditItem] = useState<MergedAuditItem | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Build the list of audit items from existingPdmItems
  const auditItems = useMemo<MergedAuditItem[]>(() => {
    return existingPdmItems
      .filter((item) => item.totvsCode && item.totvsCode.startsWith('5040'))
      .map((item) => {
        const e10 = item.establishments?.['10'];
        const e14 = item.establishments?.['14'];
        const s10 = e10?.saldoEstoque ?? 0;
        const s14 = e14?.saldoEstoque ?? 0;
        const total = s10 + s14;
        const isObsolete = item.situation?.toLowerCase().includes('obsoleto') ?? false;

        return {
          itemCode: item.totvsCode || item.pdmCode,
          familia: item.totvsFamily || '5040',
          un: item.unitOfMeasure || 'UN',
          descricao60c: item.shortDescription || item.originalDescription || '',
          narrativa200c: item.narrative || '',
          situacao: isObsolete ? 'Totalmente Obsoleto' : 'Ativo',
          saldo10: s10,
          saldo14: s14,
          totalSaldo: total,
          pontoEncomenda10: e10?.pontoEncomenda ?? 0,
          pontoEncomenda14: e14?.pontoEncomenda ?? 0,
          estoqueSeguranca10: e10?.estoqueSegurancaAlmoxarifado ?? 0,
          estoqueSeguranca14: e14?.estoqueSegurancaAlmoxarifado ?? 0,
          leadTime10: e10?.tempoRessuprimento ?? 0,
          leadTime14: e14?.tempoRessuprimento ?? 0,
          hasObsoleteWithStockAlert: isObsolete && total > 0,
        };
      });
  }, [existingPdmItems]);

  // Filtered audit items
  const filteredAuditItems = useMemo(() => {
    return auditItems.filter((item) => {
      if (auditFilter === 'active' && item.situacao !== 'Ativo') return false;
      if (auditFilter === 'obsolete' && item.situacao !== 'Totalmente Obsoleto') return false;
      if (auditFilter === 'with-stock' && item.totalSaldo <= 0) return false;
      if (auditFilter === 'obsolete-with-stock' && !item.hasObsoleteWithStockAlert) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCode = item.itemCode.toLowerCase().includes(query);
        const matchDesc = item.descricao60c.toLowerCase().includes(query);
        const matchNarr = item.narrativa200c.toLowerCase().includes(query);
        return matchCode || matchDesc || matchNarr;
      }

      return true;
    });
  }, [auditItems, auditFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = auditItems.length;
    const active = auditItems.filter((i) => i.situacao === 'Ativo').length;
    const obsolete = auditItems.filter((i) => i.situacao === 'Totalmente Obsoleto').length;
    const withStock = auditItems.filter((i) => i.totalSaldo > 0).length;
    const obsoleteWithStock = auditItems.filter((i) => i.hasObsoleteWithStockAlert).length;
    const totalDouradoStock = auditItems.reduce((acc, i) => acc + i.saldo10, 0);
    const totalParanaStock = auditItems.reduce((acc, i) => acc + i.saldo14, 0);

    return {
      total,
      active,
      obsolete,
      withStock,
      obsoleteWithStock,
      totalDouradoStock,
      totalParanaStock,
    };
  }, [auditItems]);

  // Handle uploading custom CE0348
  const handleUploadCE0348 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCe0348FileName(file.name);
    setCe0348FileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    setCe0348Loaded(true);
    setMergeSuccess(false);
  };

  // Handle uploading custom Itens
  const handleUploadItens = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setItensFileName(file.name);
    setItensFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    setItensLoaded(true);
    setMergeSuccess(false);
  };

  // Execute Real Merge Simulation
  const handleExecuteMerge = async () => {
    setIsMerging(true);
    try {
      const [resCat, resStk] = await Promise.all([
        fetch('/data/totvsMergedCatalog.json'),
        fetch('/data/totvsMergedStocks.json'),
      ]);

      if (resCat.ok && resStk.ok) {
        const fullCatalog: PDMItem[] = await resCat.json();
        const fullStocks: TenantStockItem[] = await resStk.json();

        if (onIntegrateMergedBases) {
          onIntegrateMergedBases(fullCatalog, fullStocks);
        } else if (onIntegrateItems) {
          onIntegrateItems(fullCatalog);
        }
      }

      setMergeSuccess(true);
      setLastMergedTime('Agora mesmo (' + new Date().toLocaleTimeString('pt-BR') + ')');
    } catch (err) {
      console.error('Erro na mescla:', err);
    } finally {
      setIsMerging(false);
    }
  };

  // Export Audit CSV
  const handleExportAuditCSV = () => {
    const headers = [
      'Item_TOTVS',
      'Familia',
      'Un',
      'Situacao_Cadastral',
      'Descricao_60c',
      'Narrativa_200c',
      'Saldo_Dourado_10',
      'Saldo_Parana_14',
      'Saldo_Total',
      'Ponto_Encomenda_10',
      'Ponto_Encomenda_14',
      'Estoque_Seguranca_10',
      'Estoque_Seguranca_14',
      'Lead_Time_10_Dias',
      'Lead_Time_14_Dias',
      'Alerta_Obsoleto_Com_Saldo',
    ];

    const rows = filteredAuditItems.map((i) => [
      `"${i.itemCode}"`,
      `"${i.familia}"`,
      `"${i.un}"`,
      `"${i.situacao}"`,
      `"${i.descricao60c.replace(/"/g, '""')}"`,
      `"${i.narrativa200c.replace(/"/g, '""')}"`,
      i.saldo10,
      i.saldo14,
      i.totalSaldo,
      i.pontoEncomenda10,
      i.pontoEncomenda14,
      i.estoqueSeguranca10,
      i.estoqueSeguranca14,
      i.leadTime10,
      i.leadTime14,
      i.hasObsoleteWithStockAlert ? 'SIM - ALERTA CRITICO' : 'NAO',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PremieRpet_Auditoria_Mescla_CE0348_Itens_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP HEADER BANNER */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Módulo Exclusivo Master Admin
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-xs text-slate-500 font-mono">ERP TOTVS Protheus · Estabelecimentos 10 & 14</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Carga & Auditoria TOTVS
            </h2>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Módulo corporativo para upload e cruzamento das duas bases mestres do Protheus: o extrato transacional <strong>CE0348.csv</strong> (saldos físicos, pontos de encomenda, estoque de segurança almoxarifado e lead times de Dourado e Paraná) e o cadastro <strong>Itens.csv</strong> (validação da situação ativa vs. obsoleta).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportAuditCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
              title="Exportar planilha de auditoria e saneamento"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Exportar Auditoria (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. THE TWO DEDICATED CARDS / BUTTONS (CE0348 & ITENS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CARD 1: BASE CE0348 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Base 1 · Transacional
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Carga Base CE0348 (Saldos & Almoxarifado)
                </h3>
              </div>
            </div>

            <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Carregado</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Relatório de situação dos estoques TOTVS. Alimenta o <strong>Saldo Estoque</strong>, <strong>Ponto de Encomenda</strong>, <strong>Estoque de segurança almoxarifado</strong>, <strong>Lead Time</strong>, <strong>Descrição (60c)</strong> e <strong>Narrativa (200c)</strong>.
          </p>

          {/* Info Pill */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-sans text-[11px]">Arquivo:</span>
              <strong className="text-slate-900 truncate max-w-[200px]" title={ce0348FileName}>{ce0348FileName}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-sans text-[11px]">Tamanho / Registros:</span>
              <span>{ce0348FileSize} · {ce0348TotalLines.toLocaleString('pt-BR')} linhas</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200 text-[11px]">
              <span className="font-sans">Estabelecimentos:</span>
              <span className="text-emerald-800 font-bold">10 (Dourado/SP) & 14 (Porto Amazonas/PR)</span>
            </div>
          </div>

          {/* Upload and Reload Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <label className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-[0.98]">
              <UploadCloud className="w-4 h-4" />
              <span>Subir Novo CE0348 (.csv)</span>
              <input
                type="file"
                accept=".csv, .txt"
                onChange={handleUploadCE0348}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                setCe0348FileName('CE0348_49897a73.csv (Oficial)');
                setCe0348Loaded(true);
              }}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
              title="Restaurar base oficial CE0348 do servidor"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CARD 2: BASE ITENS */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Base 2 · Cadastral (SB1)
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Carga Base Itens (Situação Cadastral)
                </h3>
              </div>
            </div>

            <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Carregado</span>
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Cadastro Mestre de Produtos do TOTVS. Utilizado <strong>exclusivamente pela Coluna I ("Situação")</strong> para validar itens como <strong>Ativo</strong> ou <strong>Totalmente Obsoleto</strong>.
          </p>

          {/* Info Pill */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-sans text-[11px]">Arquivo:</span>
              <strong className="text-slate-900 truncate max-w-[200px]" title={itensFileName}>{itensFileName}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-sans text-[11px]">Tamanho / Registros:</span>
              <span>{itensFileSize} · {itensTotalLines.toLocaleString('pt-BR')} itens</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200 text-[11px]">
              <span className="font-sans">Distribuição:</span>
              <span>
                <strong className="text-emerald-700">{itensActiveCount.toLocaleString('pt-BR')} Ativos</strong> · <strong className="text-rose-700">{itensObsoleteCount.toLocaleString('pt-BR')} Obsoletos</strong>
              </span>
            </div>
          </div>

          {/* Upload and Reload Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <label className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer transition-all active:scale-[0.98]">
              <UploadCloud className="w-4 h-4" />
              <span>Subir Novo Itens (.csv)</span>
              <input
                type="file"
                accept=".csv, .txt"
                onChange={handleUploadItens}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                setItensFileName('Itens_b9147881.csv (Oficial)');
                setItensLoaded(true);
              }}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
              title="Restaurar base oficial de Itens do servidor"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* 3. CONSOLIDATION / EXECUTE MERGE BAR */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 to-slate-900 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold tracking-tight">
              Motor de Mescla & Saneamento Centralizado PremieRpet
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Cruza o arquivo <strong>CE0348</strong> com a situação de <strong>Itens</strong> pela chave TOTVS, atualizando instantaneamente as consultas e saldos dos ambientes <strong>Master Admin</strong>, <strong>Dourado (10)</strong> e <strong>Porto Amazonas (14)</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase font-mono text-slate-400">Status da Base</div>
            <div className="text-xs font-mono font-bold text-emerald-400">{lastMergedTime}</div>
          </div>

          <button
            onClick={handleExecuteMerge}
            disabled={isMerging}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isMerging ? 'animate-spin' : ''}`} />
            <span>{isMerging ? 'Processando Mescla...' : 'Executar Mescla & Atualizar Bases'}</span>
          </button>
        </div>
      </div>

      {/* 4. AUDIT KPI SUMMARY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Total SKUs Mesclados</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
            {stats.total.toLocaleString('pt-BR')}
          </div>
          <span className="text-[10px] text-slate-500">Estabelecimentos 10 e 14</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-emerald-700 block">Itens Ativos</span>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
            {stats.active.toLocaleString('pt-BR')}
          </div>
          <span className="text-[10px] text-slate-500">Validados via Itens.csv</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-mono uppercase text-rose-700 block">Totalmente Obsoletos</span>
          <div className="text-xl font-bold font-mono text-rose-800 mt-0.5">
            {stats.obsolete.toLocaleString('pt-BR')}
          </div>
          <span className="text-[10px] text-slate-500">Inativos no ERP Protheus</span>
        </div>

        <div className={`p-4 rounded-xl border shadow-2xs ${
          stats.obsoleteWithStock > 0 ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'
        }`}>
          <span className="text-[10px] font-mono uppercase text-amber-800 block font-bold">
            Alerta: Obsoleto com Saldo
          </span>
          <div className="text-xl font-bold font-mono text-amber-900 mt-0.5">
            {stats.obsoleteWithStock} SKUs
          </div>
          <span className="text-[10px] text-amber-800">
            Itens inativos que ainda têm estoque físico
          </span>
        </div>
      </div>

      {/* 5. AUDIT SEARCH & TABLE OF MERGED ITEMS */}
      <div className="space-y-3">
        
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por código TOTVS (ex: 5040-0001), descrição curta (60c) ou narrativa técnica (200c)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={() => setAuditFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                auditFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todos ({stats.total})
            </button>
            <button
              onClick={() => setAuditFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                auditFilter === 'active'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-emerald-800 border border-slate-200 hover:bg-emerald-50'
              }`}
            >
              Ativos ({stats.active})
            </button>
            <button
              onClick={() => setAuditFilter('obsolete')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                auditFilter === 'obsolete'
                  ? 'bg-rose-700 text-white'
                  : 'bg-white text-rose-800 border border-slate-200 hover:bg-rose-50'
              }`}
            >
              Obsoletos ({stats.obsolete})
            </button>
            <button
              onClick={() => setAuditFilter('obsolete-with-stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                auditFilter === 'obsolete-with-stock'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50'
              }`}
            >
              Alertas ({stats.obsoleteWithStock})
            </button>
          </div>
        </div>

        {/* Dense Audit Table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Item (Cód. TOTVS)</th>
                  <th className="py-3 px-4">Descrição Curta (60c)</th>
                  <th className="py-3 px-4">Narrativa Complementar (200c)</th>
                  <th className="py-3 px-4 text-center">Situação (Itens)</th>
                  <th className="py-3 px-4 text-right">Saldo Dourado (10)</th>
                  <th className="py-3 px-4 text-right">Saldo Paraná (14)</th>
                  <th className="py-3 px-4 text-center">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredAuditItems.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
                  <tr
                    key={item.itemCode}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      item.hasObsoleteWithStockAlert ? 'bg-amber-50/40' : item.situacao === 'Totalmente Obsoleto' ? 'bg-slate-50/30 text-slate-500' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-emerald-800">
                      {item.itemCode}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        Família {item.familia} · {item.un}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs font-mono font-semibold text-slate-900">
                      {item.descricao60c}
                    </td>

                    <td className="py-3 px-4 max-w-sm">
                      {item.narrativa200c ? (
                        <div className="text-[11px] text-slate-700 font-mono line-clamp-2" title={item.narrativa200c}>
                          {item.narrativa200c}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sem narrativa complementar</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap font-mono">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.situacao === 'Totalmente Obsoleto'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {item.situacao}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                      <span className={item.saldo10 > 0 ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                        {item.saldo10} {item.un}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                      <span className={item.saldo14 > 0 ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                        {item.saldo14} {item.un}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {item.hasObsoleteWithStockAlert ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Obsoleto c/ Estoque</span>
                        </span>
                      ) : item.totalSaldo > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3" />
                          <span>Saldo Ativo</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400">
                          Sem Saldo Físico
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination strip */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs text-slate-600">
            <div>
              Exibindo <strong>{(currentPage - 1) * pageSize + 1}</strong> a <strong>{Math.min(currentPage * pageSize, filteredAuditItems.length)}</strong> de <strong>{filteredAuditItems.length}</strong> itens auditados
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="font-mono text-xs">
                Pág. {currentPage} de {Math.max(1, Math.ceil(filteredAuditItems.length / pageSize))}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= Math.ceil(filteredAuditItems.length / pageSize)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
