import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export type CrossDeptStatus = 'pending' | 'accepted' | 'completed' | 'rejected';

export interface CrossDeptRequest {
  id: string;
  fromDeptId: string;
  toDeptId: string;
  fromAgentId: string;
  title: string;
  description: string;
  context: string;
  status: CrossDeptStatus;
  sourceTaskId: string | null;
  resultTaskId: string | null;
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string; from_dept_id: string; to_dept_id: string; from_agent_id: string;
  title: string; description: string; context: string; status: string;
  source_task_id: string | null; result_task_id: string | null;
  result_summary: string | null; created_at: string; updated_at: string;
}

function rowTo(r: Row): CrossDeptRequest {
  return {
    id: r.id, fromDeptId: r.from_dept_id, toDeptId: r.to_dept_id,
    fromAgentId: r.from_agent_id, title: r.title, description: r.description,
    context: r.context, status: r.status as CrossDeptStatus,
    sourceTaskId: r.source_task_id, resultTaskId: r.result_task_id,
    resultSummary: r.result_summary,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function createCrossDeptRequest(db: Database.Database, input: {
  fromDeptId: string; toDeptId: string; fromAgentId: string;
  title: string; description: string; context?: string; sourceTaskId?: string;
}): CrossDeptRequest {
  const id = nanoid(12);
  db.prepare(
    `INSERT INTO cross_dept_requests (id, from_dept_id, to_dept_id, from_agent_id, title, description, context, source_task_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.fromDeptId, input.toDeptId, input.fromAgentId, input.title, input.description, input.context || '', input.sourceTaskId || null);
  return getCrossDeptRequest(db, id)!;
}

export function getCrossDeptRequest(db: Database.Database, id: string): CrossDeptRequest | undefined {
  const row = db.prepare('SELECT * FROM cross_dept_requests WHERE id = ?').get(id) as Row | undefined;
  return row ? rowTo(row) : undefined;
}

export function getAllCrossDeptRequests(db: Database.Database, filters?: {
  fromDeptId?: string; toDeptId?: string; status?: string;
}): CrossDeptRequest[] {
  let sql = 'SELECT * FROM cross_dept_requests WHERE 1=1';
  const params: any[] = [];
  if (filters?.fromDeptId) { sql += ' AND from_dept_id = ?'; params.push(filters.fromDeptId); }
  if (filters?.toDeptId) { sql += ' AND to_dept_id = ?'; params.push(filters.toDeptId); }
  if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
  sql += ' ORDER BY created_at DESC';
  return (db.prepare(sql).all(...params) as Row[]).map(rowTo);
}

export function updateCrossDeptRequest(db: Database.Database, id: string, update: {
  status?: CrossDeptStatus; resultTaskId?: string; resultSummary?: string;
}): void {
  const parts: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: any[] = [];
  if (update.status) { parts.push('status = ?'); params.push(update.status); }
  if (update.resultTaskId) { parts.push('result_task_id = ?'); params.push(update.resultTaskId); }
  if (update.resultSummary) { parts.push('result_summary = ?'); params.push(update.resultSummary); }
  params.push(id);
  db.prepare(`UPDATE cross_dept_requests SET ${parts.join(', ')} WHERE id = ?`).run(...params);
}
