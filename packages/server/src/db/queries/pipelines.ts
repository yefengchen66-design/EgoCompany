import type Database from 'better-sqlite3';
import type { PipelineRun, PipelineRunStage } from '@ai-company/shared';
import { nanoid } from 'nanoid';

interface PipelineRunRow {
  id: string; pipeline_id: string; pipeline_name: string;
  status: string; stages: string; context: string;
  created_at: string; completed_at: string | null;
}

function rowToRun(row: PipelineRunRow): PipelineRun {
  return {
    id: row.id, pipelineId: row.pipeline_id, pipelineName: row.pipeline_name,
    status: row.status as PipelineRun['status'],
    stages: JSON.parse(row.stages),
    context: JSON.parse(row.context),
    createdAt: row.created_at, completedAt: row.completed_at,
  };
}

export function createPipelineRun(db: Database.Database, pipelineId: string, pipelineName: string, stages: PipelineRunStage[]): PipelineRun {
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO pipeline_runs (id, pipeline_id, pipeline_name, stages)
    VALUES (?, ?, ?, ?)
  `).run(id, pipelineId, pipelineName, JSON.stringify(stages));
  return getPipelineRunById(db, id)!;
}

export function getPipelineRunById(db: Database.Database, id: string): PipelineRun | undefined {
  const row = db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(id) as PipelineRunRow | undefined;
  return row ? rowToRun(row) : undefined;
}

export function getAllPipelineRuns(db: Database.Database): PipelineRun[] {
  return (db.prepare('SELECT * FROM pipeline_runs ORDER BY created_at DESC').all() as PipelineRunRow[]).map(rowToRun);
}

export function updatePipelineRun(db: Database.Database, id: string, updates: {
  status?: string; stages?: PipelineRunStage[]; context?: Record<string, string>; completedAt?: string;
}): void {
  const parts: string[] = [];
  const params: any[] = [];
  if (updates.status) { parts.push('status = ?'); params.push(updates.status); }
  if (updates.stages) { parts.push('stages = ?'); params.push(JSON.stringify(updates.stages)); }
  if (updates.context) { parts.push('context = ?'); params.push(JSON.stringify(updates.context)); }
  if (updates.completedAt) { parts.push('completed_at = ?'); params.push(updates.completedAt); }
  if (parts.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE pipeline_runs SET ${parts.join(', ')} WHERE id = ?`).run(...params);
}
