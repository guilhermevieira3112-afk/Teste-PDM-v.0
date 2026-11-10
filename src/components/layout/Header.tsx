import React from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  Search, 
  Bell, 
  RefreshCw,
  Database
} from 'lucide-react';
import { UserRole, Tenant } from '../../types/pdm';

interface HeaderProps {
  currentTab: 'catalog' | 'governance' | 'inventory' | 'abc' | 'totvs-import';
  currentUserRole: UserRole;
  currentTenant: Tenant;
  onOpenPdmBuilder: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUserRole,
  currentTenant,
  onOpenPdmBuilder,
  searchTerm = '',
  onSearchChange,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'catalog':
        return 'Catálogo Mestre PDM (Base Centralizada PremieRpet)';
      case 'governance':
        return 'Fila de Governança & Saneamento de Materiais';
      case 'totvs-import':
        return 'Carga & Auditoria TOTVS (Base Protheus SB1)';
      case 'inventory':
        return `Almoxarifado Industrial · ${currentTenant.name}`;
      case 'abc':
        return `Curva ABC & Consumo Financeiro · ${currentTenant.name}`;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
        
        {/* BREADCRUMB & TITLE */}
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>PremieRpet</span>
            <span>/</span>
            <span className="text-emerald-700 font-semibold">{currentTenant.name}</span>
            <span>/</span>
            <span className="text-slate-700 font-medium capitalize">{currentTab}</span>
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
            {getTabTitle()}
          </h1>
        </div>

        {/* ACTIVE SCOPE STATUS BADGE & ACTION */}
        <div className="flex items-center gap-3 shrink-0">
          
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            {currentUserRole === 'MASTER_ADMIN' ? (
              <span className="flex items-center gap-1.5 text-amber-800 font-semibold">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Perfil: Master Admin</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Planta: {currentTenant.code} · {currentTenant.city}/{currentTenant.state}</span>
              </span>
            )}
          </div>

          <button
            onClick={onOpenPdmBuilder}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Novo PDM</span>
          </button>
        </div>

      </div>
    </header>
  );
};
