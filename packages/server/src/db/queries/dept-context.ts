import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export interface DeptContextEntry {
  id: string;
  departmentId: string;
  key: string;
  value: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeptContextRow {
  id: string;
  department_id: string;
  key: string;
  value: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: DeptContextRow): DeptContextEntry {
  return {
    id: row.id, departmentId: row.department_id, key: row.key,
    value: row.value, updatedBy: row.updated_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function upsertDeptContext(db: Database.Database, deptId: string, key: string, value: string, updatedBy?: string): DeptContextEntry {
  const existing = db.prepare('SELECT id FROM dept_context WHERE department_id = ? AND key = ?').get(deptId, key) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE dept_context SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(value, updatedBy || null, existing.id);
    return getDeptContext(db, deptId, key)!;
  }
  const id = nanoid(12);
  db.prepare('INSERT INTO dept_context (id, department_id, key, value, updated_by) VALUES (?, ?, ?, ?, ?)')
    .run(id, deptId, key, value, updatedBy || null);
  return { id, departmentId: deptId, key, value, updatedBy: updatedBy || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function getDeptContext(db: Database.Database, deptId: string, key: string): DeptContextEntry | undefined {
  const row = db.prepare('SELECT * FROM dept_context WHERE department_id = ? AND key = ?').get(deptId, key) as DeptContextRow | undefined;
  return row ? rowToEntry(row) : undefined;
}

export function getAllDeptContext(db: Database.Database, deptId: string): DeptContextEntry[] {
  return (db.prepare('SELECT * FROM dept_context WHERE department_id = ? ORDER BY key ASC').all(deptId) as DeptContextRow[]).map(rowToEntry);
}

export function deleteDeptContext(db: Database.Database, deptId: string, key: string): boolean {
  const result = db.prepare('DELETE FROM dept_context WHERE department_id = ? AND key = ?').run(deptId, key);
  return result.changes > 0;
}
