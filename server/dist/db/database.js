import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
let _db = null;
export function getDb() {
    if (!_db)
        throw new Error('Database not initialized. Call initDatabase() first.');
    return _db;
}
export function initDatabase(dbPath) {
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
function runMigrations(db) {
    // Create migrations tracking table
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    const migrationsDir = join(__dirname, 'migrations');
    let files;
    try {
        files = readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
    }
    catch {
        console.warn('[db] No migrations directory found, skipping migrations.');
        return;
    }
    const applied = new Set(db.prepare('SELECT filename FROM _migrations').all()
        .map((row) => row.filename));
    for (const file of files) {
        if (applied.has(file))
            continue;
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        console.log(`[db] Running migration: ${file}`);
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    }
}
/**
 * Close the database connection. Used in tests and graceful shutdown.
 */
export function closeDatabase() {
    if (_db) {
        _db.close();
        _db = null;
    }
}
