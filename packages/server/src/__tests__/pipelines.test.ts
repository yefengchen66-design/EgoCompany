import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { createPipelineRun, getPipelineRunById, getAllPipelineRuns, updatePipelineRun } from '../db/queries/pipelines.js';

describe('Pipeline Queries', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); initializeSchema(db); });
  afterEach(() => { db.close(); });

  it('creates and retrieves a pipeline run', () => {
    const run = createPipelineRun(db, 'landing-page', '落地页开发', [
      { name: 'design', displayName: '设计', status: 'pending', taskIds: [], startedAt: null, completedAt: null },
    ]);
    expect(run.id).toBeTruthy();
    expect(run.pipelineId).toBe('landing-page');
    expect(run.status).toBe('pending');
    expect(run.stages).toHaveLength(1);
  });

  it('lists all pipeline runs', () => {
    createPipelineRun(db, 'a', 'A', []);
    createPipelineRun(db, 'b', 'B', []);
    const runs = getAllPipelineRuns(db);
    expect(runs).toHaveLength(2);
  });

  it('updates pipeline run status and stages', () => {
    const run = createPipelineRun(db, 'test', 'Test', [
      { name: 's1', displayName: 'S1', status: 'pending', taskIds: [], startedAt: null, completedAt: null },
    ]);
    updatePipelineRun(db, run.id, {
      status: 'running',
      stages: [{ name: 's1', displayName: 'S1', status: 'running', taskIds: ['t1'], startedAt: new Date().toISOString(), completedAt: null }],
    });
    const updated = getPipelineRunById(db, run.id)!;
    expect(updated.status).toBe('running');
    expect(updated.stages[0].status).toBe('running');
    expect(updated.stages[0].taskIds).toEqual(['t1']);
  });
});
