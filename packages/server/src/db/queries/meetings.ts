import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export interface Meeting {
  id: string;
  title: string;
  topic: string;
  participantIds: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  messages: MeetingMessage[];
  summary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MeetingMessage {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: string;
}

interface MeetingRow {
  id: string; title: string; topic: string; participant_ids: string;
  status: string; messages: string; summary: string | null;
  created_at: string; completed_at: string | null;
}

function rowToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id, title: row.title, topic: row.topic,
    participantIds: JSON.parse(row.participant_ids),
    status: row.status as Meeting['status'],
    messages: JSON.parse(row.messages),
    summary: row.summary,
    createdAt: row.created_at, completedAt: row.completed_at,
  };
}

export function createMeeting(db: Database.Database, title: string, topic: string, participantIds: string[]): Meeting {
  const id = nanoid(12);
  db.prepare('INSERT INTO meetings (id, title, topic, participant_ids) VALUES (?, ?, ?, ?)').run(id, title, topic, JSON.stringify(participantIds));
  return getMeetingById(db, id)!;
}

export function getMeetingById(db: Database.Database, id: string): Meeting | undefined {
  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
  return row ? rowToMeeting(row) : undefined;
}

export function getAllMeetings(db: Database.Database): Meeting[] {
  return (db.prepare('SELECT * FROM meetings ORDER BY created_at DESC').all() as MeetingRow[]).map(rowToMeeting);
}

export function updateMeeting(db: Database.Database, id: string, updates: {
  status?: string; messages?: MeetingMessage[]; summary?: string; completedAt?: string;
}): void {
  const parts: string[] = [];
  const params: any[] = [];
  if (updates.status) { parts.push('status = ?'); params.push(updates.status); }
  if (updates.messages) { parts.push('messages = ?'); params.push(JSON.stringify(updates.messages)); }
  if (updates.summary !== undefined) { parts.push('summary = ?'); params.push(updates.summary); }
  if (updates.completedAt) { parts.push('completed_at = ?'); params.push(updates.completedAt); }
  if (parts.length === 0) return;
  params.push(id);
  db.prepare(`UPDATE meetings SET ${parts.join(', ')} WHERE id = ?`).run(...params);
}
