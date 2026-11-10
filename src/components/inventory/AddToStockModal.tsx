import React, { useState } from 'react';
import { X, Plus, Building2, Package, CheckCircle2 } from 'lucide-react';
import { PDMItem, Tenant, TenantStockItem, CriticismLevel } from '../../types/pdm';

interface AddToStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdmItem: PDMItem | null;
  currentTenant: Tenant;
  onConfirmAdd: (stockData: Omit<TenantStockItem, 'id'>) => void;
}

export const AddToStockModal: React.FC<AddToStockModalProps> = ({
  isOpen,
  onClose,
  pdmItem,
  currentTenant,
  onConfirmAdd,
}) => {
  if (!isOpen || !pdmItem) return null;

  const defaultCode = `${currentTenant.code === 'DOU-01' ? 'DOU' : 'PAM'}-${pdmItem.totvsCode || Math.floor(1000 + Math.random() * 9000)}`;

  const [internalCode, setInternalCode] = useState(defaultCode);
  const [initialStock, setInitialStock] = useState<number>(10);
  const [minimumStock, setMinimumStock] = useState<number>(4);
  const [safetyStock, setSafetyStock] = useState<number>(2);
  const [maxStock, setMaxStock] = useState<number>(25);
  const [unitCost, setUnitCost] = useState<number>(pdmItem.baseValue || 140.00);
  const [storageLocation, setStorageLocation] = useState('Almoxarifado Central / Rua B / Prateleira 04');
  const [criticism, setCriticism] = useState<CriticismLevel>('E');
  const [leadTimeDays, setLeadTimeDays] = useState<number>(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!internalCode.trim()) {
      alert('Informe o código interno da unidade.');
      return;
    }

    onConfirmAdd({
      tenantId: currentTenant.id,
      pdmItemId: pdmItem.id,
      internalCode: internalCode.trim().toUpperCase(),
      currentStock: initialStock,
      minimumStock,
      safetyStock,
      maxStock,
      unitCost,
      storageLocation: storageLocation.trim(),
      criticism,
      leadTimeDays,
      lastInventoryDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Vincular ao Almoxarifado PremieRpet
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>{currentTenant.name} ({currentTenant.code})</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* PDM DETAILS */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-mono text-emerald-800 font-bold">
              TOTVS: {pdmItem.totvsCode || pdmItem.pdmCode}
            </div>
            <div className="text-slate-900 font-mono font-semibold">{pdmItem.shortDescription}</div>
            <div className="text-[11px] text-slate-500">{pdmItem.originalDescription || pdmItem.longDescription}</div>
          </div>

          {/* INTERNAL CODE & LOCATION */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Código Interno da Unidade
              </label>
              <input
                type="text"
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono uppercase focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Localização Física (Rua / Prateleira / Box)
              </label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium"
              />
            </div>
          </div>

          {/* BALANCES */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Saldo Físico (un)
              </label>
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Estoque Mínimo
              </label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Estoque Segurança
              </label>
              <input
                type="number"
                min="0"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 font-bold"
              />
            </div>
          </div>

          {/* UNIT COST & CRITICISM */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Custo de Reposição Unitário (R$)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-emerald-800 font-mono font-bold text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Criticidade Operacional (VED)
              </label>
              <select
                value={criticism}
                onChange={(e) => setCriticism(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 font-medium"
              >
                <option value="V">Classe V - Vital (Parada Imediata)</option>
                <option value="E">Classe E - Essencial (Operação Limitada)</option>
                <option value="D">Classe D - Desejável (Não Impeditivo)</option>
              </select>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar no Estoque Local</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
