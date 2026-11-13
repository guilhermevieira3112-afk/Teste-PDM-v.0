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
  Sliders,
  DollarSign,
  Paperclip,
  FileCheck,
  Check
} from 'lucide-react';
import { Group, Subgroup, SpecificSubgroup, PDMItem, UserRole, Tenant, AttributeDefinition, ApprovalTierLevel, ApprovalStepRecord } from '../../types/pdm';
import { INDUSTRIAL_TAXONOMY } from '../../data/taxonomy';
import { PdmNivelItem, INITIAL_PDM_NIVEIS, getNiveis1List, getNiveis2List, getNiveis3List } from '../../data/pdmNiveisData';
import { generateShortDescription, generateLongDescription, calculateDuplicateSimilarity } from '../../utils/pdmGenerator';

interface PDMBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  currentTenant: Tenant;
  existingItems: PDMItem[];
  onSaveItem: (item: Partial<PDMItem>) => void;
  pdmLevels?: PdmNivelItem[];
}

export const PDMBuilderModal: React.FC<PDMBuilderModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  currentTenant,
  existingItems,
  onSaveItem,
  pdmLevels,
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

  // Quotation (Orçamento / Proposta Comercial obrigatório para novos itens)
  const [supplierNameInput, setSupplierNameInput] = useState<string>('SKF do Brasil Ltda');
  const [quoteNumberInput, setQuoteNumberInput] = useState<string>('COT-2026-0849');
  const [quoteValueInput, setQuoteValueInput] = useState<number | ''>(850);
  const [quoteFileName, setQuoteFileName] = useState<string>('Orcamento_Comercial_Fornecedor_SKF.pdf');
  const [quoteNotesInput, setQuoteNotesInput] = useState<string>('Proposta com frete CIF Fábrica PremieRpet e garantia técnica de 12 meses.');

  // MRO 3-Level Dynamic Classification (Niveis_PDM_MRO_Padronizado)
  const effectiveLevels = useMemo(() => (pdmLevels && pdmLevels.length > 0 ? pdmLevels : INITIAL_PDM_NIVEIS), [pdmLevels]);
  const niveis1Options = useMemo(() => getNiveis1List(effectiveLevels), [effectiveLevels]);
  const [selectedNivel1, setSelectedNivel1] = useState<string>(() => niveis1Options[0] || 'Mecânica e Transmissão');
  
  const niveis2Options = useMemo(() => {
    return getNiveis2List(effectiveLevels, selectedNivel1);
  }, [effectiveLevels, selectedNivel1]);
  const [selectedNivel2, setSelectedNivel2] = useState<string>(() => niveis2Options[0] || '');

  const niveis3Options = useMemo(() => {
    return getNiveis3List(effectiveLevels, selectedNivel1, selectedNivel2);
  }, [effectiveLevels, selectedNivel1, selectedNivel2]);
  const [selectedNivel3, setSelectedNivel3] = useState<string>(() => niveis3Options[0] || '');

  const handleNivel1Change = (n1: string) => {
    setSelectedNivel1(n1);
    const n2s = getNiveis2List(effectiveLevels, n1);
    const firstN2 = n2s[0] || '';
    setSelectedNivel2(firstN2);
    const n3s = getNiveis3List(effectiveLevels, n1, firstN2);
    setSelectedNivel3(n3s[0] || '');

    // Map to group taxonomy for attributes
    const lower = n1.toLowerCase();
    if (lower.includes('elétric') || lower.includes('automa')) {
      handleGroupChange('grp-eletrica');
    } else if (lower.includes('hidrául') || lower.includes('pneumát') || lower.includes('utilidade')) {
      handleGroupChange('grp-tubulacao');
    } else {
      handleGroupChange('grp-mecanica');
    }
  };

  const handleNivel2Change = (n2: string) => {
    setSelectedNivel2(n2);
    const n3s = getNiveis3List(effectiveLevels, selectedNivel1, n2);
    setSelectedNivel3(n3s[0] || '');
  };

  const handleNivel3Change = (n3: string) => {
    setSelectedNivel3(n3);
  };

  const activeGroup = useMemo(() => 
    INDUSTRIAL_TAXONOMY.find((g: Group) => g.id === selectedGroupId) || INDUSTRIAL_TAXONOMY[0],
    [selectedGroupId]
  );

  const activeSubgroup = useMemo(() => 
    activeGroup.subgroups.find((s: Subgroup) => s.id === selectedSubgroupId) || activeGroup.subgroups[0],
    [activeGroup, selectedSubgroupId]
  );

  const activeSpecificSubgroup = useMemo(() => 
    activeSubgroup.specificSubgroups.find((spec: SpecificSubgroup) => spec.id === selectedSpecificSubgroupId) || activeSubgroup.specificSubgroups[0],
    [activeSubgroup, selectedSpecificSubgroupId]
  );

  // When changing specific subgroup, reset attributes
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    const grp = INDUSTRIAL_TAXONOMY.find((g: Group) => g.id === groupId);
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
    const sub = activeGroup.subgroups.find((s: Subgroup) => s.id === subgroupId);
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
      .filter((def: AttributeDefinition) => def.required && !attributes[def.id])
      .map((def: AttributeDefinition) => def.label);

    if (missingFields.length > 0) {
      alert(`Por favor preencha os campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    // Check quotation mandatory fields (conforme governança PremieRpet)
    if (!supplierNameInput.trim()) {
      alert('O Nome do Fornecedor Cotado no Orçamento é obrigatório.');
      return;
    }
    if (!quoteNumberInput.trim()) {
      alert('O Número da Cotação / Orçamento é obrigatório.');
      return;
    }
    const quoteVal = Number(quoteValueInput) || 0;
    if (quoteVal <= 0) {
      alert('O Valor Estimado do Orçamento (R$) é obrigatório e deve ser maior que R$ 0,00.');
      return;
    }
    if (!quoteFileName.trim()) {
      alert('O Anexo / Documento do Orçamento é obrigatório para cadastro de novos itens PDM.');
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

    // Determinar Alçadas de Aprovação por Valor:
    // Até R$ 1.000 -> Nível 1
    // R$ 1.000,01 a R$ 10.000 -> Nível 1 e 2
    // Acima de R$ 10.000 -> Nível 1, 2 e 3
    let requiredTiers: ApprovalTierLevel[] = [1];
    if (quoteVal > 10000) {
      requiredTiers = [1, 2, 3];
    } else if (quoteVal > 1000) {
      requiredTiers = [1, 2];
    }

    const approvalSteps: ApprovalStepRecord[] = [
      {
        tier: 1,
        tierLabel: 'Aprovador Nível 1 (até R$ 1.000,00)',
        status: isMaster ? 'APPROVED' : 'PENDING',
        approvedByUser: isMaster ? 'Master Admin' : undefined,
        approvedAt: isMaster ? new Date().toISOString() : undefined,
      },
    ];

    if (requiredTiers.includes(2)) {
      approvalSteps.push({
        tier: 2,
        tierLabel: 'Aprovador Nível 2 (até R$ 10.000,00)',
        status: isMaster ? 'APPROVED' : 'WAITING_PREVIOUS_TIER',
        approvedByUser: isMaster ? 'Master Admin' : undefined,
        approvedAt: isMaster ? new Date().toISOString() : undefined,
      });
    }

    if (requiredTiers.includes(3)) {
      approvalSteps.push({
        tier: 3,
        tierLabel: 'Aprovador Nível 3 (> R$ 10.000,00)',
        status: isMaster ? 'APPROVED' : 'WAITING_PREVIOUS_TIER',
        approvedByUser: isMaster ? 'Master Admin' : undefined,
        approvedAt: isMaster ? new Date().toISOString() : undefined,
      });
    }

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

    const requesterName = isMaster ? 'Master Admin' : `Almoxarife PremieRpet (${currentTenant.code})`;

    const newItemData: Partial<PDMItem> = {
      groupId: activeGroup.id,
      subgroupId: activeSubgroup.id,
      specificSubgroupId: activeSpecificSubgroup.id,
      nivel1: selectedNivel1,
      nivel2: selectedNivel2,
      nivel3: selectedNivel3,
      shortDescription: shortDescResult.shortDescription,
      narrative: finalNarrative,
      longDescription: finalNarrative ? `${shortDescResult.shortDescription} - ${finalNarrative}` : longDesc,
      attributes,
      ncm,
      unspsc,
      baseValue: quoteVal,
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
      requestedByUser: requesterName,
      duplicateOfId: duplicateWarning ? duplicateWarning.item.id : undefined,
      similarityScore: duplicateWarning ? duplicateWarning.score : undefined,
      // Orçamento Obrigatório
      quotation: {
        supplierName: supplierNameInput.trim(),
        quoteNumber: quoteNumberInput.trim(),
        estimatedValue: quoteVal,
        fileName: quoteFileName.trim(),
        fileSize: '482 KB',
        fileDate: new Date().toISOString(),
        notes: quoteNotesInput.trim(),
      },
      // Esteira de Aprovação por Valor
      approvalWorkflow: {
        requiredTiers,
        currentPendingTier: isMaster ? null : 1,
        estimatedValue: quoteVal,
        steps: approvalSteps,
        isFullyApproved: isMaster,
      },
      // Trilha de Auditoria Inicial
      changeHistory: [
        {
          id: 'hist-' + Date.now(),
          timestamp: new Date().toISOString(),
          actionType: 'CREATED',
          actionLabel: 'Solicitação de Cadastro PDM Enviada',
          requestedByUser: requesterName,
          requestedByTenantName: currentTenant.name,
          status: isMaster ? 'APPROVED' : 'PENDING',
          reason: `Solicitação criada com Orçamento do Fornecedor ${supplierNameInput.trim()} (Cotação ${quoteNumberInput.trim()}, Valor R$ ${quoteVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Alçada requerida: ${requiredTiers.map(t => 'Nível ' + t).join(' + ')}.`,
          changes: [],
        },
      ],
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

          {/* 1. TAXONOMIC CASCADE SELECTORS (3 NÍVEIS MRO PADRONIZADO) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>1. Classificação Taxonômica MRO (Estrutura de 3 Níveis PremieRpet)</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Base MRO Níveis Oficial
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Nível 1 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Nível 1 · Grupo Macro *
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {niveis1Options.length} grupos
                  </span>
                </div>
                <select
                  value={selectedNivel1}
                  onChange={(e) => handleNivel1Change(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
                >
                  {niveis1Options.map((n1) => (
                    <option key={n1} value={n1}>
                      {n1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nível 2 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Nível 2 · Subgrupo / Família *
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {niveis2Options.length} subgrupos
                  </span>
                </div>
                <select
                  value={selectedNivel2}
                  onChange={(e) => handleNivel2Change(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
                >
                  {niveis2Options.map((n2) => (
                    <option key={n2} value={n2}>
                      {n2}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nível 3 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Nível 3 · Subgrupo Específico *
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {niveis3Options.length} opções
                  </span>
                </div>
                <select
                  value={selectedNivel3}
                  onChange={(e) => handleNivel3Change(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold shadow-2xs"
                >
                  {niveis3Options.map((n3) => (
                    <option key={n3} value={n3}>
                      {n3}
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
              {activeSpecificSubgroup.attributeDefinitions.map((attrDef: AttributeDefinition) => (
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
                      {attrDef.options?.map((opt: string) => (
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

          {/* 3.6. ORÇAMENTO & PROPOSTA COMERCIAL DO FORNECEDOR (OBRIGATÓRIO) */}
          <div className="p-4 rounded-xl bg-blue-50/50 border-2 border-blue-200 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-blue-950 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-700" />
                <span>3.6. Orçamento & Proposta Comercial (Obrigatório Conforme Governança)</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 w-fit">
                Anexo & Alçadas por Valor
              </span>
            </div>

            {/* ALÇADAS DE APROVAÇÃO BANNER */}
            <div className="p-3 rounded-xl bg-white border border-blue-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Matriz Corporativa de Alçadas de Aprovação PDM:
                </span>
                <span className="text-[11px] font-mono font-bold text-blue-900">
                  {Number(quoteValueInput) > 10000 ? (
                    <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Requer Aprovação Nível 1 + Nível 2 + Nível 3
                    </span>
                  ) : Number(quoteValueInput) > 1000 ? (
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Requer Aprovação Nível 1 + Nível 2
                    </span>
                  ) : (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Requer Aprovação Nível 1 (até R$ 1.000,00)
                    </span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className={`p-2 rounded-lg border ${
                  Number(quoteValueInput) <= 1000 ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-950 ring-1 ring-emerald-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <span className="block text-[10px] text-slate-500 uppercase font-sans">Alçada 1</span>
                  <span>Até R$ 1.000,00</span>
                  <span className="block text-[10px] font-sans font-normal text-slate-500">Aprovador Nível 1</span>
                </div>

                <div className={`p-2 rounded-lg border ${
                  Number(quoteValueInput) > 1000 && Number(quoteValueInput) <= 10000 ? 'bg-blue-50 border-blue-300 font-bold text-blue-950 ring-1 ring-blue-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <span className="block text-[10px] text-slate-500 uppercase font-sans">Alçada 2</span>
                  <span>R$ 1.000,01 a R$ 10.000,00</span>
                  <span className="block text-[10px] font-sans font-normal text-slate-500">Nível 1 + Nível 2</span>
                </div>

                <div className={`p-2 rounded-lg border ${
                  Number(quoteValueInput) > 10000 ? 'bg-purple-50 border-purple-300 font-bold text-purple-950 ring-1 ring-purple-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <span className="block text-[10px] text-slate-500 uppercase font-sans">Alçada 3</span>
                  <span>Acima de R$ 10.000,00</span>
                  <span className="block text-[10px] font-sans font-normal text-slate-500">Nível 1 + Nível 2 + Nível 3</span>
                </div>
              </div>
            </div>

            {/* INPUTS DE ORÇAMENTO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Fornecedor Cotado <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SKF do Brasil, NSK, SEW-Eurodrive..."
                  value={supplierNameInput}
                  onChange={(e) => setSupplierNameInput(e.target.value)}
                  className="w-full text-xs bg-white border border-blue-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nº do Orçamento / Cotação <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: COT-2026-0849 ou PROP-7819"
                  value={quoteNumberInput}
                  onChange={(e) => setQuoteNumberInput(e.target.value)}
                  className="w-full text-xs bg-white border border-blue-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Valor Estimado Unitário (R$) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono font-bold text-slate-500">
                    R$
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    required
                    placeholder="0,00"
                    value={quoteValueInput}
                    onChange={(e) => setQuoteValueInput(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs bg-white border border-blue-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* ANEXO DO ARQUIVO DE ORÇAMENTO (PDF) */}
            <div className="p-3 rounded-xl bg-white border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-xs font-bold text-slate-900 font-mono">
                      {quoteFileName || 'Nenhum orçamento anexado'}
                    </strong>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                      PDF Válido
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Proposta formal do fornecedor anexada com validade de preços e tributos.
                  </p>
                </div>
              </div>

              <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 shrink-0">
                <Paperclip className="w-3.5 h-3.5 text-blue-700" />
                <span>Alterar Arquivo PDF</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setQuoteFileName(file.name);
                  }}
                  className="hidden"
                />
              </label>
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
