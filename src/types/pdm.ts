export type UserRole = 'MASTER_ADMIN' | 'UNIT_MANAGER';

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
  // CE0348 establishments data
  establishments?: Record<string, EstabelecimentoStockData>;
  leadTimeDays?: number;
  orderPoint?: number;
  safetyStockWarehouse?: number;
  lastEntryDate?: string;
  lastExitDate?: string;
}

export type CriticismLevel = 'V' | 'E' | 'D'; // V = Vital, E = Essencial, D = Desejável

export interface TenantStockItem {
  id: string;
  tenantId: string;
  pdmItemId: string;
  internalCode: string;
  currentStock: number;
  minimumStock: number;
  safetyStock: number;
  safetyStockWarehouse?: number; // Estoque de segurança almoxarifado
  orderPoint?: number; // Lote mínimo / ponto de encomenda
  maxStock: number;
  unitCost: number; // R$ custo médio de aquisição
  storageLocation: string; // Ex: Galpão 02 / Rua C / Box 14
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
