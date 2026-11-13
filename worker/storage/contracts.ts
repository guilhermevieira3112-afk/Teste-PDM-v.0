import type {
  SiteGovernanceDelta,
  ItemGovernanceOverride,
} from '../../src/types/governanceSync.ts';
import type { UserAccount } from '../../src/types/auth.ts';
import type { PDMItem, StockMovement } from '../../src/types/pdm.ts';
import {
  ApiHttpError,
  D1HealthInfo,
  GovernanceSyncLogEntry,
  MediaAttachmentRef,
  SaveGovernanceStateInput,
  SaveGovernanceStateResult,
} from '../types.ts';

export interface GovernanceStore {
  getHealthInfo(): Promise<D1HealthInfo>;
  getState(): Promise<SiteGovernanceDelta | null>;
  saveStateWithConcurrency(input: SaveGovernanceStateInput): Promise<SaveGovernanceStateResult>;
  updateHistorySyncStatus(version: number, syncStatus: 'SYNCED' | 'LOCAL_ONLY' | 'ERROR'): Promise<void>;
  recordSyncLog(entry: GovernanceSyncLogEntry): Promise<void>;
}

export interface MediaStorage {
  putMedia(params: {
    key: string;
    data: ArrayBuffer;
    contentType: string;
    fileName: string;
    uploadedBy: string;
  }): Promise<MediaAttachmentRef>;
  getMedia(key: string): Promise<{
    body: ReadableStream<Uint8Array> | ArrayBuffer;
    contentType: string;
    size: number;
    etag: string;
  } | null>;
  deleteMedia(key: string): Promise<void>;
}

/**
 * Remove credenciais, hashes e segredos TOTP/sessão do pacote delta
 * para nunca persistir em delta_json ou enviar ao SharePoint.
 */
export function sanitizeDeltaForStorage(delta: SiteGovernanceDelta): SiteGovernanceDelta {
  const sanitizedUsers: UserAccount[] = (delta.users || []).map((user) => {
    const cleanUser: UserAccount = { ...user };
    delete cleanUser.password;
    delete cleanUser.totpSecret;
    const unsafeRecord = cleanUser as unknown as Record<string, unknown>;
    delete unsafeRecord.passwordHash;
    delete unsafeRecord.password_hash;
    delete unsafeRecord.sessionToken;
    delete unsafeRecord.totp_secret;
    return cleanUser;
  });

  return {
    version: Number.isFinite(delta.version) ? delta.version : 0,
    updatedAt: delta.updatedAt || new Date().toISOString(),
    updatedBy: delta.updatedBy,
    users: sanitizedUsers,
    global2FARequired:
      typeof delta.global2FARequired === 'boolean' ? delta.global2FARequired : true,
    pdmLevels: Array.isArray(delta.pdmLevels) ? delta.pdmLevels : [],
    customPdmItems: Array.isArray(delta.customPdmItems) ? delta.customPdmItems : [],
    itemOverrides:
      delta.itemOverrides && typeof delta.itemOverrides === 'object'
        ? delta.itemOverrides
        : {},
    movements: Array.isArray(delta.movements) ? delta.movements : [],
  };
}

export function validateIncomingDelta(raw: unknown): SiteGovernanceDelta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiHttpError(
      400,
      'VALIDATION_ERROR',
      'Objeto "state" inválido. Estrutura SiteGovernanceDelta esperada.'
    );
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.users)) {
    throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Campo "state.users" deve ser uma lista.');
  }
  if (!Array.isArray(obj.pdmLevels)) {
    throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Campo "state.pdmLevels" deve ser uma lista.');
  }
  if (!Array.isArray(obj.customPdmItems)) {
    throw new ApiHttpError(
      400,
      'VALIDATION_ERROR',
      'Campo "state.customPdmItems" deve ser uma lista.'
    );
  }
  if (!obj.itemOverrides || typeof obj.itemOverrides !== 'object' || Array.isArray(obj.itemOverrides)) {
    throw new ApiHttpError(
      400,
      'VALIDATION_ERROR',
      'Campo "state.itemOverrides" deve ser um objeto indexado por itemId.'
    );
  }
  if (!Array.isArray(obj.movements)) {
    throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Campo "state.movements" deve ser uma lista.');
  }

  return sanitizeDeltaForStorage(obj as unknown as SiteGovernanceDelta);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function mergeById<T extends { id: string }>(
  currentList: T[],
  incomingList: T[],
  entityLabel: string,
  conflicts: string[]
): T[] {
  const currentMap = new Map(currentList.map((entry) => [entry.id, entry]));
  const resultMap = new Map(currentMap);

  for (const incomingEntry of incomingList) {
    const existing = currentMap.get(incomingEntry.id);
    if (!existing) {
      resultMap.set(incomingEntry.id, incomingEntry);
      continue;
    }

    if (stableJson(existing) === stableJson(incomingEntry)) {
      continue;
    }

    const existingUpdatedAt =
      ((existing as unknown as Record<string, unknown>).updatedAt as string | undefined) ||
      ((existing as unknown as Record<string, unknown>).approvedAt as string | undefined) ||
      '';
    const incomingUpdatedAt =
      ((incomingEntry as unknown as Record<string, unknown>).updatedAt as string | undefined) ||
      ((incomingEntry as unknown as Record<string, unknown>).approvedAt as string | undefined) ||
      '';

    if (incomingUpdatedAt && existingUpdatedAt && incomingUpdatedAt === existingUpdatedAt) {
      conflicts.push(`${entityLabel}:${incomingEntry.id}`);
    } else if (!incomingUpdatedAt || !existingUpdatedAt || existingUpdatedAt > incomingUpdatedAt) {
      conflicts.push(`${entityLabel}:${incomingEntry.id}`);
    } else {
      resultMap.set(incomingEntry.id, incomingEntry);
    }
  }

  return Array.from(resultMap.values());
}

