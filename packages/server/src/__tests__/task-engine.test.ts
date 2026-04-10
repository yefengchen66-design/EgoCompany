import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TaskEngine } from '../services/task-engine.js';
import { initDb, closeDb } from '../db/connection.js';
import { initializeSchema } from '../db/schema.js';
import { upsertDepartment } from '../db/queries/departments.js';
import { upsertAgent, setAgentActive } from '../db/queries/agents.js';
import type Database from 'better-sqlite3';

describe('TaskEngine', () => {
  let db: Database.Database;
  let taskEngine: TaskEngine;

  const mockRegistry = {
    getDefinition: (id: string) => ({
      id,
      name: 'Test Agent',
      departmentId: 'engineering',
      role: 'member',
      emoji: '🤖',
      color: '#000',
      runtimes: ['claude-code'],
      maxConcurrentTasks: 1,
      systemPrompt: 'You are a test agent.',
      capabilities: [],
      definitionPath: 'test.md',
      definitionHash: 'abc123',
    }),
    buildSystemPrompt: (_id: string) => 'You are a test agent.',
  } as any;

  const mockTerminalManager = {
    startTask: vi.fn().mockResolvedValue('session-123'),
  } as any;

  beforeAll(() => {
    db = initDb(':memory:');
    initializeSchema(db);

    upsertDepartment(db, {
      id: 'engineering',
      name: 'Engineering',
      nameEn: 'Engineering',
      directorId: null,
      color: '#000',
      emoji: '⚙️',
      sortOrder: 0,
    });

    upsertAgent(db, {
      id: 'eng-001',
      name: 'Test Agent',
      departmentId: 'engineering',
      role: 'member',
      emoji: '🤖',
      color: '#000',
      runtimes: ['claude-code'],
      maxConcurrentTasks: 1,
      definitionPath: 'test.md',
      definitionHash: 'abc123',
    });

    // Make agent active
    setAgentActive(db, 'eng-001', true);

    upsertAgent(db, {
      id: 'eng-002',
      name: 'Inactive Agent',
      departmentId: 'engineering',
      role: 'member',
      emoji: '🤖',
      color: '#000',
      runtimes: ['claude-code'],
      maxConcurrentTasks: 1,
      definitionPath: 'test2.md',
      definitionHash: 'def456',
    });
    // eng-002 is NOT activated (isActive = false by default)

    taskEngine = new TaskEngine(db, mockRegistry, mockTerminalManager);
  });

  afterAll(() => {
    closeDb();
  });

  it('submitTask creates a task', async () => {
    const task = await taskEngine.submitTask({
      title: 'Test task',
      input: 'do something',
      assignedTo: 'eng-001',
      departmentId: 'engineering',
    });
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('queued');
  });

  it('submitTask rejects non-existent agent', async () => {
    await expect(
      taskEngine.submitTask({
        title: 'Test task',
        input: 'do something',
        assignedTo: 'nonexistent-agent',
      })
    ).rejects.toThrow('Agent not found: nonexistent-agent');
  });

  it('submitTask auto-activates inactive agent', async () => {
    // The new behavior auto-activates inactive agents rather than throwing
    const task = await taskEngine.submitTask({
      title: 'Test task',
      input: 'do something',
      assignedTo: 'eng-002',
    });
    expect(task.assignedTo).toBe('eng-002');
  });

  it('executeTask returns sessionId', async () => {
    // First create a task assigned to active agent
    const task = await taskEngine.submitTask({
      title: 'Execute test',
      input: 'execute this',
      assignedTo: 'eng-001',
    });

    // Insert a runtime so selectRuntime finds one
    db.prepare("INSERT OR REPLACE INTO runtimes (id, name, command, is_available) VALUES ('claude-code', 'Claude Code', 'claude', 1)").run();

    const sessionId = await taskEngine.executeTask(task.id);
    expect(sessionId).toBe('session-123');
  });
});
