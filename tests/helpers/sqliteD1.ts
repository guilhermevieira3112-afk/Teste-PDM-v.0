import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Harness de testes que encapsula SQLite real (node:sqlite) com a interface exata
 * do Cloudflare D1Database, permitindo executar as migrações SQL reais e todas
 * as queries parametrizadas do D1GovernanceAdapter nos testes automatizados.
 */
class SqliteD1PreparedStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private params: unknown[] = [];

  constructor(db: DatabaseSync, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.params = values.map((v) => (v === undefined ? null : v));
    return this as unknown as D1PreparedStatement;
  }

  async first<T = unknown>(): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...(this.params as [])) as T | undefined;
    return row ?? null;
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...(this.params as [])) as T[];
    return {
      success: true,
      results: rows,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: rows.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
  }

  async run(): Promise<D1Result> {
    const stmt = this.db.prepare(this.sql);
    const info = stmt.run(...(this.params as []));
    const changes = Number(info.changes ?? 0);
    return {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: changes,
        last_row_id: Number(info.lastInsertRowid ?? 0),
        changed_db: changes > 0,
        changes,
      },
    };
  }

  async raw(): Promise<unknown[]> {
    const stmt = this.db.prepare(this.sql);
    return stmt.all(...(this.params as [])) as unknown[];
  }
}

export class SqliteD1TestDatabase {
  public readonly sqlite: DatabaseSync;

  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
  }

  applyAllMigrations(migrationsDir = path.resolve(process.cwd(), 'migrations')): string[] {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      this.sqlite.exec(sql);
    }
    return files;
  }

  prepare(sql: string): D1PreparedStatement {
    return new SqliteD1PreparedStatement(this.sqlite, sql) as unknown as D1PreparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.sqlite.exec('BEGIN IMMEDIATE;');
    try {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push((await stmt.run()) as D1Result<T>);
      }
      this.sqlite.exec('COMMIT;');
      return results;
    } catch (err) {
      this.sqlite.exec('ROLLBACK;');
      throw err;
    }
  }

  asBinding(): D1Database {
    return this as unknown as D1Database;
  }

  close(): void {
    this.sqlite.close();
  }
}
