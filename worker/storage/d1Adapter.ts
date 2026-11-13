import type { SiteGovernanceDelta } from '../../src/types/governanceSync.ts';
import type { UserAccount } from '../../src/types/auth.ts';
import {
  ApiHttpError,
  D1HealthInfo,
  GovernanceStateRow,
  GovernanceSyncLogEntry,
  SaveGovernanceStateInput,
  SaveGovernanceStateResult,
} from '../types.ts';
import {
  GovernanceStore,
  mergeConcurrentDeltas,
  sanitizeDeltaForStorage,
} from './contracts.ts';

const REQUIRED_GOVERNANCE_TABLES = [
  'governance_state',
  'governance_history',
  'governance_users',
  'governance_sync_log',
] as const;

const MAX_D1_DELTA_BYTES = 1_800_000; // Margem segura abaixo do limite de 2 MB por linha do D1

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes('no such table');
}

function normalizeApprovalTier(tier: UserAccount['approvalTier']): string | null {
  if (tier === undefined || tier === null) return null;
  const val = String(tier);
  return val === '1' || val === '2' || val === '3' || val === 'ALL' ? val : null;
}

export class D1GovernanceAdapter implements GovernanceStore {
  private readonly db?: D1Database;

  constructor(db?: D1Database) {
    this.db = db;
  }

  private requireDb(): D1Database {
    if (!this.db) {
      throw new ApiHttpError(
        503,
        'D1_NOT_BOUND',
        'Binding D1 (env.DB) não configurado neste Worker. Crie o banco D1 e associe o binding DB no wrangler.jsonc.'
      );
    }
    return this.db;
  }

