import {
  PDMItem,
  PDMStatus,
  StockMovement,
  EstabelecimentoStockData,
  ItemPendingChange,
  ItemIntegrationRequest,
  ItemInactivationRequest,
  ItemChangeLog,
  ItemApprovalWorkflow,
  QuotationData,
} from './pdm';
import { UserAccount } from './auth';
import { PdmNivelItem } from '../data/pdmNiveisData';

export interface ItemGovernanceOverride {
  itemId: string;
  totvsCode?: string;
  pdmCode?: string;
  status?: PDMStatus;
  rejectionReason?: string;
  approvalWorkflow?: ItemApprovalWorkflow;
  quotation?: QuotationData;
  shortDescription?: string;
  longDescription?: string;
  narrative?: string;
  ncm?: string;
  unspsc?: string;
  genericImage?: string;
  situation?: string;
  nivel1?: string;
  nivel2?: string;
  nivel3?: string;
  isClassified?: boolean;
  classificationOrigin?: 'PDM_HOMOLOGADO' | 'TOTVS_SEM_CLASSIFICACAO';
  establishments?: Record<string, EstabelecimentoStockData>;
  pendingChange?: ItemPendingChange;
  integrationRequests?: ItemIntegrationRequest[];
  inactivationRequest?: ItemInactivationRequest;
  changeHistory?: ItemChangeLog[];
  updatedAt: string;
}

export interface SiteGovernanceDelta {
  version: number;
  updatedAt: string;
  updatedBy?: string;
  users: UserAccount[];
  global2FARequired: boolean;
  pdmLevels: PdmNivelItem[];
  customPdmItems: PDMItem[];
  itemOverrides: Record<string, ItemGovernanceOverride>;
  movements: StockMovement[];
}

export interface SharePointIntegrationStatus {
  writeConfigured: boolean;
  readConfigured: boolean;
  emailConfigured: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'IDLE' | 'SYNCED' | 'LOCAL_ONLY' | 'ERROR';
  lastSyncMessage: string | null;
}

export interface GovernanceStateResponse {
  state: SiteGovernanceDelta | null;
  sharePoint: SharePointIntegrationStatus;
  conflict?: boolean;
  mergedConcurrently?: boolean;
  error?: string;
  code?: string;
}
