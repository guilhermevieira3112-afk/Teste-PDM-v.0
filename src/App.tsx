import React, { useState, useMemo, useEffect } from 'react';
import { 
  Database, 
  Layers, 
  CheckSquare, 
  Package, 
  BarChart3, 
  Building2, 
  ShieldCheck, 
  Plus, 
  Sparkles,
  Server
} from 'lucide-react';
import { UserRole, Tenant, PDMItem, TenantStockItem, StockMovement } from './types/pdm';
import { TENANTS } from './data/taxonomy';
import { INITIAL_PDM_ITEMS, INITIAL_TENANT_STOCKS, INITIAL_MOVEMENTS } from './data/mockData';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CatalogView } from './components/pdm/CatalogView';
import { GovernanceView } from './components/governance/GovernanceView';
import { InventoryView } from './components/inventory/InventoryView';
import { ABCCurveDashboard } from './components/analytics/ABCCurveDashboard';
import { PDMBuilderModal } from './components/pdm/PDMBuilderModal';
import { AddToStockModal } from './components/inventory/AddToStockModal';
import { ItemDetailModal } from './components/common/ItemDetailModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { TotvsImportView } from './components/totvs/TotvsImportView';
import { UserAccount } from './types/auth';

export default function App() {
  // Authentication State
  const [currentUserAccount, setCurrentUserAccount] = useState<UserAccount | null>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Navigation & User Context
  const [currentTab, setCurrentTab] = useState<'catalog' | 'governance' | 'inventory' | 'abc' | 'totvs-import'>('inventory');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      if (stored) {
        const parsed: UserAccount = JSON.parse(stored);
        return parsed.role;
      }
    } catch {
      // fallback
    }
    return 'UNIT_MANAGER';
  });
  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('premierpet_logged_user');
      if (stored) {
        const parsed: UserAccount = JSON.parse(stored);
        return parsed.tenantId || 'dourado-sp';
      }
    } catch {
      // fallback
    }
    return 'dourado-sp';
  });

  // Application Data State (Real PremieRpet TOTVS Data)
  const [pdmItems, setPdmItems] = useState<PDMItem[]>(() => {
    return INITIAL_PDM_ITEMS.map((item) => ({
      ...item,
      narrative: item.narrative || item.originalDescription || item.shortDescription,
    }));
  });
  const [tenantStocks, setTenantStocks] = useState<TenantStockItem[]>(INITIAL_TENANT_STOCKS);
  const [movements, setMovements] = useState<StockMovement[]>(INITIAL_MOVEMENTS);

  // Modals
  const [isPdmBuilderOpen, setIsPdmBuilderOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<PDMItem | null>(null);
  const [addToStockPdmItem, setAddToStockPdmItem] = useState<PDMItem | null>(null);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const activeTenant = useMemo(() => {
    return TENANTS.find((t) => t.id === currentTenantId) || TENANTS[0];
  }, [currentTenantId]);

  // Guard: Restrict Carga & Auditoria TOTVS strictly to MASTER_ADMIN
  useEffect(() => {
    if (currentUserRole !== 'MASTER_ADMIN' && currentTab === 'totvs-import') {
      setCurrentTab('inventory');
    }
  }, [currentUserRole, currentTab]);

  // Counts for Badges
  const pendingGovCount = useMemo(() => {
    return pdmItems.filter((i) => i.status === 'PENDING_REVIEW' || i.status === 'FLAGGED_DUPLICATE').length;
  }, [pdmItems]);

  const lowStockCount = useMemo(() => {
    return tenantStocks.filter(
      (s) => s.tenantId === currentTenantId && s.currentStock <= s.minimumStock
    ).length;
  }, [tenantStocks, currentTenantId]);

  const totalCatalogCount = useMemo(() => {
    return pdmItems.filter((i) => i.status === 'APPROVED').length;
  }, [pdmItems]);

  // Background loader for complete 13,130 TOTVS items from CE0348 & Itens.csv
  useEffect(() => {
    let isMounted = true;
    async function loadFullCatalog() {
      try {
        const [resCat, resStk] = await Promise.all([
          fetch('/data/totvsMergedCatalog.json'),
          fetch('/data/totvsMergedStocks.json')
        ]);
        if (resCat.ok && resStk.ok) {
          const fullCatalog: PDMItem[] = await resCat.json();
          const fullStocks: TenantStockItem[] = await resStk.json();
          if (isMounted && fullCatalog.length > 0) {
            setPdmItems((prev) => {
              const userItems = prev.filter((i) => i.id.startsWith('pdm-req-') || i.id.startsWith('pdm-gov-'));
              const map = new Map(fullCatalog.map((i) => [i.id, i]));
              userItems.forEach((i) => map.set(i.id, i));
              return Array.from(map.values());
            });
            setTenantStocks((prev) => {
              if (fullStocks.length > prev.length) {
                return fullStocks;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('Background full TOTVS data load active:', err);
      }
    }
    loadFullCatalog();
    return () => { isMounted = false; };
  }, []);

  // --- WORKFLOW HANDLERS ---

  // 1. Save new PDM item from Builder
  const handleSavePdmItem = (itemData: Partial<PDMItem>) => {
    const nextSeq = pdmItems.length + 1;
    const isApproved = itemData.status === 'APPROVED';
    const code = isApproved 
      ? `5040-${String(nextSeq + 2500).padStart(4, '0')}`
      : `PDM-REQ-2026-${String(nextSeq + 10).padStart(3, '0')}`;

    const newItem: PDMItem = {
      id: `pdm-${Date.now()}`,
      pdmCode: code,
      totvsCode: code,
      totvsFamily: itemData.totvsFamily || '5040',
      unitOfMeasure: itemData.unitOfMeasure || 'UN',
      totvsPlant: itemData.totvsPlant || (currentTenantId === 'dourado-sp' ? 'Dourado' : 'Paraná'),
      situation: 'Ativo',
      originalDescription: itemData.shortDescription || 'ITEM SOLICITADO VIA PDM BUILDER',
      baseValue: 120.00,
      groupId: itemData.groupId || 'grp-mecanica',
      subgroupId: itemData.subgroupId || 'sub-rolamentos',
      specificSubgroupId: itemData.specificSubgroupId || 'spec-rol-esfera',
      shortDescription: itemData.shortDescription || 'ITEM PADRONIZADO',
      longDescription: itemData.longDescription || 'DESCRIÇÃO TÉCNICA DETALHADA PREMIERPET.',
      narrative: itemData.narrative || itemData.longDescription || itemData.shortDescription,
      attributes: itemData.attributes || {},
      ncm: itemData.ncm || '8482.10.10',
      unspsc: itemData.unspsc || '31171504',
      genericImage: itemData.genericImage,
      status: itemData.status || 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
      requestedByTenantId: itemData.requestedByTenantId,
      requestedByTenantName: itemData.requestedByTenantName,
      requestedByUser: itemData.requestedByUser,
      notes: itemData.notes,
      duplicateOfId: itemData.duplicateOfId,
      similarityScore: itemData.similarityScore,
      leadTimeDays: itemData.leadTimeDays,
      orderPoint: itemData.orderPoint,
      safetyStockWarehouse: itemData.safetyStockWarehouse,
      establishments: itemData.establishments,
    };

    setPdmItems((prev) => [newItem, ...prev]);

    // If approved and has establishment stock defined, add to local tenantStocks
    if (isApproved && itemData.establishments) {
      const estab10 = itemData.establishments['10'];
      const estab14 = itemData.establishments['14'];

      if (estab10) {
        setTenantStocks((prev) => [
          {
            id: `stk-dou-${Date.now()}`,
            tenantId: 'dourado-sp',
            pdmItemId: newItem.id,
            internalCode: `DOU-${newItem.totvsCode}`,
            currentStock: estab10.saldoEstoque || 0,
            minimumStock: estab10.pontoEncomenda || 1,
            safetyStock: estab10.estoqueSegurancaAlmoxarifado || 1,
            safetyStockWarehouse: estab10.estoqueSegurancaAlmoxarifado || 1,
            orderPoint: estab10.pontoEncomenda || 1,
            maxStock: Math.max(10, (estab10.pontoEncomenda || 1) * 3),
            unitCost: newItem.baseValue || 45.00,
            storageLocation: 'Almox Central Dourado / Setor A',
            criticism: 'E',
            leadTimeDays: estab10.tempoRessuprimento || 15,
            lastInventoryDate: '2026-11-10',
            status: 'ACTIVE',
          },
          ...prev,
        ]);
      }

      if (estab14) {
        setTenantStocks((prev) => [
          {
            id: `stk-pam-${Date.now() + 1}`,
            tenantId: 'porto-amazonas-pr',
            pdmItemId: newItem.id,
            internalCode: `PAM-${newItem.totvsCode}`,
            currentStock: estab14.saldoEstoque || 0,
            minimumStock: estab14.pontoEncomenda || 1,
            safetyStock: estab14.estoqueSegurancaAlmoxarifado || 1,
            safetyStockWarehouse: estab14.estoqueSegurancaAlmoxarifado || 1,
            orderPoint: estab14.pontoEncomenda || 1,
            maxStock: Math.max(10, (estab14.pontoEncomenda || 1) * 3),
            unitCost: newItem.baseValue || 45.00,
            storageLocation: 'Almox Industrial Paraná / Bloco P',
            criticism: 'E',
            leadTimeDays: estab14.tempoRessuprimento || 15,
            lastInventoryDate: '2026-11-10',
            status: 'ACTIVE',
          },
          ...prev,
        ]);
      }
    }

    if (isApproved) {
      showToast(`Item ${newItem.totvsCode} homologado e inserido no Catálogo TOTVS!`);
      setCurrentTab('catalog');
    } else {
      showToast(`Solicitação ${newItem.pdmCode} enviada para a Fila de Governança Master!`);
      setCurrentTab('governance');
    }
  };

  // 2. Approve PDM Item in Governance
  const handleApproveGovernanceItem = (itemId: string) => {
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const isRequestCode = item.pdmCode.startsWith('PDM-REQ');
          const officialTotvsCode = isRequestCode
            ? `5040-${Math.floor(7500 + Math.random() * 500)}`
            : item.totvsCode || item.pdmCode;

          return {
            ...item,
            totvsCode: officialTotvsCode,
            pdmCode: `PDM-${officialTotvsCode}`,
            status: 'APPROVED',
          };
        }
        return item;
      })
    );
    showToast('Item aprovado com sucesso e integrado ao Catálogo Mestre TOTVS!');
  };

  // 3. Reject PDM Item in Governance
  const handleRejectGovernanceItem = (itemId: string, reason: string) => {
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            status: 'REJECTED',
            rejectionReason: reason,
          };
        }
        return item;
      })
    );
    showToast('Solicitação rejeitada com justificativa técnica registrada.');
  };

  // 4. Link duplicate to existing master code
  const handleLinkDuplicate = (requestedId: string, masterId: string) => {
    const master = pdmItems.find((i) => i.id === masterId);
    setPdmItems((prev) =>
      prev.map((item) => {
        if (item.id === requestedId) {
          return {
            ...item,
            status: 'REJECTED',
            rejectionReason: `Duplicidade sanada. Vinculado oficialmente ao código TOTVS ${master?.totvsCode || master?.pdmCode || masterId}.`,
          };
        }
        return item;
      })
    );
    showToast(`Solicitação unificada com sucesso sob o código TOTVS ${master?.totvsCode || master?.pdmCode}!`);
  };

  // 5. Register stock movement (IN, OUT, RETURN)
  const handleRegisterMovement = (movementData: Omit<StockMovement, 'id'>) => {
    const newMovement: StockMovement = {
      ...movementData,
      id: `mov-${Date.now()}`,
    };

    setMovements((prev) => [newMovement, ...prev]);

    setTenantStocks((prev) =>
      prev.map((stock) => {
        if (stock.tenantId === movementData.tenantId && stock.pdmItemId === movementData.pdmItemId) {
          let updatedStock = stock.currentStock;
          let updatedUnitCost = stock.unitCost;

          if (movementData.type === 'OUT') {
            updatedStock = Math.max(0, stock.currentStock - movementData.quantity);
          } else if (movementData.type === 'IN') {
            const oldTotalVal = stock.currentStock * stock.unitCost;
            const newTotalVal = oldTotalVal + movementData.quantity * movementData.unitCost;
            updatedStock = stock.currentStock + movementData.quantity;
            updatedUnitCost = updatedStock > 0 ? newTotalVal / updatedStock : movementData.unitCost;
          } else if (movementData.type === 'RETURN') {
            updatedStock = stock.currentStock + movementData.quantity;
          }

          return {
            ...stock,
            currentStock: updatedStock,
            unitCost: updatedUnitCost,
          };
        }
        return stock;
      })
    );

    showToast(`Movimentação de ${movementData.type === 'OUT' ? 'Saída' : movementData.type === 'IN' ? 'Entrada' : 'Devolução'} registrada com sucesso!`);
  };

  // 6. Add catalog item to local tenant warehouse
  const handleConfirmAddToStock = (stockData: Omit<TenantStockItem, 'id'>) => {
    const newStockItem: TenantStockItem = {
      ...stockData,
      id: `stk-${Date.now()}`,
    };

    setTenantStocks((prev) => [...prev, newStockItem]);
    showToast(`Item ${newStockItem.internalCode} incorporado ao almoxarifado de ${activeTenant.name}!`);
    setCurrentTab('inventory');
  };

  // Auth Handlers
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUserAccount(user);
    setCurrentUserRole(user.role);
    if (user.tenantId) {
      setCurrentTenantId(user.tenantId);
    }
    try {
      localStorage.setItem('premierpet_logged_user', JSON.stringify(user));
    } catch {
      // ignore
    }
    showToast(`Bem-vindo, ${user.name}! Sessão iniciada com sucesso.`);
  };

  const handleLogout = () => {
    setCurrentUserAccount(null);
    try {
      localStorage.removeItem('premierpet_logged_user');
    } catch {
      // ignore
    }
    showToast('Sessão encerrada com sucesso.');
  };

  // If user is not authenticated, show the official PremieRpet Login Screen with Microsoft Authenticator 2FA
  if (!currentUserAccount) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* 1. PINNED LEFT SIDEBAR (PRE-FIXADA NO LADO ESQUERDO) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        currentUserRole={currentUserRole}
        setCurrentUserRole={setCurrentUserRole}
        currentTenantId={currentTenantId}
        setCurrentTenantId={setCurrentTenantId}
        tenants={TENANTS}
        pendingGovCount={pendingGovCount}
        lowStockCount={lowStockCount}
        totalCatalogCount={totalCatalogCount}
        onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
        currentUserAccount={currentUserAccount}
        onLogout={handleLogout}
      />

      {/* 2. MAIN VIEWPORT AREA (OFFSET BY SIDEBAR WIDTH) */}
      <div className="flex-1 flex flex-col pl-64 min-w-0">
        
        {/* TOP COMPACT HEADER */}
        <Header
          currentTab={currentTab}
          currentUserRole={currentUserRole}
          currentTenant={activeTenant}
          onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
        />

        {/* TOAST ALERT */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        )}

        {/* MAIN BODY CONTAINER */}
        <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
          
          {/* PLANT SCOPE BANNER (LIGHT THEME) */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-slate-500 font-medium">Unidade Operacional Ativa:</span>
              {currentUserRole === 'MASTER_ADMIN' ? (
                <span className="font-mono font-bold text-amber-800 flex items-center gap-1.5 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                  <ShieldCheck className="w-4 h-4 text-amber-600" /> MASTER ADMIN · GOVERNANÇA CENTRAL
                </span>
              ) : (
                <span className="font-mono font-bold text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  <Building2 className="w-4 h-4 text-emerald-600" /> {activeTenant.name} ({activeTenant.code})
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
              <span>Isolamento Multi-tenant:</span>
              <strong className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">ATIVO</strong>
              <span className="text-slate-400">· Custos e saldos privados por planta</span>
            </div>
          </div>

          {/* TAB 1: PDM CATALOG (GLOBAL TOTVS) */}
          {currentTab === 'catalog' && (
            <CatalogView
              items={pdmItems}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              tenantStocks={tenantStocks}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
              onAddToStock={(pdmItem) => setAddToStockPdmItem(pdmItem)}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
            />
          )}

          {/* TAB 2: GOVERNANCE & SANEAMENTO (MASTER) */}
          {currentTab === 'governance' && (
            <GovernanceView
              items={pdmItems}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              onApproveItem={handleApproveGovernanceItem}
              onRejectItem={handleRejectGovernanceItem}
              onLinkDuplicate={handleLinkDuplicate}
            />
          )}

          {/* TAB 2.5: CARGA & AUDITORIA TOTVS (EXCLUSIVO MASTER ADMIN) */}
          {currentTab === 'totvs-import' && currentUserRole === 'MASTER_ADMIN' && (
            <TotvsImportView
              existingPdmItems={pdmItems}
              currentUserRole={currentUserRole}
              currentTenant={activeTenant}
              onIntegrateItems={(newItems) => {
                setPdmItems((prev) => [...newItems, ...prev]);
                showToast(`${newItems.length} novos itens homologados e integrados ao Catálogo PDM!`);
              }}
              onIntegrateMergedBases={(mergedItems, mergedStocks) => {
                setPdmItems(mergedItems);
                if (mergedStocks && mergedStocks.length > 0) {
                  setTenantStocks(mergedStocks);
                }
                showToast(`Bases mescladas com sucesso! ${mergedItems.length.toLocaleString('pt-BR')} itens integrados aos ambientes Master, Dourado e Porto Amazonas.`);
              }}
              onOpenPdmBuilder={() => setIsPdmBuilderOpen(true)}
            />
          )}

          {/* TAB 3: LOCAL WAREHOUSE (TENANT) */}
          {currentTab === 'inventory' && (
            <InventoryView
              tenantStocks={tenantStocks}
              pdmItems={pdmItems}
              movements={movements}
              currentTenant={activeTenant}
              currentUserRole={currentUserRole}
              onRegisterMovement={handleRegisterMovement}
              onSelectItemDetail={(pdmItem) => setSelectedDetailItem(pdmItem)}
              onOpenCatalog={() => setCurrentTab('catalog')}
            />
          )}

          {/* TAB 4: INDUSTRIAL ABC CURVE */}
          {currentTab === 'abc' && (
            <ABCCurveDashboard
              tenantStocks={tenantStocks}
              movements={movements}
              pdmItems={pdmItems}
              currentTenant={activeTenant}
            />
          )}

        </main>

        {/* COMPACT FOOTER */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>PremieRpet · Sistema de Governança de Materiais & Almoxarifado Industrial</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Integrado ao TOTVS Protheus · Plantas Dourado/SP e Porto Amazonas/PR
            </div>
          </div>
        </footer>

      </div>

      {/* PDM BUILDER MODAL */}
      <PDMBuilderModal
        isOpen={isPdmBuilderOpen}
        onClose={() => setIsPdmBuilderOpen(false)}
        currentUserRole={currentUserRole}
        currentTenant={activeTenant}
        existingItems={pdmItems}
        onSaveItem={handleSavePdmItem}
      />

      {/* ADD TO STOCK MODAL */}
      <AddToStockModal
        isOpen={!!addToStockPdmItem}
        onClose={() => setAddToStockPdmItem(null)}
        pdmItem={addToStockPdmItem}
        currentTenant={activeTenant}
        onConfirmAdd={handleConfirmAddToStock}
      />

      {/* ITEM DETAIL SPEC MODAL */}
      <ItemDetailModal
        isOpen={!!selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        item={selectedDetailItem}
        tenantStock={
          selectedDetailItem
            ? tenantStocks.find(
                (s) => s.tenantId === activeTenant.id && s.pdmItemId === selectedDetailItem.id
              )
            : null
        }
        currentTenant={activeTenant}
        currentUserRole={currentUserRole}
        onAddToStock={(pdmItem) => setAddToStockPdmItem(pdmItem)}
      />

    </div>
  );
}
