/**
 * Token usage tracking per task — adapted from Multica's task_usage table.
 * Tracks per-model token consumption for cost monitoring.
 */
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export interface TaskUsage {
  id: string;
  taskId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  createdAt: string;
}

interface TaskUsageRow {
  id: string;
  task_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  created_at: string;
}

function rowToUsage(row: TaskUsageRow): TaskUsage {
  return {
    id: row.id, taskId: row.task_id, provider: row.provider, model: row.model,
    inputTokens: row.input_tokens, outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens, cacheWriteTokens: row.cache_write_tokens,
    createdAt: row.created_at,
  };
}

/** Upsert usage (same as Multica: UNIQUE on task_id, provider, model) */
export function upsertTaskUsage(db: Database.Database, taskId: string, usage: {
  provider: string; model: string; inputTokens: number; outputTokens: number;
  cacheReadTokens?: number; cacheWriteTokens?: number;
}): void {
  const existing = db.prepare(
    'SELECT id FROM task_usage WHERE task_id = ? AND provider = ? AND model = ?'
  ).get(taskId, usage.provider, usage.model) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE task_usage SET
        input_tokens = input_tokens + ?, output_tokens = output_tokens + ?,
        cache_read_tokens = cache_read_tokens + ?, cache_write_tokens = cache_write_tokens + ?
      WHERE id = ?`
    ).run(usage.inputTokens, usage.outputTokens, usage.cacheReadTokens || 0, usage.cacheWriteTokens || 0, existing.id);
  } else {
    db.prepare(
      'INSERT INTO task_usage (id, task_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(nanoid(12), taskId, usage.provider, usage.model, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens || 0, usage.cacheWriteTokens || 0);
  }
}

export function getTaskUsage(db: Database.Database, taskId: string): TaskUsage[] {
  return (db.prepare('SELECT * FROM task_usage WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as TaskUsageRow[]).map(rowToUsage);
}

/** Aggregate usage across all tasks (for dashboard) */
export function getTotalUsage(db: Database.Database): { totalInputTokens: number; totalOutputTokens: number; totalTasks: number } {
  const row = db.prepare(
    'SELECT COALESCE(SUM(input_tokens),0) as ti, COALESCE(SUM(output_tokens),0) as to_, COUNT(DISTINCT task_id) as tc FROM task_usage'
  ).get() as { ti: number; to_: number; tc: number };
  return { totalInputTokens: row.ti, totalOutputTokens: row.to_, totalTasks: row.tc };
}
