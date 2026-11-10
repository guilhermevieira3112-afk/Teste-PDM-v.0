import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, RotateCcw, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TenantStockItem, PDMItem, Tenant, MovementType, StockMovement } from '../../types/pdm';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: TenantStockItem | null;
  pdmItem: PDMItem | null;
  currentTenant: Tenant;
  onRegisterMovement: (movement: Omit<StockMovement, 'id'>) => void;
}

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  stockItem,
  pdmItem,
  currentTenant,
  onRegisterMovement,
}) => {
  if (!isOpen || !stockItem || !pdmItem) return null;

  const [type, setType] = useState<MovementType>('OUT');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(stockItem.unitCost);
  const [costCenter, setCostCenter] = useState<string>(currentTenant.costCenters[0] || 'CC-Manutenção');
  const [requisitioner, setRequisitioner] = useState<string>('');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const totalValue = quantity * unitCost;
  const isInsufficientStock = type === 'OUT' && quantity > stockItem.currentStock;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (quantity <= 0) {
      alert('A quantidade deve ser maior que zero.');
      return;
    }

    if (isInsufficientStock) {
      alert(`Saldo insuficiente no almoxarifado! Saldo disponível: ${stockItem.currentStock}`);
      return;
    }

    if (!requisitioner.trim()) {
      alert('Informe o requisitante ou responsável pela movimentação.');
      return;
    }

    onRegisterMovement({
      tenantId: currentTenant.id,
      pdmItemId: pdmItem.id,
      type,
      quantity,
      unitCost,
      totalValue,
      date: new Date().toISOString(),
      costCenter,
      requisitioner: requisitioner.trim(),
      documentNumber: documentNumber.trim() || (type === 'IN' ? 'NF-ENTRADA' : 'OS-PREMIERPET'),
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800">
        
        {/* HEADER (LIGHT THEME) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              type === 'OUT' 
                ? 'bg-amber-100 text-amber-800' 
                : type === 'IN' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-blue-100 text-blue-800'
            }`}>
              {type === 'OUT' && <ArrowUpRight className="w-5 h-5" />}
              {type === 'IN' && <ArrowDownRight className="w-5 h-5" />}
              {type === 'RETURN' && <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Registrar Movimentação de Almoxarifado
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
          
          {/* ITEM SUMMARY CARD */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-emerald-800 font-bold">{stockItem.internalCode}</span>
              <span className="font-mono text-[11px] text-slate-500">TOTVS: {pdmItem.totvsCode || pdmItem.pdmCode}</span>
            </div>
            <div className="text-slate-900 font-semibold font-mono text-[11px]">
              {pdmItem.shortDescription}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-slate-600">
              <span>Saldo Atual: <strong className="text-slate-900 font-mono">{stockItem.currentStock} {pdmItem.unitOfMeasure || 'UN'}</strong></span>
              <span>Custo Médio: <strong className="text-emerald-800 font-mono">R$ {stockItem.unitCost.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* MOVEMENT TYPE TOGGLE */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Tipo de Movimentação</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('OUT')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  type === 'OUT'
                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Saída (Consumo OS)
              </button>

              <button
                type="button"
                onClick={() => setType('IN')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  type === 'IN'
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Entrada (NF / Compra)
              </button>

              <button
                type="button"
                onClick={() => setType('RETURN')}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  type === 'RETURN'
                    ? 'bg-blue-100 border-blue-300 text-blue-900 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Devolução
              </button>
            </div>
          </div>

          {/* QUANTITY & UNIT COST */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Quantidade ({pdmItem.unitOfMeasure || 'UN'})
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Custo Unitário (R$)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-emerald-800 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-bold"
              />
            </div>
          </div>

          {/* TOTAL VALUE CALCULATION */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between font-mono">
            <span className="text-slate-500 text-[11px] font-sans">Impacto Financeiro na Baixa:</span>
            <span className="text-emerald-900 font-bold text-sm">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* INSUFFICIENT STOCK WARNING */}
          {isInsufficientStock && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>A quantidade solicitada ({quantity}) supera o saldo físico disponível ({stockItem.currentStock}).</span>
            </div>
          )}

          {/* COST CENTER */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Centro de Custo PremieRpet
            </label>
            <select
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium"
            >
              {currentTenant.costCenters.map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>
          </div>

          {/* REQUISITIONER & DOCUMENT */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Requisitante / Mecânico
              </label>
              <input
                type="text"
                placeholder="Ex: João Silva (Mecânica)"
                value={requisitioner}
                onChange={(e) => setRequisitioner(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Nº OS / Pedido TOTVS
              </label>
              <input
                type="text"
                placeholder="Ex: OS-2026-8812"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium"
              />
            </div>
          </div>

          {/* NOTES */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Motivo / Aplicação na Linha
            </label>
            <input
              type="text"
              placeholder="Ex: Troca preventiva de mancais na Linha de Secagem L6"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 font-medium"
            />
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
              disabled={isInsufficientStock}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all shadow-xs ${
                isInsufficientStock
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Baixa de Estoque</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
