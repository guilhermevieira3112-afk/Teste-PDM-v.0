import type {
  SharePointIntegrationStatus,
  SiteGovernanceDelta,
} from '../src/types/governanceSync.ts';
import type { UserProfileRole } from '../src/types/auth.ts';

export type GovernanceRole = UserProfileRole | 'UNIT_MANAGER';

export interface Env {
  DB?: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  POWER_AUTOMATE_WRITE_URL?: string;
  POWER_AUTOMATE_READ_URL?: string;
  POWER_AUTOMATE_EMAIL_URL?: string;
  POWER_AUTOMATE_TIMEOUT_MS?: string;
  AUTH_SESSION_SECRET?: string;
  APP_ENV?: string;
  STAGE1_DEV_BYPASS?: string;
}

export interface AuthenticatedContext {
  userId: string;
  username: string;
  name: string;
  role: GovernanceRole;
  tenantId: string;
  approvalTier?: 1 | 2 | 3 | 'ALL';
  authMethod: 'SESSION_COOKIE' | 'BEARER_TOKEN' | 'STAGE1_DEV_BYPASS';
}

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'D1_NOT_BOUND'
  | 'D1_SCHEMA_NOT_INITIALIZED'
  | 'R2_NOT_BOUND'
  | 'VERSION_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_ERROR';

export class ApiHttpError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface D1HealthInfo {
  bound: boolean;
  connected: boolean;
  schemaReady: boolean;
  currentVersion: number | null;
  lastUpdatedAt: string | null;
  missingTables?: string[];
  counts?: {
    users: number;
    history: number;
    syncLogs: number;
  };
  message: string;
}

export interface R2HealthInfo {
  bound: boolean;
  bucketName: string;
}

export interface GovernanceHealthResponse {
  ok: boolean;
  runtime: 'cloudflare-workers';
  environment: string;
  timestamp: string;
  version: number | null;
  auth: {
    protected: boolean;
    stage: 'STAGE_1_GUARD_READY' | 'STAGE_3_FULL_AUTH';
    devBypassActive: boolean;
  };
  d1: D1HealthInfo;
  r2: R2HealthInfo;
  sharePoint: SharePointIntegrationStatus & {
    listName: string;
    masterRecordId: number;
  };
  powerAutomate: {
    writeConfigured: boolean;
    readConfigured: boolean;
    emailConfigured: boolean;
  };
}

export interface GovernanceStateRow {
  id: number;
  version: number;
  updated_at: string;
  updated_by: string | null;
  delta_json: string;
}

export interface GovernanceSyncLogEntry {
  version: number;
  destination: 'SHAREPOINT_POWER_AUTOMATE';
  status: 'SYNCED' | 'LOCAL_ONLY' | 'ERROR';
  message: string;
  createdAt: string;
}

export interface SaveGovernanceStateInput {
  incomingState: SiteGovernanceDelta;
  baseVersion?: number;
  updatedBy: string;
  operation: 'PUT_STATE' | 'MANUAL_SYNC' | 'SHAREPOINT_REFRESH';
}

export interface SaveGovernanceStateResult {
  state: SiteGovernanceDelta;
  mergedConcurrently: boolean;
  mergedFields: string[];
}

export interface MediaAttachmentRef {
  key: string;
  url: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}