/**
 * Resolve atualizações concorrentes quando baseVersion < currentVersion:
 * - Se alterações ocorreram em registros independentes (ex.: Unidade A alterou Item 1
 *   e Unidade B alterou Item 2), realiza merge preservando ambos.
 * - Se duas unidades alteraram o mesmo item/usuário simultaneamente, dispara 409 CONFLICT.
 */
export function mergeConcurrentDeltas(
  current: SiteGovernanceDelta,
  incoming: SiteGovernanceDelta
): { merged: SiteGovernanceDelta; mergedFields: string[] } {
  const conflicts: string[] = [];
  const mergedFields: string[] = [];

  // 1. Merge de overrides de itens TOTVS por itemId
  const mergedOverrides: Record<string, ItemGovernanceOverride> = {
    ...(current.itemOverrides || {}),
  };

  for (const [itemId, incomingOv] of Object.entries(incoming.itemOverrides || {})) {
    const existingOv = mergedOverrides[itemId];
    if (!existingOv) {
      mergedOverrides[itemId] = incomingOv;
      mergedFields.push(`itemOverrides:${itemId}`);
      continue;
    }
    if (stableJson(existingOv) === stableJson(incomingOv)) {
      continue;
    }
    // Mesmo item alterado na versão atual e na versão recebida -> conflito explícito
    conflicts.push(`itemOverrides:${itemId}`);
  }

  // 2. Merge de novos itens PDM criados no portal
  const mergedCustomItems: PDMItem[] = mergeById(
    current.customPdmItems || [],
    incoming.customPdmItems || [],
    'customPdmItems',
    conflicts
  );
  if (mergedCustomItems.length !== (current.customPdmItems || []).length) {
    mergedFields.push('customPdmItems');
  }

  // 3. Merge de usuários (sem senhas/segredos)
  const mergedUsers: UserAccount[] = mergeById(
    current.users || [],
    incoming.users || [],
    'users',
    conflicts
  );
  if (mergedUsers.length !== (current.users || []).length) {
    mergedFields.push('users');
  }

  // 4. Merge de movimentações por id
  const currentMovesMap = new Map((current.movements || []).map((m) => [m.id, m]));
  for (const move of incoming.movements || []) {
    if (!currentMovesMap.has(move.id)) {
      currentMovesMap.set(move.id, move);
      mergedFields.push(`movements:${move.id}`);
    }
  }
  const mergedMovements: StockMovement[] = Array.from(currentMovesMap.values());

  // 5. Níveis PDM e flag global 2FA
  let mergedPdmLevels = current.pdmLevels || [];
  if (stableJson(current.pdmLevels) !== stableJson(incoming.pdmLevels)) {
    if ((incoming.pdmLevels?.length || 0) > (current.pdmLevels?.length || 0)) {
      mergedPdmLevels = incoming.pdmLevels;
      mergedFields.push('pdmLevels');
    } else {
      conflicts.push('pdmLevels');
    }
  }

  const merged2FA =
    current.global2FARequired !== incoming.global2FARequired
      ? (conflicts.push('global2FARequired'), current.global2FARequired)
      : current.global2FARequired;

  if (conflicts.length > 0) {
    throw new ApiHttpError(
      409,
      'VERSION_CONFLICT',
      `Conflito de concorrência detectado: outro usuário/unidade atualizou os mesmos registros (${conflicts.join(', ')}). Atualize o estado antes de reenviar.`,
      {
        currentVersion: current.version,
        incomingVersion: incoming.version,
        conflictingRecords: conflicts,
        serverState: current,
      }
    );
  }

  const merged: SiteGovernanceDelta = sanitizeDeltaForStorage({
    version: current.version,
    updatedAt: new Date().toISOString(),
    updatedBy: incoming.updatedBy || current.updatedBy,
    users: mergedUsers,
    global2FARequired: merged2FA,
    pdmLevels: mergedPdmLevels,
    customPdmItems: mergedCustomItems,
    itemOverrides: mergedOverrides,
    movements: mergedMovements,
  });

  return { merged, mergedFields };
}
