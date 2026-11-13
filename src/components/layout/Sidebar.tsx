import React, { useState } from 'react';
import { 
  Layers, 
  CheckSquare, 
  Package, 
  BarChart3, 
  Plus, 
  LogOut,
  FileSpreadsheet,
  Users,
  FolderTree,
  ListTree
} from 'lucide-react';
import { UserRole } from '../../types/pdm';
import { UserAccount } from '../../types/auth';
import { PremierPetLogo } from './PremierPetLogo';

interface SidebarProps {
  currentTab: 'catalog' | 'pdm-classification' | 'governance' | 'inventory' | 'abc' | 'totvs-import' | 'user-control' | 'pdm-fields';
  setCurrentTab: (tab: 'catalog' | 'pdm-classification' | 'governance' | 'inventory' | 'abc' | 'totvs-import' | 'user-control' | 'pdm-fields') => void;
  currentUserRole: UserRole;
  pendingGovCount: number;
  lowStockCount: number;
  totalCatalogCount: number;
  pendingUsersCount?: number;
  onOpenPdmBuilder: () => void;
  currentUserAccount?: UserAccount | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUserRole,
  pendingGovCount,
  lowStockCount,
  totalCatalogCount,
  pendingUsersCount = 0,
  onOpenPdmBuilder,
  currentUserAccount,
  onLogout,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-40 flex flex-col transition-all duration-200 ease-out overflow-hidden ${
        isExpanded ? 'w-64 shadow-2xl' : 'w-[76px] shadow-sm'
      }`}
    >
      {/* 1. BRAND HEADER (UNIFIED HEIGHT WITH TOP BAR: h-20) */}
      <div
        className={`h-20 shrink-0 border-b border-slate-200 flex items-center ${
          isExpanded ? 'px-4 justify-start' : 'px-2 justify-center'
        }`}
      >
        {isExpanded ? (
          <PremierPetLogo size="md" showSubtitle={true} />
        ) : (
          <PremierPetLogo compact showSubtitle={false} />
        )}
      </div>

      {/* 2. PRIMARY NAVIGATION COLUMN (COLLAPSED TO ICONS, EXPANDS ON HOVER) */}
      <nav className={`flex-1 py-3 space-y-1.5 overflow-y-auto ${isExpanded ? 'px-3' : 'px-2.5'}`}>
        {/* Tab 1: PDM Master Catalog */}
        <button
          onClick={() => setCurrentTab('catalog')}
          title={!isExpanded ? 'Catálogo Mestre PDM' : undefined}
          className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
            isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
          } ${
            currentTab === 'catalog'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Layers className={`w-4 h-4 shrink-0 ${currentTab === 'catalog' ? 'text-white' : 'text-slate-500'}`} />
            {isExpanded && <span className="truncate">Catálogo Mestre PDM</span>}
          </div>
          {isExpanded && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                currentTab === 'catalog' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalCatalogCount}
            </span>
          )}
        </button>

        {/* Tab 1.5: Consulta por Classificação PDM (Todos os Usuários) */}
        <button
          onClick={() => setCurrentTab('pdm-classification')}
          title={!isExpanded ? 'Consulta por classificação PDM' : undefined}
          className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
            isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
          } ${
            currentTab === 'pdm-classification'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ListTree className={`w-4 h-4 shrink-0 ${currentTab === 'pdm-classification' ? 'text-white' : 'text-slate-500'}`} />
            {isExpanded && <span className="truncate">Consulta por classificação PDM</span>}
          </div>
          {isExpanded && (
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                currentTab === 'pdm-classification' ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              3 Níveis
            </span>
          )}
        </button>

        {/* Tab 2: Governance & Sanitation */}
        <button
          onClick={() => setCurrentTab('governance')}
          title={!isExpanded ? 'Fila de Governança' : undefined}
          className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
            isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
          } ${
            currentTab === 'governance'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckSquare className={`w-4 h-4 shrink-0 ${currentTab === 'governance' ? 'text-white' : 'text-slate-500'}`} />
            {isExpanded && <span className="truncate">Fila de Governança</span>}
          </div>
          {isExpanded && pendingGovCount > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shrink-0">
              {pendingGovCount}
            </span>
          )}
          {!isExpanded && pendingGovCount > 0 && (
            <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
          )}
        </button>

        {/* Tab 2.5: Carga & Auditoria TOTVS (Exclusivo Master Admin) */}
        {currentUserRole === 'MASTER_ADMIN' && (
          <button
            onClick={() => setCurrentTab('totvs-import')}
            title={!isExpanded ? 'Carga & Auditoria TOTVS' : undefined}
            className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
              isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
            } ${
              currentTab === 'totvs-import'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className={`w-4 h-4 shrink-0 ${currentTab === 'totvs-import' ? 'text-white' : 'text-slate-500'}`} />
              {isExpanded && <span className="truncate">Carga & Auditoria TOTVS</span>}
            </div>
            {isExpanded && (
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  currentTab === 'totvs-import' ? 'bg-emerald-700 text-emerald-100' : 'bg-blue-100 text-blue-800'
                }`}
              >
                CSV
              </span>
            )}
          </button>
        )}

        {/* Tab 2.6: Controle de Usuários (Exclusivo Master Admin) */}
        {currentUserRole === 'MASTER_ADMIN' && (
          <button
            onClick={() => setCurrentTab('user-control')}
            title={!isExpanded ? 'Controle de usuários' : undefined}
            className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
              isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
            } ${
              currentTab === 'user-control'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className={`w-4 h-4 shrink-0 ${currentTab === 'user-control' ? 'text-white' : 'text-slate-500'}`} />
              {isExpanded && <span className="truncate">Controle de usuários</span>}
            </div>
            {isExpanded && (
              pendingUsersCount > 0 ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse shrink-0">
                  {pendingUsersCount}
                </span>
              ) : (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    currentTab === 'user-control' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Admin
                </span>
              )
            )}
            {!isExpanded && pendingUsersCount > 0 && (
              <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
            )}
          </button>
        )}

        {/* Tab 2.7: Edição de campos PDM (Exclusivo Master Admin) */}
        {currentUserRole === 'MASTER_ADMIN' && (
          <button
            onClick={() => setCurrentTab('pdm-fields')}
            title={!isExpanded ? 'Edição de campos PDM' : undefined}
            className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
              isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
            } ${
              currentTab === 'pdm-fields'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderTree className={`w-4 h-4 shrink-0 ${currentTab === 'pdm-fields' ? 'text-white' : 'text-slate-500'}`} />
              {isExpanded && <span className="truncate">Edição de campos PDM</span>}
            </div>
            {isExpanded && (
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  currentTab === 'pdm-fields' ? 'bg-emerald-700 text-emerald-100' : 'bg-amber-100 text-amber-800'
                }`}
              >
                3 Níveis
              </span>
            )}
          </button>
        )}

        {/* Tab 3: Local Inventory */}
        <button
          onClick={() => setCurrentTab('inventory')}
          title={!isExpanded ? 'Almoxarifado Local' : undefined}
          className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
            isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
          } ${
            currentTab === 'inventory'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Package className={`w-4 h-4 shrink-0 ${currentTab === 'inventory' ? 'text-white' : 'text-slate-500'}`} />
            {isExpanded && <span className="truncate">Almoxarifado Local</span>}
          </div>
          {isExpanded && lowStockCount > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white shrink-0">
              {lowStockCount}
            </span>
          )}
          {!isExpanded && lowStockCount > 0 && (
            <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>

        {/* Tab 4: Industrial ABC Curve */}
        <button
          onClick={() => setCurrentTab('abc')}
          title={!isExpanded ? 'Curva ABC Industrial' : undefined}
          className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all ${
            isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center px-0 py-2.5'
          } ${
            currentTab === 'abc'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <BarChart3 className={`w-4 h-4 shrink-0 ${currentTab === 'abc' ? 'text-white' : 'text-slate-500'}`} />
            {isExpanded && <span className="truncate">Curva ABC Industrial</span>}
          </div>
          {isExpanded && (
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                currentTab === 'abc' ? 'bg-emerald-700 text-emerald-100' : 'bg-amber-100 text-amber-800'
              }`}
            >
              Pareto
            </span>
          )}
        </button>

        {/* QUICK ACTION BUTTON */}
        <div className="pt-3">
          <button
            onClick={onOpenPdmBuilder}
            title={!isExpanded ? 'Novo Cadastro PDM' : undefined}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-[0.98] ${
              isExpanded ? 'px-3' : 'px-0'
            }`}
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            {isExpanded && <span className="whitespace-nowrap">Novo Cadastro PDM</span>}
          </button>
        </div>
      </nav>

      {/* 3. USER PROFILE & LOGOUT SECTION */}
      {currentUserAccount && (
        <div className={`border-t border-slate-200 bg-slate-50/80 ${isExpanded ? 'p-3' : 'p-2.5'}`}>
          <div
            className={`flex items-center rounded-xl bg-white border border-slate-200 shadow-2xs ${
              isExpanded ? 'justify-between gap-2 p-2' : 'flex-col gap-1.5 p-1.5 justify-center'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                title={!isExpanded ? currentUserAccount.name : undefined}
                className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0"
              >
                {currentUserAccount.name ? currentUserAccount.name.charAt(0).toUpperCase() : 'U'}
              </div>
              {isExpanded && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate leading-tight">
                    {currentUserAccount.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    @{currentUserAccount.username}
                  </div>
                </div>
              )}
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
    </aside>
  );
};
