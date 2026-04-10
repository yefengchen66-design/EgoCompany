/**
 * Task execution message log — adapted from Multica's task_message table.
 * Records each step of agent execution (tool calls, outputs, progress).
 */
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export type TaskMsgType = 'text' | 'tool_call' | 'tool_result' | 'progress' | 'error';

export interface TaskMessage {
  id: string;
  taskId: string;
  seq: number;
  type: TaskMsgType;
  tool: string | null;
  content: string | null;
  input: string | null;
  output: string | null;
  createdAt: string;
}

interface TaskMessageRow {
  id: string;
  task_id: string;
  seq: number;
  type: string;
  tool: string | null;
  content: string | null;
  input: string | null;
  output: string | null;
  created_at: string;
}

function rowToMsg(row: TaskMessageRow): TaskMessage {
  return {
    id: row.id, taskId: row.task_id, seq: row.seq,
    type: row.type as TaskMsgType, tool: row.tool,
    content: row.content, input: row.input, output: row.output,
    createdAt: row.created_at,
  };
}

export function addTaskMessage(db: Database.Database, taskId: string, type: TaskMsgType, opts?: {
  tool?: string; content?: string; input?: string; output?: string;
}): TaskMessage {
  const id = nanoid(12);
  // Get next sequence number
  const maxSeq = db.prepare('SELECT COALESCE(MAX(seq), 0) as max_seq FROM task_messages WHERE task_id = ?').get(taskId) as { max_seq: number };
  const seq = maxSeq.max_seq + 1;
  db.prepare(
    'INSERT INTO task_messages (id, task_id, seq, type, tool, content, input, output) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, taskId, seq, type, opts?.tool || null, opts?.content || null, opts?.input || null, opts?.output || null);
  return { id, taskId, seq, type, tool: opts?.tool || null, content: opts?.content || null, input: opts?.input || null, output: opts?.output || null, createdAt: new Date().toISOString() };
}

export function getTaskMessages(db: Database.Database, taskId: string): TaskMessage[] {
  return (db.prepare('SELECT * FROM task_messages WHERE task_id = ? ORDER BY seq ASC').all(taskId) as TaskMessageRow[]).map(rowToMsg);
}
