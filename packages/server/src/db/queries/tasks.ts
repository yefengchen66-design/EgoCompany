import type Database from 'better-sqlite3';
import type { Task, CreateTaskInput } from '@ai-company/shared';
import { nanoid } from 'nanoid';

interface TaskRow {
  id: string; title: string; description: string | null;
  department_id: string | null; assigned_to: string | null;
  assigned_by: string | null; parent_task_id: string | null;
  pipeline_id: string | null; stage_name: string | null;
  runtime: string | null; status: string; priority: number;
  input: string; output: string | null; working_dir: string | null;
  session_id: string | null;
  started_at: string | null; completed_at: string | null; created_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id, title: row.title, description: row.description,
    departmentId: row.department_id, assignedTo: row.assigned_to,
    assignedBy: row.assigned_by, parentTaskId: row.parent_task_id,
    pipelineId: row.pipeline_id, stageName: row.stage_name,
    runtime: row.runtime, status: row.status as Task['status'],
    priority: row.priority, input: row.input, output: row.output,
    workingDir: row.working_dir, sessionId: row.session_id,
    startedAt: row.started_at,
    completedAt: row.completed_at, createdAt: row.created_at,
  };
}

export function createTask(db: Database.Database, input: CreateTaskInput & {
  pipelineId?: string; stageName?: string; parentTaskId?: string; assignedBy?: string;
}): Task {
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO tasks (id, title, description, department_id, assigned_to, assigned_by, parent_task_id, pipeline_id, stage_name, runtime, priority, input, working_dir)
    VALUES (@id, @title, @description, @departmentId, @assignedTo, @assignedBy, @parentTaskId, @pipelineId, @stageName, @runtime, @priority, @input, @workingDir)
  `).run({
    id, title: input.title, description: input.description ?? null,
    departmentId: input.departmentId ?? null, assignedTo: input.assignedTo ?? null,
    assignedBy: input.assignedBy ?? null, parentTaskId: input.parentTaskId ?? null,
    pipelineId: input.pipelineId ?? null, stageName: input.stageName ?? null,
    runtime: input.runtime ?? null, priority: input.priority ?? 0,
    input: input.input, workingDir: input.workingDir ?? null,
  });
  return getTaskById(db, id)!;
}

export function getTaskById(db: Database.Database, id: string): Task | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : undefined;
}

export function getAllTasks(db: Database.Database, filters?: {
  status?: string; departmentId?: string; assignedTo?: string; parentTaskId?: string;
}): Task[] {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: Record<string, string> = {};
  if (filters?.status) { sql += ' AND status = @status'; params.status = filters.status; }
  if (filters?.departmentId) { sql += ' AND department_id = @departmentId'; params.departmentId = filters.departmentId; }
  if (filters?.assignedTo) { sql += ' AND assigned_to = @assignedTo'; params.assignedTo = filters.assignedTo; }
  if (filters?.parentTaskId) { sql += ' AND parent_task_id = @parentTaskId'; params.parentTaskId = filters.parentTaskId; }
  sql += ' ORDER BY priority DESC, created_at ASC';
  return (db.prepare(sql).all(params) as TaskRow[]).map(rowToTask);
}

export function updateTaskStatus(db: Database.Database, id: string, status: string, output?: string): void {
  const now = new Date().toISOString();
  if (status === 'running') {
    db.prepare('UPDATE tasks SET status = ?, started_at = ? WHERE id = ?').run(status, now, id);
  } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    db.prepare('UPDATE tasks SET status = ?, output = ?, completed_at = ? WHERE id = ?').run(status, output ?? null, now, id);
  } else {
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
  }
}

export function getTasksByPipelineRun(db: Database.Database, pipelineId: string): Task[] {
  return (db.prepare('SELECT * FROM tasks WHERE pipeline_id = ? ORDER BY created_at ASC').all(pipelineId) as TaskRow[]).map(rowToTask);
}
