import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeSchema } from '../db/schema.js';
import { getAllDepartments } from '../db/queries/departments.js';
import { getAllAgents } from '../db/queries/agents.js';
import { AgentRegistry } from '../services/agent-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// agents dir: packages/agents
const AGENTS_DIR = path.resolve(__dirname, '../../../../packages/agents');

describe('AgentRegistry', () => {
  let db: Database.Database;
  let registry: AgentRegistry;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    registry = new AgentRegistry(db, AGENTS_DIR);
  });

  afterEach(() => {
    db.close();
  });

  it('loadAll loads 15 departments and 201 agents', async () => {
    const result = await registry.loadAll();
    expect(result.departments).toBe(15);
    expect(result.agents).toBe(201);
  });

  it('populates departments table with 12 rows', async () => {
    await registry.loadAll();
    const depts = getAllDepartments(db);
    expect(depts).toHaveLength(15);
    const ids = depts.map(d => d.id);
    expect(ids).toContain('engineering');
    expect(ids).toContain('design');
    expect(ids).toContain('data-ai');
  });

  it('populates agents table with 198 rows', async () => {
    await registry.loadAll();
    const agents = getAllAgents(db);
    expect(agents).toHaveLength(201);
  });

  it('sets director_id on departments', async () => {
    await registry.loadAll();
    const depts = getAllDepartments(db);
    for (const dept of depts) {
      expect(dept.directorId).not.toBeNull();
    }
    const eng = depts.find(d => d.id === 'engineering');
    expect(eng?.directorId).toBe('eng-000');
  });

  it('getDefinition returns parsed data with identity and coreMission', async () => {
    await registry.loadAll();
    const def = registry.getDefinition('eng-000');
    expect(def).toBeDefined();
    expect(def!.id).toBe('eng-000');
    expect(def!.name).toContain('Engineering Director');
    expect(def!.identity).toBeTruthy();
    expect(def!.coreMission).toBeTruthy();
    expect(def!.role).toBe('director');
    expect(def!.department).toBe('engineering');
  });

  it('getAllDefinitions returns all 198 definitions', async () => {
    await registry.loadAll();
    const defs = registry.getAllDefinitions();
    expect(defs).toHaveLength(201);
  });

  it('buildSystemPrompt returns a prompt string for an agent', async () => {
    await registry.loadAll();
    const prompt = registry.buildSystemPrompt('eng-000');
    expect(prompt).toContain('Engineering Director');
    expect(prompt).toContain('Identity');
    expect(prompt).toContain('Core Mission');
  });
});
