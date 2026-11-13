import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Layers, 
  Sliders, 
  Camera, 
  Upload, 
  History, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  Info
} from 'lucide-react';
import { PDMItem, UserRole, Tenant, ItemFieldChange, ItemChangeLog, ItemPendingChange } from '../../types/pdm';
import { PdmNivelItem, INITIAL_PDM_NIVEIS, getNiveis1List, getNiveis2List, getNiveis3List } from '../../data/pdmNiveisData';

interface ItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PDMItem | null;
  currentUserRole: UserRole;
  currentTenant: Tenant;
  niveis: PdmNivelItem[];
  onSubmitChange: (
    itemId: string,
    proposedValues: Partial<PDMItem>,
    fieldChanges: ItemFieldChange[],
    reason: string,
    isDirectApproval: boolean
  ) => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  isOpen,
  onClose,
  item,
  currentUserRole,
  currentTenant,
  niveis,
  onSubmitChange,
}) => {
  if (!isOpen || !item) return null;

  const isMaster = currentUserRole === 'MASTER_ADMIN';

  // Effective Niveis options
  const effectiveLevels = useMemo(() => (niveis && niveis.length > 0 ? niveis : INITIAL_PDM_NIVEIS), [niveis]);
  const niveis1Options = useMemo(() => getNiveis1List(effectiveLevels), [effectiveLevels]);

  // Form State initialized with current item values
  const [nivel1, setNivel1] = useState<string>(() => {
    if (item.nivel1 && item.nivel1 !== 'Pendente de Classificação') return item.nivel1;
    return niveis1Options[0] || 'Mecânica e Transmissão';
  });

  const niveis2Options = useMemo(() => {
    return getNiveis2List(effectiveLevels, nivel1);
  }, [effectiveLevels, nivel1]);

  const [nivel2, setNivel2] = useState<string>(() => {
    if (item.nivel2 && item.nivel2 !== 'Cadastro Direto TOTVS') return item.nivel2;
    return niveis2Options[0] || '';
  });

  const niveis3Options = useMemo(() => {
    return getNiveis3List(effectiveLevels, nivel1, nivel2);
  }, [effectiveLevels, nivel1, nivel2]);

  const [nivel3, setNivel3] = useState<string>(() => {
    if (item.nivel3 && item.nivel3 !== 'Item Não Saneado') return item.nivel3;
    return niveis3Options[0] || '';
  });

  const [shortDescription, setShortDescription] = useState<string>(item.shortDescription || '');
  const [narrative, setNarrative] = useState<string>(item.narrative || '');
  const [ncm, setNcm] = useState<string>(item.ncm || '8482.10.10');
  const [unspsc, setUnspsc] = useState<string>(item.unspsc || '31171504');
  const [totvsFamily, setTotvsFamily] = useState<string>(item.totvsFamily || '5040');
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>(item.unitOfMeasure || 'UN');
  const [genericImage, setGenericImage] = useState<string | undefined>(item.genericImage);
  const [reason, setReason] = useState<string>('');
  const [directApproval, setDirectApproval] = useState<boolean>(isMaster);

  // When Nível 1 changes, cascade Nível 2 and Nível 3
  const handleNivel1Change = (newN1: string) => {
    setNivel1(newN1);
    const n2s = getNiveis2List(effectiveLevels, newN1);
    const firstN2 = n2s[0] || '';
    setNivel2(firstN2);
    const n3s = getNiveis3List(effectiveLevels, newN1, firstN2);
    setNivel3(n3s[0] || '');
  };

  // When Nível 2 changes, cascade Nível 3
  const handleNivel2Change = (newN2: string) => {
    setNivel2(newN2);
    const n3s = getNiveis3List(effectiveLevels, nivel1, newN2);
    setNivel3(n3s[0] || '');
  };

  // Detect which fields were modified compared to original item
  const detectedChanges = useMemo<ItemFieldChange[]>(() => {
    const changes: ItemFieldChange[] = [];

    if (item.nivel1 !== nivel1) {
      changes.push({
        field: 'nivel1',
        fieldLabel: 'Nível 1 · Grupo Macro',
        oldValue: item.nivel1 || '(Vazio)',
        newValue: nivel1,
      });
    }

    if (item.nivel2 !== nivel2) {
      changes.push({
        field: 'nivel2',
        fieldLabel: 'Nível 2 · Subgrupo / Família',
        oldValue: item.nivel2 || '(Vazio)',
        newValue: nivel2,
      });
    }

    if (item.nivel3 !== nivel3) {
      changes.push({
        field: 'nivel3',
        fieldLabel: 'Nível 3 · Subgrupo Específico',
        oldValue: item.nivel3 || '(Vazio)',
        newValue: nivel3,
      });
    }

    if (item.shortDescription !== shortDescription.trim().toUpperCase()) {
      changes.push({
        field: 'shortDescription',
        fieldLabel: 'Descrição do Item (60c)',
        oldValue: item.shortDescription || '(Vazio)',
        newValue: shortDescription.trim().toUpperCase(),
      });
    }

    if ((item.narrative || '') !== narrative.trim()) {
      changes.push({
        field: 'narrative',
        fieldLabel: 'Narrativa do Item (200c)',
        oldValue: item.narrative || '(Sem narrativa)',
        newValue: narrative.trim() || '(Sem narrativa)',
      });
    }

    if (item.ncm !== ncm.trim()) {
      changes.push({
        field: 'ncm',
        fieldLabel: 'Classificação Fiscal (NCM)',
        oldValue: item.ncm || '(Vazio)',
        newValue: ncm.trim(),
      });
    }

    if (item.unspsc !== unspsc.trim()) {
      changes.push({
        field: 'unspsc',
        fieldLabel: 'Código UNSPSC',
        oldValue: item.unspsc || '(Vazio)',
        newValue: unspsc.trim(),
      });
    }

    if (item.totvsFamily !== totvsFamily.trim()) {
      changes.push({
        field: 'totvsFamily',
        fieldLabel: 'Família TOTVS',
        oldValue: item.totvsFamily || '(Vazio)',
        newValue: totvsFamily.trim(),
      });
    }

    if (item.unitOfMeasure !== unitOfMeasure) {
      changes.push({
        field: 'unitOfMeasure',
        fieldLabel: 'Unidade de Medida',
        oldValue: item.unitOfMeasure || 'UN',
        newValue: unitOfMeasure,
      });
    }

    if (item.genericImage !== genericImage && genericImage) {
      changes.push({
        field: 'genericImage',
        fieldLabel: 'Foto Técnica / Imagem',
        oldValue: item.genericImage ? 'Foto anterior' : '(Sem foto)',
        newValue: 'Nova foto cadastrada',
      });
    }

    return changes;
  }, [item, nivel1, nivel2, nivel3, shortDescription, narrative, ncm, unspsc, totvsFamily, unitOfMeasure, genericImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGenericImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (detectedChanges.length === 0) {
      alert('Nenhuma alteração foi realizada em relação ao cadastro atual.');
      return;
    }

    if (!reason.trim()) {
      alert('Por favor, informe a justificativa técnica para o registro de auditoria e governança.');
      return;
    }

    const proposedValues: Partial<PDMItem> = {
      nivel1,
      nivel2,
      nivel3,
      shortDescription: shortDescription.trim().toUpperCase().slice(0, 60),
      narrative: narrative.trim().slice(0, 200),
      longDescription: narrative.trim() ? `${shortDescription.trim().toUpperCase()} - ${narrative.trim()}` : shortDescription.trim().toUpperCase(),
      ncm: ncm.trim(),
      unspsc: unspsc.trim(),
      totvsFamily: totvsFamily.trim() || '5040',
      unitOfMeasure: unitOfMeasure.trim() || 'UN',
      genericImage,
      isClassified: true,
      classificationOrigin: 'PDM_HOMOLOGADO',
    };

    onSubmitChange(item.id, proposedValues, detectedChanges, reason.trim(), isMaster && directApproval);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  Item TOTVS: {item.totvsCode || item.pdmCode}
                </span>
                {item.classificationOrigin === 'TOTVS_SEM_CLASSIFICACAO' ? (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Cadastrado Direto no TOTVS · Não Classificado
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Classificação PDM Homologada
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                Editar Classificação & Parâmetros do Item
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          
          {/* CALLOUT: GOVERNANCE NOTICE */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3 text-blue-900">
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold block">
                {isMaster ? 'Governança Corporativa · Modo Master Admin' : 'Fluxo Oficial de Governança & Auditoria PremieRpet'}
              </span>
              <p className="text-slate-700">
                {isMaster 
                  ? 'Como Master Admin, você pode homologar e atualizar a base global instantaneamente em todos os ambientes (Master, Dourado e Paraná) ou submeter para a fila de governança.'
                  : 'Sua solicitação de alteração será enviada para a Fila de Governança para validação do Master Admin. Todas as alterações geram histórico auditável de solicitante, aprovador e data/hora.'}
              </p>
            </div>
          </div>

          {/* 1. MRO 3-LEVEL CLASSIFICATION (CASCADING) */}
          <div className="space-y-3 p-4 rounded-xl bg-emerald-50/40 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>1. Classificação MRO PremieRpet (3 Níveis)</span>
              </div>
              <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                Replicado em todo o site
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Nível 1 */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nível 1 · Grupo Macro Industrial *
                </label>
                <select
                  value={nivel1}
                  onChange={(e) => handleNivel1Change(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
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
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nível 2 · Subgrupo / Família *
                </label>
                <select
                  value={nivel2}
                  onChange={(e) => handleNivel2Change(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
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
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nível 3 · Subgrupo Específico *
                </label>
                <select
                  value={nivel3}
                  onChange={(e) => setNivel3(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
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

          {/* 2. DESCRIPTIONS (60c & 200c) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>2. Descrição Curta (60c) e Narrativa Técnica (200c) TOTVS</span>
            </div>

            {/* Descrição Curta 60c */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <label className="font-semibold text-slate-700">
                  Descrição do Item (Coluna AE - Limite de 60 caracteres) *
                </label>
                <span className={`font-mono font-bold ${
                  shortDescription.length > 60 ? 'text-rose-600' : 'text-emerald-800'
                }`}>
                  {shortDescription.length} / 60c
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={60}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value.toUpperCase())}
                placeholder="Ex: ROL ESF RIG 6205 25MM 52MM 15MM DDU C3"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs font-bold"
              />
            </div>

            {/* Narrativa do Item 200c */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <label className="font-semibold text-slate-700">
                  Narrativa do Item (Coluna AF - Limite de 200 caracteres, Part Numbers, Detalhes)
                </label>
                <span className={`font-mono font-bold ${
                  narrative.length > 200 ? 'text-rose-600' : 'text-emerald-800'
                }`}>
                  {narrative.length} / 200c
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={200}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Ex: Part Number OEM 6205-2RSH/C3 SKF, diâmetro 25mm, aplicação esteira linha de secagem..."
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 shadow-2xs leading-relaxed"
              />
            </div>
          </div>

          {/* 3. FISCAL & TOTVS ATTRIBUTES */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Classificação Fiscal (NCM)
              </label>
              <input
                type="text"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Código UNSPSC
              </label>
              <input
                type="text"
                value={unspsc}
                onChange={(e) => setUnspsc(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Família TOTVS (Col B)
              </label>
              <input
                type="text"
                value={totvsFamily}
                onChange={(e) => setTotvsFamily(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Unidade de Medida (Col D)
              </label>
              <select
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
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

          {/* 4. FOTO / IMAGEM TÉCNICA */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="block font-semibold text-slate-700 text-[11px]">
              Imagem / Foto do Equipamento ou Peça
            </span>
            <div className="flex items-center gap-3">
              {genericImage ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 bg-white shrink-0">
                  <img src={genericImage} alt="Foto item" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setGenericImage(undefined)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-white shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
              )}

              <div className="space-y-1.5 flex-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Selecionar Foto</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                <p className="text-[10px] text-slate-500">
                  Fotos com a placa de identificação ou código gravado no corpo da peça facilitam a homologação.
                </p>
              </div>
            </div>
          </div>

          {/* 5. AUDIT TRAIL: JUSTIFICATIVA OBRIGATÓRIA */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-300 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-700" />
                <span>Justificativa da Alteração (Registro de Auditoria Obrigatório) *</span>
              </label>
              <span className="text-[10px] font-mono text-amber-800">
                Responsável: {currentTenant.name} ({currentUserRole})
              </span>
            </div>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Saneamento de item cadastrado direto no TOTVS. Atribuição dos 3 níveis MRO de acordo com o manual do fabricante e correção da descrição de 60c."
              className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 shadow-2xs leading-relaxed"
            />
          </div>

          {/* 6. REAL-TIME DETECTED CHANGES PREVIEW */}
          {detectedChanges.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-mono font-bold text-slate-700 block">
                Campos a serem alterados no Histórico ({detectedChanges.length}):
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
                {detectedChanges.map((c) => (
                  <div key={c.field} className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-sans font-semibold text-slate-700">{c.fieldLabel}:</span>
                    <div className="flex items-center gap-1.5 text-right truncate">
                      <span className="text-slate-400 line-through truncate max-w-xs">{c.oldValue}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                      <strong className="text-emerald-800 truncate max-w-xs">{c.newValue}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MASTER DIRECT APPROVAL TOGGLE */}
          {isMaster && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-950 block text-xs">
                  Aprovação Direta Master (Sem Fila)
                </span>
                <span className="text-[11px] text-emerald-800">
                  Grava imediatamente as alterações no catálogo global e registra o log com você como aprovador.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={directApproval}
                  onChange={(e) => setDirectApproval(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          )}

        </form>

        {/* FOOTER */}
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
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isMaster && directApproval
                ? 'Homologar & Atualizar em Todos os Ambientes'
                : 'Enviar Solicitação para a Fila de Governança'}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
