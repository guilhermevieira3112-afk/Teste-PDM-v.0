import React, { useState } from 'react';
import { 
  Layers, 
  CheckSquare, 
  Package, 
  BarChart3, 
  Building2, 
  ShieldCheck, 
  Plus, 
  ChevronDown,
  Database,
  Search,
  Server,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  User as UserIcon,
  FileSpreadsheet
} from 'lucide-react';
import { UserRole, Tenant } from '../../types/pdm';
import { UserAccount } from '../../types/auth';
import { PremierPetLogo } from './PremierPetLogo';

interface SidebarProps {
  currentTab: 'catalog' | 'governance' | 'inventory' | 'abc' | 'totvs-import';
  setCurrentTab: (tab: 'catalog' | 'governance' | 'inventory' | 'abc' | 'totvs-import') => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  currentTenantId: string;
  setCurrentTenantId: (tenantId: string) => void;
  tenants: Tenant[];
  pendingGovCount: number;
  lowStockCount: number;
  totalCatalogCount: number;
  onOpenPdmBuilder: () => void;
  currentUserAccount?: UserAccount | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUserRole,
  setCurrentUserRole,
  currentTenantId,
  setCurrentTenantId,
  tenants,
  pendingGovCount,
  lowStockCount,
  totalCatalogCount,
  onOpenPdmBuilder,
  currentUserAccount,
  onLogout,
}) => {
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const activeTenant = tenants.find((t) => t.id === currentTenantId) || tenants[0];

  const handleSelectMaster = () => {
    setCurrentUserRole('MASTER_ADMIN');
    setTenantDropdownOpen(false);
  };

  const handleSelectTenant = (tenantId: string) => {
    setCurrentUserRole('UNIT_MANAGER');
    setCurrentTenantId(tenantId);
    setTenantDropdownOpen(false);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-40 flex flex-col shadow-sm">
      
      {/* 1. BRAND HEADER */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <PremierPetLogo />
      </div>

      {/* 2. TENANT / ROLE SELECTOR CARD */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70">
        <div className="relative">
          <button
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 shadow-xs transition-all text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                currentUserRole === 'MASTER_ADMIN'
                  ? 'bg-amber-500 ring-4 ring-amber-100'
                  : 'bg-emerald-600 ring-4 ring-emerald-100'
              }`} />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-mono font-semibold text-slate-400">
                  {currentUserRole === 'MASTER_ADMIN' ? 'Governança Global' : 'Unidade PremieRpet'}
                </div>
                <div className="text-xs font-bold text-slate-800 truncate">
                  {currentUserRole === 'MASTER_ADMIN' ? (
                    <span className="text-amber-700">Master Admin (Central)</span>
                  ) : (
                    <span className="text-emerald-800">{activeTenant.name}</span>
                  )}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${tenantDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* DROPDOWN MENU */}
          {tenantDropdownOpen && (
            <div 
              className="absolute left-0 right-0 mt-1.5 rounded-xl bg-white border border-slate-200 shadow-xl p-2 z-50 text-xs"
              onMouseLeave={() => setTenantDropdownOpen(false)}
            >
              <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100 mb-1">
                Alternar Escopo de Acesso
              </div>

              {/* Master Admin */}
              <button
                onClick={handleSelectMaster}
                className={`w-full flex items-start gap-2.5 p-2 rounded-lg transition-colors text-left ${
                  currentUserRole === 'MASTER_ADMIN'
                    ? 'bg-amber-50 border border-amber-200 text-amber-900 font-semibold'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-xs">Master Admin (Corporativo)</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Aprova itens PDM, saneia dados e configura regras globais.
                  </div>
                </div>
              </button>

              <div className="my-1.5 border-t border-slate-100" />
              <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Unidades Operacionais
              </div>

              {/* Plants */}
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTenant(t.id)}
                  className={`w-full flex items-start gap-2.5 p-2 rounded-lg transition-colors text-left mt-1 ${
                    currentUserRole === 'UNIT_MANAGER' && currentTenantId === t.id
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>{t.name}</span>
                      <span className="text-[10px] font-mono px-1 rounded bg-slate-100 text-slate-600 font-normal">
                        {t.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 leading-tight">
                      {t.city}/{t.state} (Estoque & Custos Locais)
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. PRIMARY NAVIGATION COLUMN */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          Navegação Principal
        </div>

        {/* Tab 1: PDM Master Catalog */}
        <button
          onClick={() => setCurrentTab('catalog')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'catalog'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Layers className={`w-4 h-4 ${currentTab === 'catalog' ? 'text-white' : 'text-slate-500'}`} />
            <span>Catálogo Mestre PDM</span>
          </div>
          <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
            currentTab === 'catalog' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {totalCatalogCount}
          </span>
        </button>

        {/* Tab 2: Governance & Sanitation */}
        <button
          onClick={() => setCurrentTab('governance')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'governance'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckSquare className={`w-4 h-4 ${currentTab === 'governance' ? 'text-white' : 'text-slate-500'}`} />
            <span>Fila de Governança</span>
          </div>
          {pendingGovCount > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
              {pendingGovCount}
            </span>
          )}
        </button>

        {/* Tab 2.5: Carga & Auditoria TOTVS (Exclusivo Master Admin) */}
        {currentUserRole === 'MASTER_ADMIN' && (
          <button
            onClick={() => setCurrentTab('totvs-import')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'totvs-import'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className={`w-4 h-4 ${currentTab === 'totvs-import' ? 'text-white' : 'text-slate-500'}`} />
              <span>Carga & Auditoria TOTVS</span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              currentTab === 'totvs-import' ? 'bg-emerald-700 text-emerald-100' : 'bg-blue-100 text-blue-800'
            }`}>
              CSV
            </span>
          </button>
        )}

        {/* Tab 3: Local Inventory */}
        <button
          onClick={() => setCurrentTab('inventory')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'inventory'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Package className={`w-4 h-4 ${currentTab === 'inventory' ? 'text-white' : 'text-slate-500'}`} />
            <span>Almoxarifado Local</span>
          </div>
          {lowStockCount > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
              {lowStockCount}
            </span>
          )}
        </button>

        {/* Tab 4: Industrial ABC Curve */}
        <button
          onClick={() => setCurrentTab('abc')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            currentTab === 'abc'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className={`w-4 h-4 ${currentTab === 'abc' ? 'text-white' : 'text-slate-500'}`} />
            <span>Curva ABC Industrial</span>
          </div>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            currentTab === 'abc' ? 'bg-emerald-700 text-emerald-100' : 'bg-amber-100 text-amber-800'
          }`}>
            Pareto
          </span>
        </button>

        {/* QUICK ACTION BUTTON */}
        <div className="pt-4 px-1">
          <button
            onClick={onOpenPdmBuilder}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Cadastro PDM</span>
          </button>
        </div>
      </nav>

      {/* 4. USER PROFILE & LOGOUT SECTION */}
      {currentUserAccount && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/80">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUserAccount.name ? currentUserAccount.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {currentUserAccount.name}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  @{currentUserAccount.username}
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Sair do Sistema (Logout)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. SIDEBAR FOOTER (INTEGRAÇÃO TOTVS) */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
            <Server className="w-3.5 h-3.5 text-emerald-600" /> ERP TOTVS Protheus
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Online
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          Tabelas SB1 / MARA · 10.824 Itens Mapeados
        </div>
      </div>

    </aside>
  );
};
