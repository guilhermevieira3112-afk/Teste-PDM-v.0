import React from 'react';
import { 
  Database, 
  Layers, 
  CheckSquare, 
  Package, 
  BarChart3, 
  Building2, 
  ShieldCheck, 
  Plus, 
  ChevronDown
} from 'lucide-react';
import { UserRole, Tenant, PDMStatus } from '../../types/pdm';

interface NavbarProps {
  currentTab: 'catalog' | 'governance' | 'inventory' | 'abc';
  setCurrentTab: (tab: 'catalog' | 'governance' | 'inventory' | 'abc') => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  currentTenantId: string;
  setCurrentTenantId: (tenantId: string) => void;
  tenants: Tenant[];
  pendingGovCount: number;
  lowStockCount: number;
  onOpenPdmBuilder: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  currentUserRole,
  setCurrentUserRole,
  currentTenantId,
  setCurrentTenantId,
  tenants,
  pendingGovCount,
  lowStockCount,
  onOpenPdmBuilder,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const activeTenant = tenants.find((t) => t.id === currentTenantId) || tenants[0];

  const handleSelectMaster = () => {
    setCurrentUserRole('MASTER_ADMIN');
    setProfileDropdownOpen(false);
  };

  const handleSelectTenant = (tenantId: string) => {
    setCurrentUserRole('UNIT_MANAGER');
    setCurrentTenantId(tenantId);
    setProfileDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0d131f] border-b border-slate-800/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          
          {/* ZONE 1: BRAND WORDMARK */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white whitespace-nowrap">
                  PDM CORE
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                  v3.2 INDUSTRIAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5 hidden sm:block">
                Governança & Almoxarifado Centralizado
              </p>
            </div>
          </div>

          {/* ZONE 2: PRIMARY NAVIGATION TABS */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 no-scrollbar">
            <button
              onClick={() => setCurrentTab('catalog')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                currentTab === 'catalog'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Catálogo PDM</span>
            </button>

            <button
              onClick={() => setCurrentTab('governance')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                currentTab === 'governance'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Governança & Saneamento</span>
              {pendingGovCount > 0 && (
                <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950">
                  {pendingGovCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('inventory')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                currentTab === 'inventory'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Almoxarifado Local</span>
              {lowStockCount > 0 && (
                <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-500/90 text-white">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('abc')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                currentTab === 'abc'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Curva ABC Industrial</span>
            </button>
          </nav>

          {/* ZONE 3: ROLE/TENANT SWITCHER & PRIMARY CTA */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Context Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-slate-600 transition-all text-left"
              >
                <div className={`w-2 h-2 rounded-full ${currentUserRole === 'MASTER_ADMIN' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-emerald-400'}`} />
                <div className="text-xs">
                  <div className="text-slate-400 text-[10px] leading-tight">
                    {currentUserRole === 'MASTER_ADMIN' ? 'Perfil Corporativo' : 'Unidade Ativa'}
                  </div>
                  <div className="font-semibold text-slate-100 flex items-center gap-1">
                    {currentUserRole === 'MASTER_ADMIN' ? (
                      <span className="flex items-center gap-1 text-amber-300">
                        <ShieldCheck className="w-3 h-3 text-amber-400" /> Master Admin (Global)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-200">
                        <Building2 className="w-3 h-3 text-emerald-400" /> {activeTenant.code} · {activeTenant.city}/{activeTenant.state}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {profileDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-72 rounded-lg bg-[#111827] border border-slate-700 shadow-2xl p-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-2 py-1 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                    Alternar Papel e Escopo de Dados
                  </div>

                  {/* Master Admin Option */}
                  <button
                    onClick={handleSelectMaster}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-md transition-colors text-left ${
                      currentUserRole === 'MASTER_ADMIN'
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                        : 'hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">Master Admin (Governança Central)</div>
                      <div className="text-[11px] text-slate-400 leading-tight">
                        Aprova novos itens PDM, gerencia taxonomia e vê todas as esteiras de saneamento.
                      </div>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-slate-800" />
                  <div className="px-2 py-1 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Unidades / Tenants Locais
                  </div>

                  {/* Tenant Options */}
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSelectTenant(tenant.id)}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-md transition-colors text-left mt-1 ${
                        currentUserRole === 'UNIT_MANAGER' && currentTenantId === tenant.id
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                          : 'hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold flex items-center gap-1.5">
                          <span>{tenant.name}</span>
                          <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                            {tenant.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight">
                          {tenant.unitType} · {tenant.city}/{tenant.state} (Estoque & Custos Privados)
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Button */}
            <button
              onClick={onOpenPdmBuilder}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-md transition-colors whitespace-nowrap shrink-0"
              title="Criar ou solicitar novo item padronizado PDM"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Novo Item PDM</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
