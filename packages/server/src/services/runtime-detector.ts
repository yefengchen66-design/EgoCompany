import type Database from 'better-sqlite3';
import { execSync } from 'node:child_process';
import { KNOWN_RUNTIMES } from '@ai-company/shared';
import { upsertRuntime, getAllRuntimes } from '../db/queries/runtimes.js';
import type { Runtime } from '@ai-company/shared';

export class RuntimeDetector {
  constructor(private db: Database.Database) {}

  detectAll(): Runtime[] {
    const now = new Date().toISOString();

    for (const rt of KNOWN_RUNTIMES) {
      let isAvailable = false;
      let version: string | null = null;
      let binPath: string | null = null;

      try {
        const whichResult = execSync(`which ${rt.command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        binPath = whichResult.trim();
        if (binPath) {
          isAvailable = true;
        }
      } catch {
        // command not found
      }

      if (isAvailable) {
        try {
          const versionOutput = execSync(`${rt.command} --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
          version = versionOutput.trim().split('\n')[0] ?? null;
        } catch {
          // version check failed, still available if which succeeded
        }
      }

      upsertRuntime(this.db, {
        id: rt.id,
        name: rt.name,
        command: rt.command,
        version,
        path: binPath,
        isAvailable,
        detectedAt: now,
      });
    }

    return getAllRuntimes(this.db);
  }
}
