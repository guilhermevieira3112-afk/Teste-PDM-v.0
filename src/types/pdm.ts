export type UserRole = 'MASTER_ADMIN' | 'UNIT_MANAGER' | 'ALMOXARIFADO' | 'MANUTENCAO_PRODUCAO';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  unitType: string;
  costCenters: string[];
}

export interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'select' | 'number';
  unit?: string;
  options?: string[];
  placeholder?: string;
  orderInNarrative: number;
  shortCode?: string;
  required?: boolean;
}

export interface SpecificSubgroup {
  id: string;
  subgroupId: string;
  name: string;
  code: string;
  shortPrefix: string;
  defaultNcm: string;
  defaultUnspsc: string;
  attributeDefinitions: AttributeDefinition[];
}

export interface Subgroup {
  id: string;
  groupId: string;
  name: string;
  code: string;
  specificSubgroups: SpecificSubgroup[];
}

export interface Group {
  id: string;
  name: string;
  code: string;
  description: string;
  subgroups: Subgroup[];
}

export type PDMStatus = 'APPROVED' | 'PENDING_REVIEW' | 'FLAGGED_DUPLICATE' | 'REJECTED';

export interface EstabelecimentoStockData {
  estabelecimento: '10' | '14' | string;
  plantaNome: 'Dourado/SP' | 'Porto Amazonas/PR' | string;
  saldoEstoque: number; // Col G - Saldo Estoque preservado
  pontoEncomenda: number; // Col H - Lote mínimo para compra
  estoqueSegurancaAlmoxarifado: number; // Col I - Estoque de segurança almoxarifado
  tempoRessuprimento: number; // Col K - Tempo de ressuprimento (lead time em dias)
  ultimaEntrada?: string; // Col R - Última Entrada
  ultimaSaida?: string; // Col S - Última Saída
}

export interface PDMItem {
  id: string;
  pdmCode: string;
  groupId: string;
  subgroupId: string;
  specificSubgroupId: string;
  shortDescription: string; // Max 60 chars, no accents, uppercase
  longDescription: string;  // Full technical narrative
  attributes: Record<string, string>;
  ncm: string;
  unspsc: string;
  genericImage?: string;
  status: PDMStatus;
  createdAt: string;
  requestedByTenantId?: string;
  requestedByTenantName?: string;
  requestedByUser?: string;
  notes?: string;
  rejectionReason?: string;
  duplicateOfId?: string;
  similarityScore?: number;
  // TOTVS ERP real fields
  totvsCode?: string;
  totvsFamily?: string;
  unitOfMeasure?: string;
  totvsPlant?: string;
  situation?: string; // 'Ativo' | 'Totalmente Obsoleto' from Itens.csv
  originalDescription?: string;
  narrative?: string; // Campo Narrativa do TOTVS Protheus (máx 200c, crucial para busca por part numbers e observações)
  baseValue?: number;
  // MRO 3-Level Classification (Classificacao_Almoxarifado_MRO_Padronizado)
  nivel1?: string; // Nível 1: Grupo Macro
  nivel2?: string; // Nível 2: Subgrupo / Família
  nivel3?: string; // Nível 3: Subgrupo Específico
  // Classification origin (identifica cadastros diretos no TOTVS sem saneamento)
  isClassified?: boolean;
  classificationOrigin?: 'PDM_HOMOLOGADO' | 'TOTVS_SEM_CLASSIFICACAO';
  // Quotation (Orçamento / Proposta Comercial obrigatório para novos itens)
  quotation?: QuotationData;
  // Multi-tier Approval Workflow (Níveis 1, 2, 3 por alçada de valor)
  approvalWorkflow?: ItemApprovalWorkflow;
  // Solicitação de Inativação / Obsolescência
  inactivationRequest?: ItemInactivationRequest;
  // Solicitações de Integração entre Almoxarifados (Dourado <-> Porto Amazonas)
  integrationRequests?: ItemIntegrationRequest[];
  // Change History & Pending Governance Requests
  changeHistory?: ItemChangeLog[];
  pendingChange?: ItemPendingChange;
  // CE0348 establishments data
  establishments?: Record<string, EstabelecimentoStockData>;
  leadTimeDays?: number;
  orderPoint?: number;
  safetyStockWarehouse?: number;
  lastEntryDate?: string;
  lastExitDate?: string;
}

export interface QuotationData {
  supplierName: string; // Fornecedor cotado
  quoteNumber: string; // Número do orçamento / proposta comercial
  estimatedValue: number; // Valor unitário / base estimado em R$
  fileName: string; // Nome do arquivo anexo (ex: Orcamento_SKF_Rolamentos_2026.pdf)
  fileSize?: string;
  fileDate?: string;
  notes?: string;
}

export type ApprovalTierLevel = 1 | 2 | 3;

export interface ApprovalStepRecord {
  tier: ApprovalTierLevel;
  tierLabel: string; // "Nível 1 (até R$ 1.000)", "Nível 2 (até R$ 10.000)", "Nível 3 (> R$ 10.000)"
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING_PREVIOUS_TIER';
  approvedByUser?: string;
  approvedAt?: string;
  userRole?: string;
  notes?: string;
}

