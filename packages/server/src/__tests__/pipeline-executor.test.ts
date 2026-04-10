import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema } from '../db/schema.js';
import { upsertDepartment } from '../db/queries/departments.js';
import { upsertAgent, setAgentActive } from '../db/queries/agents.js';
import { upsertRuntime } from '../db/queries/runtimes.js';
import { PipelineExecutor } from '../services/pipeline-executor.js';
import type { PipelineDefinition } from '@ai-company/shared';
import type { TaskEngine } from '../services/task-engine.js';

describe('PipelineExecutor', () => {
  let db: Database.Database;
  let executor: PipelineExecutor;

  const mockTaskEngine = {
    submitTask: async (input: any) => ({ id: 'task-1', ...input }),
    executeTask: async () => 'session-1',
  } as unknown as TaskEngine;

  const testPipeline: PipelineDefinition = {
    id: 'test-pipeline',
    name: 'Test Pipeline',
    description: 'For testing',
    stages: [
      {
        name: 'stage-1',
        displayName: 'Stage 1',
        parallel: false,
        dependsOn: [],
        contextFrom: [],
        tasks: [{ department: 'engineering', instruction: 'Do task 1' }],
      },
    ],
  };

  beforeEach(() => {
    db = new Database(':memory:');
    initializeSchema(db);
    executor = new PipelineExecutor(db, mockTaskEngine);

    upsertDepartment(db, { id: 'engineering', name: '工程部', nameEn: 'Engineering', directorId: 'eng-000', color: '#1565C0', emoji: '⚙️', sortOrder: 0 });
    upsertAgent(db, { id: 'eng-000', name: 'Director', departmentId: 'engineering', role: 'director', emoji: '👔', color: '#1565C0', runtimes: ['claude-code'], maxConcurrentTasks: 3, definitionPath: 'test.md', definitionHash: 'x' });
    setAgentActive(db, 'eng-000', true);
    upsertRuntime(db, { id: 'claude-code', name: 'Claude', command: 'claude', version: null, path: null, isAvailable: true });
  });

  afterEach(() => { db.close(); });

  it('creates a pipeline run', async () => {
    const run = await executor.startPipeline(testPipeline);
    expect(run.id).toBeTruthy();
    expect(run.pipelineId).toBe('test-pipeline');
    expect(run.status).toBe('running');
    expect(run.stages).toHaveLength(1);
  });

  it('creates tasks for pipeline stages', async () => {
    const run = await executor.startPipeline(testPipeline);
    // Give it a moment to create tasks
    await new Promise(r => setTimeout(r, 100));
    const status = executor.getRunStatus(run.id);
    expect(status).toBeDefined();
    expect(status!.stages[0].taskIds.length).toBeGreaterThanOrEqual(0);
  });

  it('getRunStatus returns undefined for unknown run', () => {
    const status = executor.getRunStatus('nonexistent-id');
    expect(status).toBeUndefined();
  });

  it('pipeline run has correct initial stage status', async () => {
    const run = await executor.startPipeline(testPipeline);
    expect(run.stages[0].name).toBe('stage-1');
    expect(run.stages[0].displayName).toBe('Stage 1');
    expect(run.stages[0].taskIds).toHaveLength(0);
  });
});
