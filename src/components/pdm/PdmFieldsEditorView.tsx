import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  RotateCcw, 
  FolderTree, 
  Sliders, 
  Tag, 
  ChevronRight,
  Database,
  ArrowRight,
  Check,
  X,
  FileSpreadsheet,
  PackageCheck,
  ShieldCheck,
  Table as TableIcon
} from 'lucide-react';
import { PdmNivelItem, INITIAL_PDM_NIVEIS, getNiveis1List, getNiveis2List, getNiveis3List } from '../../data/pdmNiveisData';
import { PDMItem } from '../../types/pdm';

interface PdmFieldsEditorViewProps {
  niveis: PdmNivelItem[];
  onUpdateNiveis: (newNiveis: PdmNivelItem[]) => void;
  catalogItems: PDMItem[];
  onShowToast: (msg: string) => void;
}

export const PdmFieldsEditorView: React.FC<PdmFieldsEditorViewProps> = ({
  niveis,
  onUpdateNiveis,
  catalogItems,
  onShowToast,
}) => {
  // Navigation / Selection in column explorer
  const [selectedN1, setSelectedN1] = useState<string>('');
  const [selectedN2, setSelectedN2] = useState<string>('');
  
  // Search filters
  const [searchN1, setSearchN1] = useState('');
  const [searchN2, setSearchN2] = useState('');
  const [searchN3, setSearchN3] = useState('');
  const [globalTableSearch, setGlobalTableSearch] = useState('');

  // View Mode: 'columns' (interactive 3-column explorer) or 'table' (flat table view)
  const [viewMode, setViewMode] = useState<'columns' | 'table'>('columns');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'ADD_N1' | 'ADD_N2' | 'ADD_N3' | 'EDIT_NODE'>('ADD_N1');
  const [targetEditNode, setTargetEditNode] = useState<{ level: 1 | 2 | 3; originalName: string; parentN1?: string; parentN2?: string } | null>(null);

  // Form fields
  const [formN1Name, setFormN1Name] = useState('');
  const [formN2Name, setFormN2Name] = useState('');
  const [formN3Name, setFormN3Name] = useState('');

  // Derived lists
  const niveis1List = useMemo(() => getNiveis1List(niveis), [niveis]);

  // Set default selected N1 if none or invalid
  const activeN1 = useMemo(() => {
    if (selectedN1 && niveis1List.includes(selectedN1)) return selectedN1;
    return niveis1List[0] || '';
  }, [selectedN1, niveis1List]);

  const niveis2List = useMemo(() => {
    if (!activeN1) return [];
    return getNiveis2List(niveis, activeN1);
  }, [niveis, activeN1]);

  const activeN2 = useMemo(() => {
    if (selectedN2 && niveis2List.includes(selectedN2)) return selectedN2;
    return niveis2List[0] || '';
  }, [selectedN2, niveis2List]);

  const niveis3List = useMemo(() => {
    if (!activeN1 || !activeN2) return [];
    return getNiveis3List(niveis, activeN1, activeN2);
  }, [niveis, activeN1, activeN2]);

  // Catalog item counts per Nivel 1
  const n1ItemCounts = useMemo(() => {
    const map = new Map<string, number>();
    catalogItems.forEach((item) => {
      if (item.nivel1) {
        map.set(item.nivel1, (map.get(item.nivel1) || 0) + 1);
      }
    });
    return map;
  }, [catalogItems]);

  // Unique counts for metrics
  const totalN1Count = niveis1List.length;
  const totalN2Count = useMemo(() => {
    const set = new Set<string>();
    niveis.forEach(n => {
      if (n.nivel1 && n.nivel2) set.add(`${n.nivel1}:::${n.nivel2}`);
    });
    return set.size;
  }, [niveis]);
  const totalN3Count = niveis.length;

  // Filtered lists for explorer columns
  const filteredN1 = useMemo(() => {
    if (!searchN1.trim()) return niveis1List;
    const q = searchN1.toLowerCase();
    return niveis1List.filter(n => n.toLowerCase().includes(q));
  }, [niveis1List, searchN1]);

  const filteredN2 = useMemo(() => {
    if (!searchN2.trim()) return niveis2List;
    const q = searchN2.toLowerCase();
    return niveis2List.filter(n => n.toLowerCase().includes(q));
  }, [niveis2List, searchN2]);

  const filteredN3 = useMemo(() => {
    if (!searchN3.trim()) return niveis3List;
    const q = searchN3.toLowerCase();
    return niveis3List.filter(n => n.toLowerCase().includes(q));
  }, [niveis3List, searchN3]);

  // Filtered flat table
  const filteredTableNiveis = useMemo(() => {
    if (!globalTableSearch.trim()) return niveis;
    const q = globalTableSearch.toLowerCase();
    return niveis.filter(n => 
      n.nivel1.toLowerCase().includes(q) ||
      n.nivel2.toLowerCase().includes(q) ||
      n.nivel3.toLowerCase().includes(q)
    );
  }, [niveis, globalTableSearch]);

  // --- ACTIONS ---

  const handleOpenAddN1 = () => {
    setModalType('ADD_N1');
    setFormN1Name('');
    setFormN2Name('');
    setFormN3Name('');
    setIsModalOpen(true);
  };

  const handleOpenAddN2 = () => {
    setModalType('ADD_N2');
    setFormN1Name(activeN1);
    setFormN2Name('');
    setFormN3Name('');
    setIsModalOpen(true);
  };

  const handleOpenAddN3 = () => {
    setModalType('ADD_N3');
    setFormN1Name(activeN1);
    setFormN2Name(activeN2);
    setFormN3Name('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (level: 1 | 2 | 3, originalName: string, parentN1?: string, parentN2?: string) => {
    setModalType('EDIT_NODE');
    setTargetEditNode({ level, originalName, parentN1, parentN2 });
    if (level === 1) setFormN1Name(originalName);
    if (level === 2) setFormN2Name(originalName);
    if (level === 3) setFormN3Name(originalName);
    setIsModalOpen(true);
  };

  const handleDeleteN1 = (n1Name: string) => {
    if (!confirm(`Atenção: Tem certeza que deseja excluir o Nível 1 "${n1Name}" e todos os seus subgrupos associados?`)) {
      return;
    }
    const updated = niveis.filter(n => n.nivel1 !== n1Name);
    onUpdateNiveis(updated);
    onShowToast(`Nível 1 "${n1Name}" e subgrupos removidos com sucesso.`);
  };

  const handleDeleteN2 = (n1Name: string, n2Name: string) => {
    if (!confirm(`Deseja excluir o Subgrupo Nível 2 "${n2Name}" de "${n1Name}"?`)) {
      return;
    }
    const updated = niveis.filter(n => !(n.nivel1 === n1Name && n.nivel2 === n2Name));
    onUpdateNiveis(updated);
    onShowToast(`Subgrupo "${n2Name}" removido.`);
  };

  const handleDeleteN3 = (n1Name: string, n2Name: string, n3Name: string) => {
    if (!confirm(`Deseja excluir o item Nível 3 "${n3Name}"?`)) {
      return;
    }
    const updated = niveis.filter(n => !(n.nivel1 === n1Name && n.nivel2 === n2Name && n.nivel3 === n3Name));
    onUpdateNiveis(updated);
    onShowToast(`Nível 3 "${n3Name}" removido.`);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();

    if (modalType === 'ADD_N1') {
      const n1 = formN1Name.trim();
      const n2 = formN2Name.trim() || 'Geral';
      const n3 = formN3Name.trim() || 'Item Padrão';
      if (!n1) return;

      const newItem: PdmNivelItem = {
        id: `lvl-${Date.now()}`,
        nivel1: n1,
        nivel2: n2,
        nivel3: n3
      };
      const updated = [...niveis, newItem];
      onUpdateNiveis(updated);
      setSelectedN1(n1);
      setSelectedN2(n2);
      onShowToast(`Novo Nível 1 "${n1}" criado e integrado à base PDM!`);
    } else if (modalType === 'ADD_N2') {
      const n1 = formN1Name.trim();
      const n2 = formN2Name.trim();
      const n3 = formN3Name.trim() || 'Item Padrão';
      if (!n1 || !n2) return;

      const newItem: PdmNivelItem = {
        id: `lvl-${Date.now()}`,
        nivel1: n1,
        nivel2: n2,
        nivel3: n3
      };
      const updated = [...niveis, newItem];
      onUpdateNiveis(updated);
      setSelectedN1(n1);
      setSelectedN2(n2);
      onShowToast(`Subgrupo "${n2}" adicionado ao Nível 1 "${n1}"!`);
    } else if (modalType === 'ADD_N3') {
      const n1 = formN1Name.trim();
      const n2 = formN2Name.trim();
      const n3 = formN3Name.trim();
      if (!n1 || !n2 || !n3) return;

      const newItem: PdmNivelItem = {
        id: `lvl-${Date.now()}`,
        nivel1: n1,
        nivel2: n2,
        nivel3: n3
      };
      const updated = [...niveis, newItem];
      onUpdateNiveis(updated);
      setSelectedN1(n1);
      setSelectedN2(n2);
      onShowToast(`Nível 3 "${n3}" cadastrado com sucesso!`);
    } else if (modalType === 'EDIT_NODE' && targetEditNode) {
      const { level, originalName, parentN1, parentN2 } = targetEditNode;
      let updated: PdmNivelItem[] = [];

      if (level === 1) {
        const newName = formN1Name.trim();
        if (!newName || newName === originalName) {
          setIsModalOpen(false);
          return;
        }
        updated = niveis.map(n => n.nivel1 === originalName ? { ...n, nivel1: newName } : n);
        setSelectedN1(newName);
        onShowToast(`Nível 1 renomeado de "${originalName}" para "${newName}".`);
      } else if (level === 2 && parentN1) {
        const newName = formN2Name.trim();
        if (!newName || newName === originalName) {
          setIsModalOpen(false);
          return;
        }
        updated = niveis.map(n => (n.nivel1 === parentN1 && n.nivel2 === originalName) ? { ...n, nivel2: newName } : n);
        setSelectedN2(newName);
        onShowToast(`Nível 2 renomeado de "${originalName}" para "${newName}".`);
      } else if (level === 3 && parentN1 && parentN2) {
        const newName = formN3Name.trim();
        if (!newName || newName === originalName) {
          setIsModalOpen(false);
          return;
        }
        updated = niveis.map(n => (n.nivel1 === parentN1 && n.nivel2 === parentN2 && n.nivel3 === originalName) ? { ...n, nivel3: newName } : n);
        onShowToast(`Nível 3 atualizado com sucesso.`);
      }

      onUpdateNiveis(updated);
    }

    setIsModalOpen(false);
  };

  const handleRestoreDefaults = () => {
    if (confirm('Atenção: Deseja restaurar a árvore de níveis para o padrão oficial extraído de Niveis_PDM_MRO_Padronizado.csv? Todas as adições manuais serão redefinidas.')) {
      onUpdateNiveis(INITIAL_PDM_NIVEIS);
      onShowToast('Estrutura de níveis restaurada para o padrão oficial de fábrica.');
    }
  };

  const handleExportCSV = () => {
    const header = 'NÍVEL 1 DESCRIÇÃO;NÍVEL 2 DESCRIÇÃO;NÍVEL 3 DESCRIÇÃO\n';
    const rows = niveis.map(n => `"${n.nivel1}";"${n.nivel2}";"${n.nivel3}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Niveis_PDM_MRO_PremieRpet_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Arquivo CSV com a estrutura de 3 níveis exportado com sucesso!');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP HERO & METRIC BANNER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
              <FolderTree className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Aba Exclusiva Master Admin
                </span>
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                  Sincronização em Tempo Real com Novo PDM
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                Edição de Campos e Níveis PDM · Governança MRO
              </h2>
              <p className="text-xs text-slate-500">
                Gerencie e crie novos itens para os três níveis taxonômicos (Nível 1 Grupo Macro, Nível 2 Subgrupo/Família, Nível 3 Subgrupo Específico). A base atualiza diretamente no site e reflete nas novas solicitações.
              </p>
            </div>
          </div>

          {/* QUICK TOOLBAR BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all"
              title="Exportar estrutura atual em CSV delimitado por ponto e vírgula"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all"
              title="Restaurar para a base inicial do CSV oficial"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('columns')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'columns'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Explorador 3 Níveis</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabela Geral</span>
              </button>
            </div>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
              Nível 1 (Macro Grupos)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-800">{totalN1Count}</span>
              <span className="text-[11px] text-slate-500 font-sans">grupos ativos</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
              Nível 2 (Subgrupos / Famílias)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-slate-800">{totalN2Count}</span>
              <span className="text-[11px] text-slate-500 font-sans">subfamílias</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
              Nível 3 (Subgrupos Específicos)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-900">{totalN3Count}</span>
              <span className="text-[11px] text-slate-500 font-sans">classificações</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
              Itens no Catálogo PDM
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-amber-700">
                {catalogItems.length.toLocaleString('pt-BR')}
              </span>
              <span className="text-[11px] text-slate-500 font-sans">itens MRO</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN VIEW MODES */}

      {/* MODE 1: INTERACTIVE 3-COLUMN EXPLORER */}
      {viewMode === 'columns' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          
          {/* COLUMN 1: NÍVEL 1 (GRUPO MACRO) */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col h-[640px]">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                  Coluna 1
                </span>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Nível 1 · Grupo Macro</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                    {filteredN1.length}
                  </span>
                </h3>
              </div>
              <button
                onClick={handleOpenAddN1}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-2xs transition-colors"
                title="Adicionar novo Grupo Macro Nível 1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Nível 1</span>
              </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar Nível 1..."
                  value={searchN1}
                  onChange={(e) => setSearchN1(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredN1.map((n1) => {
                const isSelected = n1 === activeN1;
                const itemCount = n1ItemCounts.get(n1) || 0;
                const subCount = getNiveis2List(niveis, n1).length;

                return (
                  <div
                    key={n1}
                    onClick={() => {
                      setSelectedN1(n1);
                      const sub = getNiveis2List(niveis, n1);
                      setSelectedN2(sub[0] || '');
                    }}
                    className={`group w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                        : 'hover:bg-slate-50 text-slate-800 border border-transparent hover:border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="truncate text-xs font-semibold">{n1}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                        {subCount} subgrupos · {itemCount} itens
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(1, n1);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          isSelected ? 'hover:bg-emerald-800 text-white' : 'hover:bg-slate-200 text-slate-500'
                        }`}
                        title="Renomear Nível 1"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteN1(n1);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          isSelected ? 'hover:bg-rose-600 text-white' : 'hover:bg-rose-100 text-rose-600'
                        }`}
                        title="Excluir Nível 1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2: NÍVEL 2 (SUBGRUPO / FAMÍLIA) */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col h-[640px]">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                  Coluna 2 (de {activeN1 || 'Nenhum'})
                </span>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Nível 2 · Subgrupo</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                    {filteredN2.length}
                  </span>
                </h3>
              </div>
              <button
                onClick={handleOpenAddN2}
                disabled={!activeN1}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-[11px] shadow-2xs transition-colors"
                title={`Adicionar novo Subgrupo Nível 2 sob ${activeN1}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Nível 2</span>
              </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar Subgrupos..."
                  value={searchN2}
                  onChange={(e) => setSearchN2(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredN2.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs px-4">
                  Nenhum subgrupo cadastrado para o Nível 1 selecionado.
                </div>
              ) : (
                filteredN2.map((n2) => {
                  const isSelected = n2 === activeN2;
                  const specCount = getNiveis3List(niveis, activeN1, n2).length;

                  return (
                    <div
                      key={n2}
                      onClick={() => setSelectedN2(n2)}
                      className={`group w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                        isSelected
                          ? 'bg-blue-700 text-white font-semibold shadow-xs'
                          : 'hover:bg-slate-50 text-slate-800 border border-transparent hover:border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="truncate text-xs font-semibold">{n2}</div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                          {specCount} itens específicos
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(2, n2, activeN1);
                          }}
                          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            isSelected ? 'hover:bg-blue-800 text-white' : 'hover:bg-slate-200 text-slate-500'
                          }`}
                          title="Renomear Nível 2"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteN2(activeN1, n2);
                          }}
                          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            isSelected ? 'hover:bg-rose-600 text-white' : 'hover:bg-rose-100 text-rose-600'
                          }`}
                          title="Excluir Nível 2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 3: NÍVEL 3 (SUBGRUPO ESPECÍFICO) */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col h-[640px]">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                  Coluna 3 (de {activeN2 || 'Nenhum'})
                </span>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Nível 3 · Subgrupo Específico</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {filteredN3.length}
                  </span>
                </h3>
              </div>
              <button
                onClick={handleOpenAddN3}
                disabled={!activeN1 || !activeN2}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-[11px] shadow-2xs transition-colors"
                title={`Adicionar item Nível 3 sob ${activeN2}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Nível 3</span>
              </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar Nível 3..."
                  value={searchN3}
                  onChange={(e) => setSearchN3(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredN3.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs px-4">
                  Nenhum subgrupo específico cadastrado para este ramo.
                </div>
              ) : (
                filteredN3.map((n3) => {
                  return (
                    <div
                      key={n3}
                      className="group w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/50 border border-slate-200/80 bg-white text-xs transition-all shadow-2xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-xs font-semibold text-slate-900 leading-snug">{n3}</div>
                        <div className="text-[10px] font-mono text-emerald-700 mt-0.5">
                          Ativo no formulário Novo PDM
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(3, n3, activeN1, activeN2)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Renomear Nível 3"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleDeleteN3(activeN1, activeN2, n3)}
                          className="p-1 rounded hover:bg-rose-100 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Excluir Nível 3"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODE 2: FLAT GENERAL TABLE */}
      {viewMode === 'table' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar em qualquer nível..."
                value={globalTableSearch}
                onChange={(e) => setGlobalTableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Mostrando <strong>{filteredTableNiveis.length}</strong> de <strong>{niveis.length}</strong> registros
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Nível 1 · Grupo Macro</th>
                  <th className="py-3 px-4">Nível 2 · Subgrupo / Família</th>
                  <th className="py-3 px-4">Nível 3 · Subgrupo Específico</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredTableNiveis.map((row, idx) => (
                  <tr key={row.id || `${row.nivel1}-${row.nivel2}-${row.nivel3}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{row.nivel1}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{row.nivel2}</td>
                    <td className="py-3 px-4 font-mono text-emerald-800 font-bold">{row.nivel3}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(3, row.nivel3, row.nivel1, row.nivel2)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteN3(row.nivel1, row.nivel2, row.nivel3)}
                          className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. MODAL FOR CREATION & EDITING */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {modalType === 'ADD_N1' && 'Novo Nível 1 · Grupo Macro'}
                    {modalType === 'ADD_N2' && `Novo Nível 2 sob ${formN1Name}`}
                    {modalType === 'ADD_N3' && `Novo Nível 3 sob ${formN2Name}`}
                    {modalType === 'EDIT_NODE' && `Editar Nome do Nível ${targetEditNode?.level}`}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Atualização direta da base taxonômica PremieRpet
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveModal} className="p-6 space-y-4 text-xs">
              
              {/* If ADD_N1 */}
              {modalType === 'ADD_N1' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome do Nível 1 (Grupo Macro Industrial) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Instrumentação Analítica"
                      value={formN1Name}
                      onChange={(e) => setFormN1Name(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Subgrupo Nível 2 Inicial (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Transmissores de Ph e Condutividade"
                      value={formN2Name}
                      onChange={(e) => setFormN2Name(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Subgrupo Específico Nível 3 Inicial (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Eletrodo de Ph Industrial"
                      value={formN3Name}
                      onChange={(e) => setFormN3Name(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
              )}

              {/* If ADD_N2 */}
              {modalType === 'ADD_N2' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Grupo Macro Nível 1 (Pai)
                    </label>
                    <select
                      value={formN1Name}
                      onChange={(e) => setFormN1Name(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none"
                    >
                      {niveis1List.map(n1 => (
                        <option key={n1} value={n1}>{n1}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome do Novo Subgrupo Nível 2 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sensores de Nível Radar"
                      value={formN2Name}
                      onChange={(e) => setFormN2Name(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Subgrupo Específico Nível 3 Inicial (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Sensor Radar de Onda Guiada 80GHz"
                      value={formN3Name}
                      onChange={(e) => setFormN3Name(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
              )}

              {/* If ADD_N3 */}
              {modalType === 'ADD_N3' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 space-y-1">
                    <div>Grupo Macro: <strong className="text-slate-900">{formN1Name}</strong></div>
                    <div>Subgrupo: <strong className="text-slate-900">{formN2Name}</strong></div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome do Subgrupo Específico Nível 3 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Sensor Óptico Reflexivo com Supressão"
                      value={formN3Name}
                      onChange={(e) => setFormN3Name(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* If EDIT_NODE */}
              {modalType === 'EDIT_NODE' && targetEditNode && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    Ao renomear, todas as referências deste nível serão atualizadas instantaneamente na base.
                  </p>

                  {targetEditNode.level === 1 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Novo Nome para Nível 1 *
                      </label>
                      <input
                        type="text"
                        required
                        value={formN1Name}
                        onChange={(e) => setFormN1Name(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}

                  {targetEditNode.level === 2 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Novo Nome para Nível 2 *
                      </label>
                      <input
                        type="text"
                        required
                        value={formN2Name}
                        onChange={(e) => setFormN2Name(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}

                  {targetEditNode.level === 3 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Novo Nome para Nível 3 *
                      </label>
                      <input
                        type="text"
                        required
                        value={formN3Name}
                        onChange={(e) => setFormN3Name(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar na Base PDM</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
