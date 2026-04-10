import type Database from 'better-sqlite3';
import type { Runtime } from '@ai-company/shared';

export function upsertRuntime(db: Database.Database, runtime: Omit<Runtime, 'detectedAt'> & { detectedAt?: string | null }): void {
  db.prepare(`
    INSERT INTO runtimes (id, name, command, version, path, is_available, detected_at)
    VALUES (@id, @name, @command, @version, @path, @isAvailable, @detectedAt)
    ON CONFLICT(id) DO UPDATE SET
      version = @version, path = @path, is_available = @isAvailable, detected_at = @detectedAt
  `).run({
    id: runtime.id, name: runtime.name, command: runtime.command,
    version: runtime.version ?? null, path: runtime.path ?? null,
    isAvailable: runtime.isAvailable ? 1 : 0,
    detectedAt: runtime.detectedAt ?? null,
  });
}

export function getAllRuntimes(db: Database.Database): Runtime[] {
  return (db.prepare('SELECT id, name, command, version, path, is_available as isAvailable, detected_at as detectedAt FROM runtimes').all() as any[]).map(r => ({
    ...r, isAvailable: r.isAvailable === 1,
  }));
}
