import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
    return _db;
}

export function initDatabase(dbPath: string): Database.Database {
    // Ensure data directory exists
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    runMigrations(db);

    _db = db;
    return db;
}

function runMigrations(db: Database.Database): void {
    // Create migrations tracking table
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    const migrationsDir = join(__dirname, 'migrations');
    let files: string[];
    try {
        files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
    } catch {
        console.warn('[db] No migrations directory found, skipping migrations.');
        return;
    }

    const applied = new Set(
        db.prepare('SELECT filename FROM _migrations').all()
            .map((row: any) => row.filename as string)
    );

    for (const file of files) {
        if (applied.has(file)) continue;

        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        console.log(`[db] Running migration: ${file}`);
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    }
}

/**
 * Close the database connection. Used in tests and graceful shutdown.
 */
export function closeDatabase(): void {
    if (_db) {
        _db.close();
        _db = null;
    }
}
