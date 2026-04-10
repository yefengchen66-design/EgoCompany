import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export interface TaskReview {
  id: string;
  parentTaskId: string;
  reviewerId: string;
  round: number;
  verdict: 'approved' | 'revision_needed' | 'follow_up';
  summary: string | null;
  revisions: Array<{ taskId: string; instruction: string }>;
  createdAt: string;
}

interface TaskReviewRow {
  id: string;
  parent_task_id: string;
  reviewer_id: string;
  round: number;
  verdict: string;
  summary: string | null;
  revisions: string;
  created_at: string;
}

function rowToReview(row: TaskReviewRow): TaskReview {
  return {
    id: row.id,
    parentTaskId: row.parent_task_id,
    reviewerId: row.reviewer_id,
    round: row.round,
    verdict: row.verdict as TaskReview['verdict'],
    summary: row.summary,
    revisions: JSON.parse(row.revisions),
    createdAt: row.created_at,
  };
}

export function insertTaskReview(db: Database.Database, review: {
  parentTaskId: string;
  reviewerId: string;
  round: number;
  verdict: TaskReview['verdict'];
  summary?: string;
  revisions?: Array<{ taskId: string; instruction: string }>;
}): TaskReview {
  const id = nanoid(12);
  db.prepare(
    'INSERT INTO task_reviews (id, parent_task_id, reviewer_id, round, verdict, summary, revisions) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, review.parentTaskId, review.reviewerId, review.round, review.verdict, review.summary || null, JSON.stringify(review.revisions || []));
  return {
    id, parentTaskId: review.parentTaskId, reviewerId: review.reviewerId,
    round: review.round, verdict: review.verdict, summary: review.summary || null,
    revisions: review.revisions || [], createdAt: new Date().toISOString(),
  };
}

export function getReviewsForTask(db: Database.Database, parentTaskId: string): TaskReview[] {
  const rows = db.prepare(
    'SELECT * FROM task_reviews WHERE parent_task_id = ? ORDER BY round ASC'
  ).all(parentTaskId) as TaskReviewRow[];
  return rows.map(rowToReview);
}

export function getLatestReview(db: Database.Database, parentTaskId: string): TaskReview | undefined {
  const row = db.prepare(
    'SELECT * FROM task_reviews WHERE parent_task_id = ? ORDER BY round DESC LIMIT 1'
  ).get(parentTaskId) as TaskReviewRow | undefined;
  return row ? rowToReview(row) : undefined;
}