  async getHealthInfo(): Promise<D1HealthInfo> {
    if (!this.db) {
      return {
        bound: false,
        connected: false,
        schemaReady: false,
        currentVersion: null,
        lastUpdatedAt: null,
        missingTables: [...REQUIRED_GOVERNANCE_TABLES],
        message: 'Binding D1 (DB) não configurado no ambiente.',
      };
    }

    try {
      await this.db.prepare('SELECT 1 AS ok').first();

      const missingTables: string[] = [];
      for (const tableName of REQUIRED_GOVERNANCE_TABLES) {
        const row = await this.db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
          .bind(tableName)
          .first<{ name: string }>();
        if (!row) {
          missingTables.push(tableName);
        }
      }

      if (missingTables.length > 0) {
        return {
          bound: true,
          connected: true,
          schemaReady: false,
          currentVersion: null,
          lastUpdatedAt: null,
          missingTables,
          message: `D1 conectado, aguardando aplicação das migrações SQL (${missingTables.join(', ')}).`,
        };
      }

      const [stateRow, usersCountRow, historyCountRow, syncCountRow] = await Promise.all([
        this.db
          .prepare('SELECT version, updated_at FROM governance_state WHERE id = 1 LIMIT 1')
          .first<{ version: number; updated_at: string }>(),
        this.db
          .prepare('SELECT COUNT(*) AS total FROM governance_users')
          .first<{ total: number }>(),
        this.db
          .prepare('SELECT COUNT(*) AS total FROM governance_history')
          .first<{ total: number }>(),
        this.db
          .prepare('SELECT COUNT(*) AS total FROM governance_sync_log')
          .first<{ total: number }>(),
      ]);

      return {
        bound: true,
        connected: true,
        schemaReady: true,
        currentVersion: stateRow ? Number(stateRow.version) : 0,
        lastUpdatedAt: stateRow?.updated_at ?? null,
        missingTables: [],
        counts: {
          users: Number(usersCountRow?.total ?? 0),
          history: Number(historyCountRow?.total ?? 0),
          syncLogs: Number(syncCountRow?.total ?? 0),
        },
        message: 'D1 conectado e todas as tabelas de governança operacionais.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao consultar D1';
      return {
        bound: true,
        connected: false,
        schemaReady: false,
        currentVersion: null,
        lastUpdatedAt: null,
        message: msg,
      };
    }
  }

  async getState(): Promise<SiteGovernanceDelta | null> {
    const db = this.requireDb();
    try {
      const row = await db
        .prepare(
          'SELECT id, version, updated_at, updated_by, delta_json FROM governance_state WHERE id = 1 LIMIT 1'
        )
        .first<GovernanceStateRow>();

      if (!row || !row.delta_json) {
        return null;
      }

      const parsed = JSON.parse(row.delta_json) as SiteGovernanceDelta;
      return sanitizeDeltaForStorage({
        ...parsed,
        version: Number(row.version),
        updatedAt: row.updated_at,
        updatedBy: row.updated_by || parsed.updatedBy,
      });
    } catch (err) {
      if (isMissingTableError(err)) {
        throw new ApiHttpError(
          503,
          'D1_SCHEMA_NOT_INITIALIZED',
          'Tabelas D1 de governança ainda não aplicadas. Execute as migrações SQL (migrations/).'
        );
      }
      if (err instanceof ApiHttpError) throw err;
      throw new ApiHttpError(
        500,
        'INTERNAL_ERROR',
        err instanceof Error ? err.message : 'Erro ao ler estado de governança do D1.'
      );
    }
  }

  async saveStateWithConcurrency(
    input: SaveGovernanceStateInput
  ): Promise<SaveGovernanceStateResult> {
    const db = this.requireDb();
    const sanitizedIncoming = sanitizeDeltaForStorage(input.incomingState);
    const now = new Date().toISOString();

    try {
      const existingRow = await db
        .prepare(
          'SELECT id, version, updated_at, updated_by, delta_json FROM governance_state WHERE id = 1 LIMIT 1'
        )
        .first<GovernanceStateRow>();

      // Primeira gravação no D1
      if (!existingRow) {
        if (input.baseVersion !== undefined && input.baseVersion > 0) {
          throw new ApiHttpError(
            409,
            'VERSION_CONFLICT',
            'Versão base informada não existe no D1 (estado inicial v0).',
            { currentVersion: 0, incomingVersion: input.baseVersion }
          );
        }

        const nextState: SiteGovernanceDelta = {
          ...sanitizedIncoming,
          version: 1,
          updatedAt: now,
          updatedBy: input.updatedBy,
        };
        const deltaJson = this.assertDeltaSizeWithinD1Limit(nextState);

        const insertRes = await db
          .prepare(
            'INSERT INTO governance_state (id, version, updated_at, updated_by, delta_json) VALUES (1, ?, ?, ?, ?)'
          )
          .bind(1, now, input.updatedBy, deltaJson)
          .run();

        if (!insertRes.success) {
          throw new ApiHttpError(500, 'INTERNAL_ERROR', 'Falha ao inserir estado inicial no D1.');
        }

        await this.persistAuditAndUsers(db, {
          state: nextState,
          deltaJson,
          operation: input.operation,
          updatedAt: now,
          updatedBy: input.updatedBy,
          previousState: null,
        });

        return {
          state: nextState,
          mergedConcurrently: false,
          mergedFields: [],
        };
      }

      const currentVersion = Number(existingRow.version);
      const currentState = sanitizeDeltaForStorage({
        ...(JSON.parse(existingRow.delta_json) as SiteGovernanceDelta),
        version: currentVersion,
        updatedAt: existingRow.updated_at,
        updatedBy: existingRow.updated_by || undefined,
      });

      const effectiveBaseVersion =
        input.baseVersion !== undefined ? input.baseVersion : sanitizedIncoming.version;

      let stateToPersist: SiteGovernanceDelta = sanitizedIncoming;
      let mergedConcurrently = false;
      let mergedFields: string[] = [];

      if (effectiveBaseVersion < currentVersion) {
        const mergeResult = mergeConcurrentDeltas(currentState, sanitizedIncoming);
        stateToPersist = mergeResult.merged;
        mergedConcurrently = true;
        mergedFields = mergeResult.mergedFields;
      } else if (effectiveBaseVersion > currentVersion) {
        throw new ApiHttpError(
          409,
          'VERSION_CONFLICT',
          `Versão recebida (${effectiveBaseVersion}) é superior à versão atual do D1 (${currentVersion}). Sincronize antes de gravar.`,
          {
            currentVersion,
            incomingVersion: effectiveBaseVersion,
            serverState: currentState,
          }
        );
      }

      const nextVersion = currentVersion + 1;
      const nextState: SiteGovernanceDelta = {
        ...stateToPersist,
        version: nextVersion,
        updatedAt: now,
        updatedBy: input.updatedBy,
      };
      const deltaJson = this.assertDeltaSizeWithinD1Limit(nextState);

      // Optimistic concurrency lock no D1
      const updateRes = await db
        .prepare(
          'UPDATE governance_state SET version = ?, updated_at = ?, updated_by = ?, delta_json = ? WHERE id = 1 AND version = ?'
        )
        .bind(nextVersion, now, input.updatedBy, deltaJson, currentVersion)
        .run();

      const changes = Number(updateRes.meta?.changes ?? 0);
      if (!updateRes.success || changes === 0) {
        throw new ApiHttpError(
          409,
          'VERSION_CONFLICT',
          'Conflito simultâneo durante gravação no D1. Outro usuário gravou antes desta transação.',
          { currentVersion }
        );
      }

      await this.persistAuditAndUsers(db, {
        state: nextState,
        deltaJson,
        operation: input.operation,
        updatedAt: now,
        updatedBy: input.updatedBy,
        previousState: currentState,
      });

      return {
        state: nextState,
        mergedConcurrently,
        mergedFields,
      };
    } catch (err) {
      if (isMissingTableError(err)) {
        throw new ApiHttpError(
          503,
          'D1_SCHEMA_NOT_INITIALIZED',
          'Tabelas D1 de governança ainda não aplicadas. Execute as migrações SQL (migrations/).'
        );
      }
      if (err instanceof ApiHttpError) throw err;
      throw new ApiHttpError(
        500,
        'INTERNAL_ERROR',
        err instanceof Error ? err.message : 'Erro ao gravar estado no D1.'
      );
    }
  }

  private assertDeltaSizeWithinD1Limit(state: SiteGovernanceDelta): string {
    const deltaJson = JSON.stringify(state);
    const bytes = new TextEncoder().encode(deltaJson).byteLength;
    if (bytes > MAX_D1_DELTA_BYTES) {
      throw new ApiHttpError(
        413,
        'PAYLOAD_TOO_LARGE',
        `Pacote de governança excedeu o limite seguro do D1 (${bytes} bytes > ${MAX_D1_DELTA_BYTES} bytes). Envie fotos/anexos via /api/files/upload (Cloudflare R2).`
      );
    }
    return deltaJson;
  }

  private async persistAuditAndUsers(
    db: D1Database,
    params: {
      state: SiteGovernanceDelta;
      deltaJson: string;
      operation: string;
      updatedAt: string;
      updatedBy: string;
      previousState: SiteGovernanceDelta | null;
    }
  ): Promise<void> {
    const statements: D1PreparedStatement[] = [];

    // 1. Histórico consolidado em governance_history
    statements.push(
      db
        .prepare(
          'INSERT INTO governance_history (version, operation, updated_at, updated_by, payload, sync_status) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(
          params.state.version,
          params.operation,
          params.updatedAt,
          params.updatedBy,
          params.deltaJson,
          'LOCAL_ONLY'
        )
    );

    // 2. Sincronização de perfis na tabela relacional governance_users (nunca armazena senha em texto puro)
    for (const user of params.state.users || []) {
      const normalizedRole =
        user.role === 'MASTER_ADMIN' ||
        user.role === 'ALMOXARIFADO' ||
        user.role === 'MANUTENCAO_PRODUCAO' ||
        user.role === 'UNIT_MANAGER'
          ? user.role
          : 'MANUTENCAO_PRODUCAO';

      const normalizedStatus =
        user.status === 'ACTIVE' || user.status === 'BLOCKED' || user.status === 'PENDING_APPROVAL'
          ? user.status
          : 'PENDING_APPROVAL';

      statements.push(
        db
          .prepare(
            `INSERT INTO governance_users (
              id, username, email, role, tenant_id, status, name, profile_title,
              tenant_name, approval_tier, department, two_factor_enabled,
              approved_at, approved_by, blocked_at, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email = excluded.email,
              role = excluded.role,
              tenant_id = excluded.tenant_id,
              status = excluded.status,
              name = excluded.name,
              profile_title = excluded.profile_title,
              tenant_name = excluded.tenant_name,
              approval_tier = excluded.approval_tier,
              department = excluded.department,
              two_factor_enabled = excluded.two_factor_enabled,
              approved_at = excluded.approved_at,
              approved_by = excluded.approved_by,
              blocked_at = excluded.blocked_at,
              notes = excluded.notes,
              updated_at = excluded.updated_at`
          )
          .bind(
            user.id,
            user.username.toLowerCase(),
            user.email.toLowerCase(),
            normalizedRole,
            user.tenantId || 'dourado-sp',
            normalizedStatus,
            user.name || user.username,
            user.profileTitle || null,
            user.tenantName || null,
            normalizeApprovalTier(user.approvalTier),
            user.department || null,
            user.twoFactorEnabled === false ? 0 : 1,
            user.approvedAt || null,
            user.approvedBy || null,
            user.blockedAt || null,
            user.notes || null,
            user.createdAt || params.updatedAt,
            params.updatedAt
          )
      );
    }

    // 3. Persistir configuração global 2FA em governance_settings
    statements.push(
      db
        .prepare(
          `INSERT INTO governance_settings (key, value, updated_at, updated_by)
           VALUES ('global2FARequired', ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`
        )
        .bind(String(params.state.global2FARequired), params.updatedAt, params.updatedBy)
    );

    if (typeof db.batch === 'function') {
      await db.batch(statements);
    } else {
      for (const stmt of statements) {
        await stmt.run();
      }
    }

    // 4. Registrar eventos indexados opcionais em governance_item_events (se migração 0002 aplicada)
    await this.recordItemDeltaEvents(db, params.state, params.previousState, params.updatedAt, params.updatedBy);
  }

  private async recordItemDeltaEvents(
    db: D1Database,
    nextState: SiteGovernanceDelta,
    prevState: SiteGovernanceDelta | null,
    createdAt: string,
    updatedBy: string
  ): Promise<void> {
    try {
      const eventStatements: D1PreparedStatement[] = [];
      const prevOverrides = prevState?.itemOverrides || {};

      for (const [itemId, ov] of Object.entries(nextState.itemOverrides || {})) {
        const prev = prevOverrides[itemId];
        if (!prev || JSON.stringify(prev) !== JSON.stringify(ov)) {
          const lastChange = ov.changeHistory?.[0];
          eventStatements.push(
            db
              .prepare(
                `INSERT INTO governance_item_events (
                  item_id, totvs_code, change_type, tenant_id, requested_by, approved_by, status, version, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                itemId,
                ov.totvsCode || ov.pdmCode || null,
                lastChange?.actionType || 'OVERRIDE_UPDATED',
                null,
                lastChange?.requestedByUser || updatedBy,
                lastChange?.approvedByUser || null,
                ov.status || 'UPDATED',
                nextState.version,
                createdAt
              )
          );
        }
      }

      const prevCustomIds = new Map((prevState?.customPdmItems || []).map((i) => [i.id, i]));
      for (const custom of nextState.customPdmItems || []) {
        const prev = prevCustomIds.get(custom.id);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(custom)) {
          eventStatements.push(
            db
              .prepare(
                `INSERT INTO governance_item_events (
                  item_id, totvs_code, change_type, tenant_id, requested_by, approved_by, status, version, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                custom.id,
                custom.totvsCode || custom.pdmCode || null,
                prev ? 'CUSTOM_PDM_UPDATED' : 'CUSTOM_PDM_CREATED',
                custom.requestedByTenantId || null,
                custom.requestedByUser || updatedBy,
                custom.changeHistory?.[0]?.approvedByUser || null,
                custom.status,
                nextState.version,
                createdAt
              )
          );
        }
      }

      if (eventStatements.length === 0) return;

      if (typeof db.batch === 'function') {
        await db.batch(eventStatements);
      } else {
        for (const stmt of eventStatements) {
          await stmt.run();
        }
      }
    } catch (err) {
      if (!isMissingTableError(err)) {
        throw err;
      }
    }
  }

  async updateHistorySyncStatus(
    version: number,
    syncStatus: 'SYNCED' | 'LOCAL_ONLY' | 'ERROR'
  ): Promise<void> {
    const db = this.requireDb();
    try {
      await db
        .prepare('UPDATE governance_history SET sync_status = ? WHERE version = ?')
        .bind(syncStatus, version)
        .run();
    } catch (err) {
      if (!isMissingTableError(err)) {
        throw err;
      }
    }
  }

  async recordSyncLog(entry: GovernanceSyncLogEntry): Promise<void> {
    const db = this.requireDb();
    try {
      await db
        .prepare(
          'INSERT INTO governance_sync_log (version, destination, status, message, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(entry.version, entry.destination, entry.status, entry.message, entry.createdAt)
        .run();
    } catch (err) {
      if (isMissingTableError(err)) {
        throw new ApiHttpError(
          503,
          'D1_SCHEMA_NOT_INITIALIZED',
          'Tabela governance_sync_log ainda não aplicada. Execute as migrações SQL (migrations/).'
        );
      }
      throw err;
    }
  }
}
