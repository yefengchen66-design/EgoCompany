import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TerminalManager } from '../services/terminal-manager.js';
import { initDb, closeDb } from '../db/connection.js';
import { initializeSchema } from '../db/schema.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('TerminalManager', () => {
  let logsDir: string;
  let manager: TerminalManager;

  beforeAll(() => {
    const db = initDb(':memory:');
    initializeSchema(db);
    logsDir = path.join(os.tmpdir(), `terminal-manager-test-${Date.now()}`);
    manager = new TerminalManager(db, logsDir);
  });

  afterAll(() => {
    manager.killAll();
    closeDb();
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true });
    }
  });

  it('constructor creates logs directory', () => {
    expect(fs.existsSync(logsDir)).toBe(true);
  });

  it('getActiveSessions returns empty array initially', () => {
    expect(manager.getActiveSessions()).toEqual([]);
  });

  it('getSession returns undefined for unknown id', () => {
    expect(manager.getSession('nonexistent')).toBeUndefined();
  });

  it('sendInput returns false for unknown session', () => {
    expect(manager.sendInput('nonexistent', 'test')).toBe(false);
  });

  it('killSession returns false for unknown session', () => {
    expect(manager.killSession('nonexistent')).toBe(false);
  });

  it('killAll does not throw when empty', () => {
    expect(() => manager.killAll()).not.toThrow();
  });
});
