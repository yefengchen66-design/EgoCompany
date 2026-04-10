import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { getAllRuntimes } from '../db/queries/runtimes.js';
import { RuntimeDetector } from '../services/runtime-detector.js';
import { KNOWN_RUNTIMES } from '@ai-company/shared';

describe('RuntimeDetector', () => {
  let db: Database.Database;
  let detector: RuntimeDetector;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    detector = new RuntimeDetector(db);
  });

  afterEach(() => {
    db.close();
  });

  it('detectAll inserts exactly 1 runtime record', () => {
    const runtimes = detector.detectAll();
    expect(runtimes).toHaveLength(1);
  });

  it('detectAll inserts all known runtime ids', () => {
    detector.detectAll();
    const runtimes = getAllRuntimes(db);
    const ids = runtimes.map(r => r.id);
    for (const rt of KNOWN_RUNTIMES) {
      expect(ids).toContain(rt.id);
    }
  });

  it('all runtimes have a detectedAt timestamp', () => {
    detector.detectAll();
    const runtimes = getAllRuntimes(db);
    for (const rt of runtimes) {
      expect(rt.detectedAt).not.toBeNull();
    }
  });

  it('runtime has correct name and command', () => {
    detector.detectAll();
    const runtimes = getAllRuntimes(db);
    const byId = Object.fromEntries(runtimes.map(r => [r.id, r]));
    expect(byId['claude-code'].name).toBe('Claude Code');
    expect(byId['claude-code'].command).toBe('claude');
  });

  it('unavailable runtimes have isAvailable=false and no path', () => {
    detector.detectAll();
    const runtimes = getAllRuntimes(db);
    const unavailable = runtimes.filter(r => !r.isAvailable);
    for (const rt of unavailable) {
      expect(rt.path).toBeNull();
    }
  });

  it('is idempotent - running twice still returns 1 record', () => {
    detector.detectAll();
    const runtimes = detector.detectAll();
    expect(runtimes).toHaveLength(1);
  });
});
