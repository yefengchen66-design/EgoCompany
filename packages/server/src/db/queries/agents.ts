import type Database from 'better-sqlite3';
import type { Agent, AgentStatus } from '@ai-company/shared';

interface AgentRow {
  id: string; name: string; department_id: string; role: string;
  emoji: string; color: string; status: string; runtimes: string;
  max_concurrent_tasks: number; definition_path: string; definition_hash: string;
  is_active: number; created_at: string; updated_at: string;
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id, name: row.name, departmentId: row.department_id,
    role: row.role as Agent['role'], emoji: row.emoji, color: row.color,
    status: row.status as AgentStatus, runtimes: JSON.parse(row.runtimes),
    maxConcurrentTasks: row.max_concurrent_tasks,
    definitionPath: row.definition_path, definitionHash: row.definition_hash,
    isActive: row.is_active === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function upsertAgent(db: Database.Database, agent: {
  id: string; name: string; departmentId: string; role: string;
  emoji: string; color: string; runtimes: string[];
  maxConcurrentTasks: number; definitionPath: string; definitionHash: string;
}): void {
  db.prepare(`
    INSERT INTO agents (id, name, department_id, role, emoji, color, runtimes, max_concurrent_tasks, definition_path, definition_hash)
    VALUES (@id, @name, @departmentId, @role, @emoji, @color, @runtimes, @maxConcurrentTasks, @definitionPath, @definitionHash)
    ON CONFLICT(id) DO UPDATE SET
      name = @name, department_id = @departmentId, role = @role, emoji = @emoji, color = @color,
      runtimes = @runtimes, max_concurrent_tasks = @maxConcurrentTasks,
      definition_path = @definitionPath, definition_hash = @definitionHash,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: agent.id, name: agent.name, departmentId: agent.departmentId,
    role: agent.role, emoji: agent.emoji, color: agent.color,
    runtimes: JSON.stringify(agent.runtimes),
    maxConcurrentTasks: agent.maxConcurrentTasks,
    definitionPath: agent.definitionPath, definitionHash: agent.definitionHash,
  });
}

export function getAllAgents(db: Database.Database, filters?: {
  departmentId?: string; status?: string; role?: string;
}): Agent[] {
  let sql = 'SELECT * FROM agents WHERE 1=1';
  const params: Record<string, string> = {};
  if (filters?.departmentId) { sql += ' AND department_id = @departmentId'; params.departmentId = filters.departmentId; }
  if (filters?.status) { sql += ' AND status = @status'; params.status = filters.status; }
  if (filters?.role) { sql += ' AND role = @role'; params.role = filters.role; }
  sql += ' ORDER BY role DESC, id ASC';
  return (db.prepare(sql).all(params) as AgentRow[]).map(rowToAgent);
}

export function getAgentById(db: Database.Database, id: string): Agent | undefined {
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
  return row ? rowToAgent(row) : undefined;
}

export function updateAgentStatus(db: Database.Database, id: string, status: AgentStatus): void {
  db.prepare('UPDATE agents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
}

export function setAgentActive(db: Database.Database, id: string, isActive: boolean): void {
  const status = isActive ? 'standby' : 'offline';
  db.prepare('UPDATE agents SET is_active = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isActive ? 1 : 0, status, id);
}