export interface ItemApprovalWorkflow {
  requiredTiers: ApprovalTierLevel[];
  currentPendingTier: ApprovalTierLevel | null;
  estimatedValue: number;
  steps: ApprovalStepRecord[];
  isFullyApproved: boolean;
  rejection?: {
    rejectedBy: string;
    rejectedAt: string;
    tier: ApprovalTierLevel;
    reason: string;
  };
  cancellation?: {
    cancelledBy: string;
    cancelledAt: string;
    reason: string;
  };
}

export interface ItemIntegrationRequest {
  id: string;
  pdmItemId: string;
  pdmCode: string;
  itemDescription: string;
  sourcePlant: string; // Estabelecimento origem (ex: 10 - Dourado)
  targetPlant: string; // Estabelecimento destino (ex: 14 - Porto Amazonas)
  requestedSafetyStock: number; // Quantidade segura solicitada
  requestedOrderPoint?: number; // Ponto de encomenda sugerido
  reason: string;
  requestedByUser: string;
  requestedByTenantId: string;
  requestedByTenantName: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface ItemInactivationRequest {
  id: string;
  pdmItemId: string;
  pdmCode: string;
  itemDescription: string;
  reason: string;
  replacementItemCode?: string;
  requestedByUser: string;
  requestedByTenantId: string;
  requestedByTenantName: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export type ChangeActionType = 
  | 'CREATED' 
  | 'CLASSIFIED' 
  | 'EDITED' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'CANCELLED' 
  | 'INTEGRATED' 
  | 'INACTIVATED';

export interface ItemFieldChange {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
}

export interface ItemChangeLog {
  id: string;
  timestamp: string;
  actionType?: ChangeActionType;
  actionLabel?: string;
  requestedByUser: string;
  requestedByRole?: string;
  requestedByTenantName?: string;
  approvedByUser?: string;
  approvedAt?: string;
  approvalTier?: ApprovalTierLevel | string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  reason?: string;
  rejectionReason?: string;
  changes?: ItemFieldChange[];
}

export interface ItemPendingChange {
  id: string;
  requestedAt: string;
  requestedByUser: string;
  requestedByTenantId?: string;
  requestedByTenantName?: string;
  reason: string;
  changes: ItemFieldChange[];
  proposedValues: Partial<PDMItem>;
}

export type CriticismLevel = 'V' | 'E' | 'D'; // V = Vital, E = Essencial, D = Desejável

export interface TenantStockItem {
  id: string;
  tenantId: string;
  pdmItemId: string;
  internalCode: string;
  currentStock: number; // Saldo atual geral / TOTVS
  totvsStock?: number;  // SALDO ATUAL TOTVS (base CE0348 Col G)
  wmsStock?: number;    // SALDO ATUAL WMS (base Estoque Peças Col D QTD)
  wmsAddress?: string;  // Posição WMS (base Estoque Peças Col E ENDEREÇO)
  wmsAddresses?: string[];
  divergence?: number;  // Diferença (wmsStock - totvsStock)
  minimumStock: number;
  safetyStock: number;
  safetyStockWarehouse?: number; // Estoque de segurança almoxarifado
  orderPoint?: number; // Lote mínimo / ponto de encomenda
  maxStock: number;
  unitCost: number; // R$ custo médio de aquisição
  storageLocation: string; // Ex: 03-008-04-01 ou Almox Central Dourado
  criticism: CriticismLevel;
  leadTimeDays: number;
  lastInventoryDate: string;
  lastEntryDate?: string;
  lastExitDate?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export type MovementType = 'IN' | 'OUT' | 'RETURN';

export interface StockMovement {
  id: string;
  tenantId: string;
  pdmItemId: string;
  type: MovementType;
  quantity: number;
  unitCost: number;
  totalValue: number;
  date: string;
  costCenter: string;
  requisitioner: string;
  documentNumber: string;
  notes?: string;
}

export type ABCClass = 'A' | 'B' | 'C';

export interface ABCAnalysisItem {
  pdmItemId: string;
  pdmCode: string;
  internalCode: string;
  description: string;
  unitCost: number;
  currentStock: number;
  consumedQuantity: number;
  consumedValue: number; // Qtd x Custo
  percentageOfTotal: number;
  accumulatedPercentage: number;
  abcClass: ABCClass;
  criticism: CriticismLevel;
}

export interface ABCSummary {
  periodMonths: number;
  totalConsumedValue: number;
  totalSKUs: number;
  classA: {
    skuCount: number;
    skuPercentage: number;
    consumedValue: number;
    valuePercentage: number;
  };
  classB: {
    skuCount: number;
    skuPercentage: number;
    consumedValue: number;
    valuePercentage: number;
  };
  classC: {
    skuCount: number;
    skuPercentage: number;
    consumedValue: number;
    valuePercentage: number;
  };
}
