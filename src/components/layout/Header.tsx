import React from 'react';
import { Tenant } from '../../types/pdm';

interface HeaderProps {
  currentTab: 'catalog' | 'pdm-classification' | 'governance' | 'inventory' | 'abc' | 'totvs-import' | 'user-control' | 'pdm-fields';
  currentTenant: Tenant;
  userUnitName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentTenant,
  userUnitName,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'catalog':
        return 'Catálogo Mestre PDM (Base Centralizada PremieRpet)';
      case 'pdm-classification':
        return 'Consulta por Classificação PDM (Estrutura de 3 Níveis MRO)';
      case 'governance':
        return 'Fila de Governança & Saneamento de Materiais';
      case 'totvs-import':
        return 'Carga & Auditoria TOTVS (Base Protheus SB1)';
      case 'user-control':
        return 'Controle de Usuários & Gestão de Acessos';
      case 'pdm-fields':
        return 'Edição de Campos e Níveis PDM';
      case 'inventory':
        return `Almoxarifado Industrial · ${currentTenant.name}`;
      case 'abc':
        return `Curva ABC & Consumo Financeiro · ${currentTenant.name}`;
    }
  };

  const displayUnit = userUnitName || currentTenant.name;

  return (
    <header className="sticky top-0 z-30 h-20 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center">
      <div className="px-6 w-full flex items-center justify-between gap-4">
        {/* BREADCRUMB (ONLY PremieRpet / Unidade) & PAGE TITLE */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>PremieRpet</span>
            <span>/</span>
            <span className="text-emerald-700 font-semibold">{displayUnit}</span>
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight mt-0.5 truncate">
            {getTabTitle()}
          </h1>
        </div>
      </div>
    </header>
  );
};
