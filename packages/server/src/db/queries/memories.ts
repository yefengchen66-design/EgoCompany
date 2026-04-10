import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export interface AgentMemory {
  id: string;
  agentId: string;
  content: string;
  tags: string[];
  type: string;
  createdAt: string;
}

function rowToMemory(r: any): AgentMemory {
  return {
    id: r.id, agentId: r.agent_id, content: r.content,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
    type: r.type, createdAt: r.created_at,
  };
}

export function addMemory(db: Database.Database, agentId: string, content: string, tags: string[] = [], type: string = 'note'): AgentMemory {
  const id = nanoid(12);
  db.prepare('INSERT INTO agent_memories (id, agent_id, content, tags, type) VALUES (?, ?, ?, ?, ?)').run(id, agentId, content, JSON.stringify(tags), type);

  // Index in FTS for semantic search
  try {
    db.prepare('INSERT INTO memories_fts (memory_id, agent_id, content, tags) VALUES (?, ?, ?, ?)')
      .run(id, agentId, content, tags.join(' '));
  } catch { /* FTS might not exist yet */ }

  return { id, agentId, content, tags, type, createdAt: new Date().toISOString() };
}

export function getMemories(db: Database.Database, agentId: string, limit: number = 20): AgentMemory[] {
  return (db.prepare('SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?').all(agentId, limit) as any[]).map(rowToMemory);
}

/** Full-text semantic search across all agent memories */
export function searchMemories(db: Database.Database, query: string, agentId?: string, limit = 20): AgentMemory[] {
  // Try FTS5 first
  try {
    let ftsQuery = query.trim().split(/\s+/).map(w => `"${w}"`).join(' OR ');
    let sql: string;
    let params: any[];

    if (agentId) {
      sql = `SELECT memory_id FROM memories_fts WHERE memories_fts MATCH ? AND agent_id = ? ORDER BY rank LIMIT ?`;
      params = [ftsQuery, agentId, limit];
    } else {
      sql = `SELECT memory_id FROM memories_fts WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?`;
      params = [ftsQuery, limit];
    }

    const ids = db.prepare(sql).all(...params) as Array<{ memory_id: string }>;
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      return (db.prepare(`SELECT * FROM agent_memories WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...ids.map(r => r.memory_id)) as any[])
        .map(rowToMemory);
    }
  } catch { /* FTS not available, fallback below */ }

  // Fallback: LIKE search
  let sql = "SELECT * FROM agent_memories WHERE content LIKE ?";
  const params: any[] = [`%${query}%`];
  if (agentId) { sql += " AND agent_id = ?"; params.push(agentId); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  return (db.prepare(sql).all(...params) as any[]).map(rowToMemory);
}

/** Search memories across entire department */
export function searchDeptMemories(db: Database.Database, departmentId: string, query: string, limit = 10): AgentMemory[] {
  try {
    const ftsQuery = query.trim().split(/\s+/).map(w => `"${w}"`).join(' OR ');
    const ids = db.prepare(
      `SELECT f.memory_id FROM memories_fts f
       INNER JOIN agent_memories m ON f.memory_id = m.id
       INNER JOIN agents a ON m.agent_id = a.id
       WHERE a.department_id = ? AND memories_fts MATCH ?
       ORDER BY rank LIMIT ?`
    ).all(departmentId, ftsQuery, limit) as Array<{ memory_id: string }>;

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      return (db.prepare(`SELECT * FROM agent_memories WHERE id IN (${placeholders})`).all(...ids.map(r => r.memory_id)) as any[])
        .map(rowToMemory);
    }
  } catch { /* fallback */ }

  // Fallback
  return (db.prepare(
    `SELECT m.* FROM agent_memories m
     INNER JOIN agents a ON m.agent_id = a.id
     WHERE a.department_id = ? AND m.content LIKE ?
     ORDER BY m.created_at DESC LIMIT ?`
  ).all(departmentId, `%${query}%`, limit) as any[]).map(rowToMemory);
}

export function deleteMemory(db: Database.Database, id: string): void {
  try { db.prepare('DELETE FROM memories_fts WHERE memory_id = ?').run(id); } catch {}
  db.prepare('DELETE FROM agent_memories WHERE id = ?').run(id);
}

/** Rebuild FTS index from existing memories (run once after migration) */
export function rebuildMemoryFts(db: Database.Database): number {
  try {
    db.prepare('DELETE FROM memories_fts').run();
    const rows = db.prepare('SELECT id, agent_id, content, tags FROM agent_memories').all() as any[];
    const insert = db.prepare('INSERT INTO memories_fts (memory_id, agent_id, content, tags) VALUES (?, ?, ?, ?)');
    for (const r of rows) {
      insert.run(r.id, r.agent_id, r.content, JSON.parse(r.tags).join(' '));
    }
    return rows.length;
  } catch {
    return 0;
  }
}
