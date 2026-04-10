import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export type DeptMsgType = 'message' | 'result' | 'request' | 'mention' | 'directive';

export interface DeptMessage {
  id: string;
  departmentId: string;
  authorId: string;
  taskId: string | null;
  type: DeptMsgType;
  content: string;
  mentions: string[];
  createdAt: string;
}

interface DeptMessageRow {
  id: string;
  department_id: string;
  author_id: string;
  task_id: string | null;
  type: string;
  content: string;
  mentions: string;
  created_at: string;
}

function rowToMsg(row: DeptMessageRow): DeptMessage {
  return {
    id: row.id,
    departmentId: row.department_id,
    authorId: row.author_id,
    taskId: row.task_id,
    type: row.type as DeptMsgType,
    content: row.content,
    mentions: JSON.parse(row.mentions),
    createdAt: row.created_at,
  };
}

export function insertDeptMessage(
  db: Database.Database,
  deptId: string,
  authorId: string,
  taskId: string | null,
  type: DeptMsgType,
  content: string,
  mentions: string[] = [],
): DeptMessage {
  const id = nanoid(12);
  db.prepare(
    'INSERT INTO dept_messages (id, department_id, author_id, task_id, type, content, mentions) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, deptId, authorId, taskId, type, content, JSON.stringify(mentions));
  return { id, departmentId: deptId, authorId, taskId, type, content, mentions, createdAt: new Date().toISOString() };
}

export function getRecentDeptMessages(db: Database.Database, deptId: string, limit = 20): DeptMessage[] {
  const rows = db.prepare(
    'SELECT * FROM dept_messages WHERE department_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(deptId, limit) as DeptMessageRow[];
  return rows.reverse().map(rowToMsg);
}

export function getTaskThread(db: Database.Database, parentTaskId: string): DeptMessage[] {
  const rows = db.prepare(
    `SELECT dm.* FROM dept_messages dm
     INNER JOIN tasks t ON dm.task_id = t.id
     WHERE t.parent_task_id = ? OR dm.task_id = ?
     ORDER BY dm.created_at ASC`
  ).all(parentTaskId, parentTaskId) as DeptMessageRow[];
  return rows.map(rowToMsg);
}

export function getMentionsFor(db: Database.Database, agentId: string, limit = 20): DeptMessage[] {
  const rows = db.prepare(
    `SELECT * FROM dept_messages WHERE mentions LIKE ? ORDER BY created_at DESC LIMIT ?`
  ).all(`%"${agentId}"%`, limit) as DeptMessageRow[];
  return rows.reverse().map(rowToMsg);
}
