import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { upsertDepartment, getAllDepartments } from '../db/queries/departments.js';
import { upsertAgent, getAllAgents, getAgentById, setAgentActive } from '../db/queries/agents.js';
import { createTask, getAllTasks, updateTaskStatus } from '../db/queries/tasks.js';

describe('Database Schema', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); });
  afterEach(() => { db.close(); });

  it('creates all tables', () => {
    initializeSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('departments');
    expect(names).toContain('agents');
    expect(names).toContain('tasks');
    expect(names).toContain('terminal_sessions');
    expect(names).toContain('runtimes');
  });

  it('is idempotent', () => {
    initializeSchema(db);
    initializeSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Department Queries', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); initializeSchema(db); });
  afterEach(() => { db.close(); });

  it('upserts and retrieves departments', () => {
    upsertDepartment(db, { id: 'engineering', name: '工程部', nameEn: 'Engineering', directorId: null, color: '#1565C0', emoji: '⚙️', sortOrder: 0 });
    const depts = getAllDepartments(db);
    expect(depts).toHaveLength(1);
    expect(depts[0].name).toBe('工程部');
  });
});

describe('Agent Queries', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    upsertDepartment(db, { id: 'engineering', name: '工程部', nameEn: 'Engineering', directorId: null, color: '#1565C0', emoji: '⚙️', sortOrder: 0 });
  });
  afterEach(() => { db.close(); });

  it('upserts and retrieves agents', () => {
    upsertAgent(db, { id: 'eng-001', name: 'Frontend Developer', departmentId: 'engineering', role: 'member', emoji: '🎨', color: '#4FC3F7', runtimes: ['claude-code'], maxConcurrentTasks: 2, definitionPath: 'engineering/frontend-developer.md', definitionHash: 'abc123' });
    const agent = getAgentById(db, 'eng-001');
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('Frontend Developer');
    expect(agent!.runtimes).toEqual(['claude-code']);
  });

  it('filters agents by department', () => {
    upsertAgent(db, { id: 'eng-001', name: 'FE', departmentId: 'engineering', role: 'member', emoji: '🎨', color: '#4FC3F7', runtimes: ['claude-code'], maxConcurrentTasks: 1, definitionPath: 'a.md', definitionHash: 'x' });
    const agents = getAllAgents(db, { departmentId: 'engineering' });
    expect(agents).toHaveLength(1);
    const empty = getAllAgents(db, { departmentId: 'design' });
    expect(empty).toHaveLength(0);
  });

  it('activates and deactivates agents', () => {
    upsertAgent(db, { id: 'eng-001', name: 'FE', departmentId: 'engineering', role: 'member', emoji: '🎨', color: '#4FC3F7', runtimes: ['claude-code'], maxConcurrentTasks: 1, definitionPath: 'a.md', definitionHash: 'x' });
    setAgentActive(db, 'eng-001', true);
    expect(getAgentById(db, 'eng-001')!.isActive).toBe(true);
    expect(getAgentById(db, 'eng-001')!.status).toBe('standby');
    setAgentActive(db, 'eng-001', false);
    expect(getAgentById(db, 'eng-001')!.isActive).toBe(false);
    expect(getAgentById(db, 'eng-001')!.status).toBe('offline');
  });
});

describe('Task Queries', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    upsertDepartment(db, { id: 'engineering', name: '工程部', nameEn: 'Engineering', directorId: null, color: '#1565C0', emoji: '⚙️', sortOrder: 0 });
    upsertAgent(db, { id: 'eng-001', name: 'FE', departmentId: 'engineering', role: 'member', emoji: '🎨', color: '#4FC3F7', runtimes: ['claude-code'], maxConcurrentTasks: 1, definitionPath: 'a.md', definitionHash: 'x' });
  });
  afterEach(() => { db.close(); });

  it('creates and retrieves tasks', () => {
    const task = createTask(db, { title: 'Build login page', input: 'Create a React login component', assignedTo: 'eng-001', departmentId: 'engineering' });
    expect(task.id).toBeDefined();
    expect(task.status).toBe('queued');
    const all = getAllTasks(db);
    expect(all).toHaveLength(1);
  });

  it('updates task status', () => {
    const task = createTask(db, { title: 'Test', input: 'test input' });
    updateTaskStatus(db, task.id, 'running');
    const updated = getAllTasks(db, { status: 'running' });
    expect(updated).toHaveLength(1);
    expect(updated[0].startedAt).toBeTruthy();
  });
});
