/**
 * Structured Skills — adapted from Multica's skill system.
 * Skills are curated, reusable capabilities assigned to agents.
 * Categories: workflow (step-by-step process), template (output format),
 * tool (how to use a tool), knowledge (domain facts), general.
 */
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export type SkillCategory = 'workflow' | 'template' | 'tool' | 'knowledge' | 'general';

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  category: SkillCategory;
  config: Record<string, any>;
  createdBy: string | null;
  source: string | null;
  tags: string[];
  useCount: number;
  isActive: boolean;
  assignedAgents?: string[];
  createdAt: string;
  updatedAt: string;
}

interface SkillRow {
  id: string; name: string; description: string; content: string;
  category: string; config: string; created_by: string | null;
  source: string | null; tags: string; use_count: number;
  is_active: number; created_at: string; updated_at: string;
}

function rowToSkill(row: SkillRow): Skill {
  return {
    id: row.id, name: row.name, description: row.description,
    content: row.content, category: row.category as SkillCategory,
    config: JSON.parse(row.config), createdBy: row.created_by,
    source: row.source, tags: JSON.parse(row.tags),
    useCount: row.use_count, isActive: row.is_active === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function createSkill(db: Database.Database, input: {
  name: string; description?: string; content: string;
  category?: SkillCategory; config?: Record<string, any>;
  createdBy?: string; source?: string; tags?: string[];
}): Skill {
  const id = nanoid(12);
  db.prepare(
    `INSERT INTO skills (id, name, description, content, category, config, created_by, source, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.description || '', input.content,
    input.category || 'general', JSON.stringify(input.config || {}),
    input.createdBy || null, input.source || null, JSON.stringify(input.tags || []));

  try {
    db.prepare('INSERT INTO skills_fts (skill_id, title, description, template, tags) VALUES (?, ?, ?, ?, ?)')
      .run(id, input.name, input.description || '', input.content, (input.tags || []).join(' '));
  } catch {}

  return getSkillById(db, id)!;
}

export function updateSkill(db: Database.Database, id: string, input: {
  name?: string; description?: string; content?: string;
  category?: SkillCategory; config?: Record<string, any>;
  tags?: string[]; isActive?: boolean;
}): Skill | undefined {
  const skill = getSkillById(db, id);
  if (!skill) return undefined;
  const name = input.name ?? skill.name;
  const description = input.description ?? skill.description;
  const content = input.content ?? skill.content;
  const category = input.category ?? skill.category;
  const config = input.config ?? skill.config;
  const tags = input.tags ?? skill.tags;
  const isActive = input.isActive ?? skill.isActive;
  db.prepare(
    `UPDATE skills SET name=?, description=?, content=?, category=?, config=?, tags=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(name, description, content, category, JSON.stringify(config), JSON.stringify(tags), isActive ? 1 : 0, id);

  try {
    db.prepare('DELETE FROM skills_fts WHERE skill_id = ?').run(id);
    db.prepare('INSERT INTO skills_fts (skill_id, title, description, template, tags) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, description, content, tags.join(' '));
  } catch {}

  return getSkillById(db, id);
}

export function getSkillById(db: Database.Database, id: string): Skill | undefined {
  const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined;
  if (!row) return undefined;
  const skill = rowToSkill(row);
  skill.assignedAgents = (db.prepare('SELECT agent_id FROM agent_skills WHERE skill_id = ?').all(id) as { agent_id: string }[]).map(r => r.agent_id);
  return skill;
}

export function getAllSkills(db: Database.Database, filters?: {
  category?: string; active?: boolean;
}): Skill[] {
  let sql = 'SELECT * FROM skills WHERE 1=1';
  const params: any[] = [];
  if (filters?.category) { sql += ' AND category = ?'; params.push(filters.category); }
  if (filters?.active !== undefined) { sql += ' AND is_active = ?'; params.push(filters.active ? 1 : 0); }
  sql += ' ORDER BY use_count DESC, updated_at DESC';
  return (db.prepare(sql).all(...params) as SkillRow[]).map(rowToSkill);
}

export function searchSkills(db: Database.Database, query: string, limit = 5): Skill[] {
  try {
    const ftsQuery = query.trim().split(/\s+/).map(w => `"${w}"`).join(' OR ');
    const ids = db.prepare(
      `SELECT skill_id FROM skills_fts WHERE skills_fts MATCH ? ORDER BY rank LIMIT ?`
    ).all(ftsQuery, limit) as Array<{ skill_id: string }>;
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      return (db.prepare(`SELECT * FROM skills WHERE id IN (${placeholders})`).all(...ids.map(r => r.skill_id)) as SkillRow[]).map(rowToSkill);
    }
  } catch {}
  return (db.prepare('SELECT * FROM skills WHERE name LIKE ? OR description LIKE ? OR content LIKE ? ORDER BY use_count DESC LIMIT ?')
    .all(`%${query}%`, `%${query}%`, `%${query}%`, limit) as SkillRow[]).map(rowToSkill);
}

/** Get skills assigned to a specific agent */
export function getAgentSkills(db: Database.Database, agentId: string): Skill[] {
  const rows = db.prepare(
    `SELECT s.* FROM skills s INNER JOIN agent_skills a ON s.id = a.skill_id WHERE a.agent_id = ? AND s.is_active = 1 ORDER BY s.use_count DESC`
  ).all(agentId) as SkillRow[];
  return rows.map(rowToSkill);
}

/** Assign/unassign skill to agent */
export function assignSkillToAgent(db: Database.Database, skillId: string, agentId: string): void {
  db.prepare('INSERT OR IGNORE INTO agent_skills (agent_id, skill_id) VALUES (?, ?)').run(agentId, skillId);
}

export function unassignSkillFromAgent(db: Database.Database, skillId: string, agentId: string): void {
  db.prepare('DELETE FROM agent_skills WHERE agent_id = ? AND skill_id = ?').run(agentId, skillId);
}

/** Assign skill to all agents in a department */
export function assignSkillToDepartment(db: Database.Database, skillId: string, departmentId: string): number {
  const agents = db.prepare('SELECT id FROM agents WHERE department_id = ?').all(departmentId) as { id: string }[];
  const insert = db.prepare('INSERT OR IGNORE INTO agent_skills (agent_id, skill_id) VALUES (?, ?)');
  let count = 0;
  for (const a of agents) { insert.run(a.id, skillId); count++; }
  return count;
}

export function incrementSkillUse(db: Database.Database, id: string): void {
  db.prepare('UPDATE skills SET use_count = use_count + 1 WHERE id = ?').run(id);
}

export function deleteSkill(db: Database.Database, id: string): boolean {
  db.prepare('DELETE FROM agent_skills WHERE skill_id = ?').run(id);
  try { db.prepare('DELETE FROM skills_fts WHERE skill_id = ?').run(id); } catch {}
  return db.prepare('DELETE FROM skills WHERE id = ?').run(id).changes > 0;
}
