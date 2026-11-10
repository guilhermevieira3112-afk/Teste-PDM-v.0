import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Upload, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Layers, 
  ShieldAlert, 
  Info,
  Image as ImageIcon,
  Sliders
} from 'lucide-react';
import { Group, Subgroup, SpecificSubgroup, PDMItem, UserRole, Tenant } from '../../types/pdm';
import { INDUSTRIAL_TAXONOMY } from '../../data/taxonomy';
import { generateShortDescription, generateLongDescription, calculateDuplicateSimilarity } from '../../utils/pdmGenerator';

interface PDMBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  currentTenant: Tenant;
  existingItems: PDMItem[];
  onSaveItem: (item: Partial<PDMItem>) => void;
}

export const PDMBuilderModal: React.FC<PDMBuilderModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  currentTenant,
  existingItems,
  onSaveItem,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(INDUSTRIAL_TAXONOMY[0].id);
  const [selectedSubgroupId, setSelectedSubgroupId] = useState<string>(INDUSTRIAL_TAXONOMY[0].subgroups[0].id);
  const [selectedSpecificSubgroupId, setSelectedSpecificSubgroupId] = useState<string>(
    INDUSTRIAL_TAXONOMY[0].subgroups[0].specificSubgroups[0].id
  );

  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ncmOverride, setNcmOverride] = useState<string>('');
  const [unspscOverride, setUnspscOverride] = useState<string>('');
  const [totvsFamilyInput, setTotvsFamilyInput] = useState<string>('5040');
  // TOTVS CE0348 fields
  const [narrativeInput, setNarrativeInput] = useState<string>('');
  const [leadTimeInput, setLeadTimeInput] = useState<number>(15);
  const [orderPointInput, setOrderPointInput] = useState<number>(1);
  const [safetyStockInput, setSafetyStockInput] = useState<number>(1);
  const [unitOfMeasureInput, setUnitOfMeasureInput] = useState<string>('UN');
  const [targetEstab, setTargetEstab] = useState<'10' | '14' | 'BOTH'>('10');

  // Find active group, subgroup and specific subgroup
  const activeGroup = useMemo(() => 
    INDUSTRIAL_TAXONOMY.find((g) => g.id === selectedGroupId) || INDUSTRIAL_TAXONOMY[0],
    [selectedGroupId]
  );

  const activeSubgroup = useMemo(() => 
    activeGroup.subgroups.find((s) => s.id === selectedSubgroupId) || activeGroup.subgroups[0],
    [activeGroup, selectedSubgroupId]
  );

  const activeSpecificSubgroup = useMemo(() => 
    activeSubgroup.specificSubgroups.find((spec) => spec.id === selectedSpecificSubgroupId) || activeSubgroup.specificSubgroups[0],
    [activeSubgroup, selectedSpecificSubgroupId]
  );

  // When changing specific subgroup, reset attributes
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = INDUSTRIAL_TAXONOMY.find((g) => g.id === groupId);
    if (grp && grp.subgroups.length > 0) {
      setSelectedSubgroupId(grp.subgroups[0].id);
      if (grp.subgroups[0].specificSubgroups.length > 0) {
        setSelectedSpecificSubgroupId(grp.subgroups[0].specificSubgroups[0].id);
      }
    }
    setAttributes({});
  };

  const handleSubgroupChange = (subgroupId: string) => {
    setSelectedSubgroupId(subgroupId);
    const sub = activeGroup.subgroups.find((s) => s.id === subgroupId);
    if (sub && sub.specificSubgroups.length > 0) {
      setSelectedSpecificSubgroupId(sub.specificSubgroups[0].id);
    }
    setAttributes({});
  };

  const handleSpecificSubgroupChange = (specId: string) => {
    setSelectedSpecificSubgroupId(specId);
    setAttributes({});
  };

  const handleAttributeChange = (attributeId: string, value: string) => {
    setAttributes((prev) => ({
      ...prev,
      [attributeId]: value,
    }));
  };

  // Real-time generated descriptions
  const shortDescResult = useMemo(() => {
    return generateShortDescription(activeSpecificSubgroup, attributes);
  }, [activeSpecificSubgroup, attributes]);

  const longDesc = useMemo(() => {
    return generateLongDescription(activeSpecificSubgroup, attributes);
  }, [activeSpecificSubgroup, attributes]);

  // Real-time duplicate similarity check against existing catalog
  const duplicateWarning = useMemo(() => {
    let highestScore = 0;
    let mostSimilarItem: PDMItem | null = null;
    let matchDetails: string[] = [];

    for (const item of existingItems) {
      const result = calculateDuplicateSimilarity(
        {
          specificSubgroupId: activeSpecificSubgroup.id,
          attributes,
          shortDesc: shortDescResult.shortDescription,
        },
        item
      );

      if (result.score > highestScore) {
        highestScore = result.score;
        mostSimilarItem = item;
        matchDetails = result.matchingKeys;
      }
    }

    if (highestScore >= 70 && mostSimilarItem) {
      return {
        score: highestScore,
        item: mostSimilarItem,
        matchingKeys: matchDetails,
      };
    }
    return null;
  }, [activeSpecificSubgroup, attributes, shortDescResult, existingItems]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = () => {
    setImagePreview('https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check mandatory fields
    const missingFields = activeSpecificSubgroup.attributeDefinitions
      .filter((def) => def.required && !attributes[def.id])
      .map((def) => def.label);

    if (missingFields.length > 0) {
      alert(`Por favor preencha os campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    const ncm = ncmOverride.trim() || activeSpecificSubgroup.defaultNcm;
    const unspsc = unspscOverride.trim() || activeSpecificSubgroup.defaultUnspsc;

    const isMaster = currentUserRole === 'MASTER_ADMIN';
    const status = isMaster 
      ? 'APPROVED' 
      : duplicateWarning && duplicateWarning.score >= 85 
        ? 'FLAGGED_DUPLICATE' 
        : 'PENDING_REVIEW';

    const establishments: Record<string, any> = {};
    const e10Stock = {
      estabelecimento: '10',
      plantaNome: 'Dourado/SP',
      saldoEstoque: 0,
      pontoEncomenda: Number(orderPointInput) || 1,
      estoqueSegurancaAlmoxarifado: Number(safetyStockInput) || 1,
      tempoRessuprimento: Number(leadTimeInput) || 15,
      ultimaEntrada: '',
      ultimaSaida: '',
    };
    const e14Stock = {
      estabelecimento: '14',
      plantaNome: 'Porto Amazonas/PR',
      saldoEstoque: 0,
      pontoEncomenda: Number(orderPointInput) || 1,
      estoqueSegurancaAlmoxarifado: Number(safetyStockInput) || 1,
      tempoRessuprimento: Number(leadTimeInput) || 15,
      ultimaEntrada: '',
      ultimaSaida: '',
    };

    if (targetEstab === '10' || targetEstab === 'BOTH') establishments['10'] = e10Stock;
    if (targetEstab === '14' || targetEstab === 'BOTH') establishments['14'] = e14Stock;

    const finalNarrative = narrativeInput.trim().slice(0, 200);

    const newItemData: Partial<PDMItem> = {
      groupId: activeGroup.id,
      subgroupId: activeSubgroup.id,
      specificSubgroupId: activeSpecificSubgroup.id,
      shortDescription: shortDescResult.shortDescription,
      narrative: finalNarrative,
      longDescription: finalNarrative ? `${shortDescResult.shortDescription} - ${finalNarrative}` : longDesc,
      attributes,
      ncm,
      unspsc,
      genericImage: imagePreview || undefined,
      status,
      notes: notes.trim(),
      totvsFamily: totvsFamilyInput.trim() || '5040',
      unitOfMeasure: unitOfMeasureInput.trim() || 'UN',
      leadTimeDays: Number(leadTimeInput) || 15,
      orderPoint: Number(orderPointInput) || 1,
      safetyStockWarehouse: Number(safetyStockInput) || 1,
      establishments,
      totvsPlant: targetEstab === 'BOTH' ? 'Dourado & Paraná' : (targetEstab === '10' ? 'Dourado' : 'Paraná'),
      requestedByTenantId: isMaster ? undefined : currentTenant.id,
      requestedByTenantName: isMaster ? undefined : currentTenant.name,
      requestedByUser: isMaster ? 'Master Admin' : `Almoxarife PremieRpet (${currentTenant.code})`,
      duplicateOfId: duplicateWarning ? duplicateWarning.item.id : undefined,
      similarityScore: duplicateWarning ? duplicateWarning.score : undefined,
    };

    onSaveItem(newItemData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800">
        
        {/* MODAL HEADER (LIGHT THEME) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>PDM Builder · Construtor de Narrativa Técnica PremieRpet</span>
                {currentUserRole === 'MASTER_ADMIN' ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                    Aprovação Direta Master
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 font-bold">
                    Solicitação via {currentTenant.code}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Padronização de materiais em conformidade com o ERP TOTVS e dicionário técnico industrial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* DUPLICATE WARNING CALLOUT */}
          {duplicateWarning && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3 text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-2">
                  <span>Alerta de Duplicidade no ERP TOTVS ({duplicateWarning.score}% de Similaridade)</span>
                </div>
                <p className="text-slate-700">
                  Um item equivalente já está homologado no TOTVS:{' '}
                  <span className="font-mono text-emerald-900 font-bold">{duplicateWarning.item.totvsCode || duplicateWarning.item.pdmCode}</span> -{' '}
                  <span className="italic font-medium">{duplicateWarning.item.shortDescription}</span>
                </p>
                <div className="text-[11px] text-amber-800">
                  Ao submeter, este cadastro cairá na Fila de Saneamento sinalizado para validação do Master Admin.
                </div>
              </div>
            </div>
          )}

          {/* 1. TAXONOMIC CASCADE SELECTORS (3 NÍVEIS) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>1. Classificação Taxonômica (Grupo / Subgrupo / Família)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Grupo */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nível 1 · Grupo Industrial
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
                >
                  {INDUSTRIAL_TAXONOMY.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} - {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subgrupo */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nível 2 · Subgrupo
                </label>
                <select
                  value={selectedSubgroupId}
                  onChange={(e) => handleSubgroupChange(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
                >
                  {activeGroup.subgroups.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subgrupo Específico */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nível 3 · Família / Subgrupo Específico
                </label>
                <select
                  value={selectedSpecificSubgroupId}
                  onChange={(e) => handleSpecificSubgroupChange(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
                >
                  {activeSubgroup.specificSubgroups.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.code} - {spec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. DYNAMIC ATTRIBUTES FORM */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>2. Dicionário de Atributos Parametrizados</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeSpecificSubgroup.attributeDefinitions.length} atributos disponíveis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeSpecificSubgroup.attributeDefinitions.map((attrDef) => (
                <div key={attrDef.id} className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    {attrDef.label}
                    {attrDef.required && <span className="text-rose-600 ml-0.5">*</span>}
                    {attrDef.unit && (
                      <span className="ml-1 text-[10px] text-slate-400 font-mono">
                        ({attrDef.unit})
                      </span>
                    )}
                  </label>

                  {attrDef.type === 'select' ? (
                    <select
                      value={attributes[attrDef.id] || ''}
                      onChange={(e) => handleAttributeChange(attrDef.id, e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium shadow-2xs"
                    >
                      <option value="">Selecione...</option>
                      {attrDef.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={attrDef.type === 'number' ? 'number' : 'text'}
                      step="any"
                      placeholder={attrDef.placeholder || ''}
                      value={attributes[attrDef.id] || ''}
                      onChange={(e) => handleAttributeChange(attrDef.id, e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-mono shadow-2xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. REAL-TIME NARRATIVE BUILDER PREVIEWS */}
          <div className="space-y-4 p-4 rounded-xl bg-emerald-50/40 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <span>3. Gerador em Tempo Real de Descrição ERP & PDM</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-mono font-semibold">Regras Normativas TOTVS</span>
            </div>

            {/* ERP Short Description (60 chars) */}
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  Descrição Curta ERP (Máximo 60 caracteres, sem diacríticos)
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      shortDescResult.charCount <= 60
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {shortDescResult.charCount} / 60 caracteres
                  </span>
                  {shortDescResult.isTruncated && (
                    <span className="text-[10px] text-amber-700 font-bold">Truncado</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-emerald-950 font-bold tracking-wide select-all break-all">
                {shortDescResult.shortDescription || 'AGUARDANDO PREENCHIMENTO DOS ATRIBUTOS...'}
              </div>
              <p className="text-[10px] text-slate-500">
                Padrão caixa alta, abreviações técnicas universais, pronto para carga direta via BAPI/IDoc TOTVS.
              </p>
            </div>

            {/* Technical Long Description */}
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-1.5 shadow-2xs">
              <span className="block font-bold text-xs text-slate-800">
                Descrição Longa Técnica (Engenharia & Confiabilidade)
              </span>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed font-mono select-all">
                {longDesc}
              </div>
            </div>

            {/* Fiscal & TOTVS Family classification */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Família TOTVS Protheus
                </label>
                <input
                  type="text"
                  value={totvsFamilyInput}
                  onChange={(e) => setTotvsFamilyInput(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Classificação Fiscal NCM
                </label>
                <input
                  type="text"
                  placeholder={activeSpecificSubgroup.defaultNcm}
                  value={ncmOverride}
                  onChange={(e) => setNcmOverride(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Código UNSPSC Global
                </label>
                <input
                  type="text"
                  placeholder={activeSpecificSubgroup.defaultUnspsc}
                  value={unspscOverride}
                  onChange={(e) => setUnspscOverride(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          {/* 3.5. TOTVS CE0348 ESPECIFICAÇÕES & ESTOQUE */}
          <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-700" />
                <span>3.5. Parâmetros de Almoxarifado & Narrativa TOTVS (Base CE0348)</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Padrão Protheus Estab. 10 & 14
              </span>
            </div>

            {/* Narrativa do Item (Coluna AF - Até 200 caracteres) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-semibold text-slate-800">
                  Narrativa do Item (Coluna AF - Limite estrito de 200 caracteres):
                </label>
                <span className={`font-mono font-bold ${
                  narrativeInput.length > 200 ? 'text-rose-600' : 'text-emerald-800'
                }`}>
                  {narrativeInput.length} / 200 caracteres
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={200}
                value={narrativeInput}
                onChange={(e) => setNarrativeInput(e.target.value)}
                placeholder="Ex: Part Number OEM 6205-2RSH/C3 SKF, diâmetro 25mm, aplicação esteira linha de secagem..."
                className="w-full text-xs bg-white border border-emerald-200 rounded-xl p-2.5 text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs leading-relaxed"
              />
              <p className="text-[10px] text-slate-500">
                Utilizada como complemento da descrição no TOTVS. Indexada para pesquisa inteligente <strong>E/OU</strong> nas unidades.
              </p>
            </div>

            {/* Grid com Lead Time, Ponto Encomenda, Estoque de Segurança e Unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {/* Tempo Ressuprimento (Lead Time em dias - Col K) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tempo Ressuprimento (Col K)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={leadTimeInput}
                    onChange={(e) => setLeadTimeInput(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 pr-12 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-mono">
                    dias
                  </span>
                </div>
              </div>

              {/* Ponto de Encomenda (Lote mínimo para compra - Col H) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1" title="Lote mínimo de reposição">
                  Ponto Encomenda (Col H)
                </label>
                <input
                  type="number"
                  min={0}
                  value={orderPointInput}
                  onChange={(e) => setOrderPointInput(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
                />
              </div>

              {/* Estoque de segurança almoxarifado (Col I) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Estoque de Segurança (Col I)
                </label>
                <input
                  type="number"
                  min={0}
                  value={safetyStockInput}
                  onChange={(e) => setSafetyStockInput(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
                />
              </div>

              {/* Unidade de Medida (Col D) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Unidade de Medida (Col D)
                </label>
                <select
                  value={unitOfMeasureInput}
                  onChange={(e) => setUnitOfMeasureInput(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
                >
                  <option value="UN">UN - Unidade</option>
                  <option value="PC">PC - Peça</option>
                  <option value="KG">KG - Quilograma</option>
                  <option value="MT">MT - Metro</option>
                  <option value="LT">LT - Litro</option>
                  <option value="CJ">CJ - Conjunto</option>
                  <option value="JG">JG - Jogo</option>
                  <option value="RL">RL - Rolo</option>
                </select>
              </div>
            </div>

            {/* Estabelecimento de Destino */}
            <div className="pt-1">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Estabelecimento de Destino PremieRpet (Coluna E)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetEstab('10')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                    targetEstab === '10'
                      ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold">Estabelecimento 10</span>
                  <span className="text-[10px] text-slate-500 font-normal">Unidade Dourado / SP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetEstab('14')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                    targetEstab === '14'
                      ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold">Estabelecimento 14</span>
                  <span className="text-[10px] text-slate-500 font-normal">Unidade Porto Amazonas / PR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetEstab('BOTH')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                    targetEstab === 'BOTH'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold">Ambas as Plantas</span>
                  <span className="text-[10px] text-slate-500 font-normal">Dourado (10) & Paraná (14)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. IMAGES & OBSERVATIONS */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-700" />
              <span>4. Imagem Técnica / Foto do Equipamento</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {imagePreview ? (
                <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0 shadow-xs">
                  <img
                    src={imagePreview}
                    alt="Preview técnico"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/70 text-white hover:bg-rose-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs shrink-0 bg-white">
                  <ImageIcon className="w-6 h-6 mb-1 text-slate-400" />
                  <span>Sem Imagem</span>
                </div>
              )}

              <div className="flex-1 space-y-2 w-full">
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Foto do Almoxarifado</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capturar Câmera Operacional</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Fotos com placa de identificação do motor, bomba ou código gravado facilitam a homologação pelo Master.
                </p>
              </div>
            </div>

            {/* Justificativa */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Aplicação na Planta / Justificativa da Solicitação
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Aplicação na extrusora de secos L6 ou ensacadora rotativa da Fábrica Dourado."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium"
              />
            </div>
          </div>

        </form>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {currentUserRole === 'MASTER_ADMIN'
                ? 'Homologar & Publicar no Catálogo Global'
                : 'Enviar para Fila de Governança Master'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
