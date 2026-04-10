import type Database from 'better-sqlite3';
import type { Department, DeptStats } from '@ai-company/shared';

export function upsertDepartment(db: Database.Database, dept: Omit<Department, 'createdAt'>): void {
  db.prepare(`
    INSERT INTO departments (id, name, name_en, director_id, color, emoji, sort_order)
    VALUES (@id, @name, @nameEn, @directorId, @color, @emoji, @sortOrder)
    ON CONFLICT(id) DO UPDATE SET
      name = @name, name_en = @nameEn, director_id = @directorId,
      color = @color, emoji = @emoji, sort_order = @sortOrder
  `).run({
    id: dept.id, name: dept.name, nameEn: dept.nameEn,
    directorId: dept.directorId, color: dept.color,
    emoji: dept.emoji, sortOrder: dept.sortOrder,
  });
}

export function getAllDepartments(db: Database.Database): Department[] {
  return db.prepare('SELECT id, name, name_en as nameEn, director_id as directorId, color, emoji, sort_order as sortOrder, created_at as createdAt FROM departments ORDER BY sort_order').all() as Department[];
}

export function getDepartmentById(db: Database.Database, id: string): Department | undefined {
  return db.prepare('SELECT id, name, name_en as nameEn, director_id as directorId, color, emoji, sort_order as sortOrder, created_at as createdAt FROM departments WHERE id = ?').get(id) as Department | undefined;
}

export function getDeptStats(db: Database.Database, departmentId: string): DeptStats {
  const row = db.prepare(`
    SELECT
      ? as departmentId,
      COUNT(*) as totalAgents,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeAgents,
      SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busyAgents
    FROM agents WHERE department_id = ?
  `).get(departmentId, departmentId) as { departmentId: string; totalAgents: number; activeAgents: number; busyAgents: number };

  const taskRow = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as runningTasks,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queuedTasks
    FROM tasks WHERE department_id = ?
  `).get(departmentId) as { runningTasks: number; queuedTasks: number };

  return {
    departmentId,
    totalAgents: row.totalAgents ?? 0,
    activeAgents: row.activeAgents ?? 0,
    busyAgents: row.busyAgents ?? 0,
    runningTasks: taskRow.runningTasks ?? 0,
    queuedTasks: taskRow.queuedTasks ?? 0,
  };
}
