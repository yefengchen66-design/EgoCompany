import type Database from 'better-sqlite3';
import type { PipelineDefinition, PipelineStage, PipelineRun, PipelineRunStage } from '@ai-company/shared';
import { createPipelineRun, getPipelineRunById, updatePipelineRun } from '../db/queries/pipelines.js';
import { createTask, getTasksByPipelineRun } from '../db/queries/tasks.js';
import { getAllAgents } from '../db/queries/agents.js';
import { eventBus } from './event-bus.js';
import type { TaskEngine } from './task-engine.js';

export class PipelineExecutor {
  constructor(
    private db: Database.Database,
    private taskEngine: TaskEngine,
  ) {}

  /** Start a pipeline run */
  async startPipeline(definition: PipelineDefinition, workingDir?: string): Promise<PipelineRun> {
    // Create run stages from definition
    const runStages: PipelineRunStage[] = definition.stages.map(s => ({
      name: s.name,
      displayName: s.displayName,
      status: 'pending',
      taskIds: [],
      startedAt: null,
      completedAt: null,
    }));

    const run = createPipelineRun(this.db, definition.id, definition.name, runStages);

    // Update to running
    updatePipelineRun(this.db, run.id, { status: 'running' });

    // Start execution (non-blocking)
    this.executePipeline(run.id, definition, workingDir).catch(err => {
      console.error(`Pipeline ${run.id} failed:`, err);
      updatePipelineRun(this.db, run.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
    });

    return getPipelineRunById(this.db, run.id)!;
  }

  private async executePipeline(runId: string, definition: PipelineDefinition, workingDir?: string): Promise<void> {
    const completedStages = new Set<string>();
    const stageOutputs = new Map<string, string>(); // stage name -> combined output

    for (const stage of definition.stages) {
      // Check dependencies
      for (const dep of stage.dependsOn) {
        if (!completedStages.has(dep)) {
          // Wait for dependency (poll)
          await this.waitForStages(runId, [dep], completedStages, stageOutputs);
        }
      }

      // Build context from previous stages
      let context = '';
      for (const ctxStage of stage.contextFrom) {
        const output = stageOutputs.get(ctxStage);
        if (output) {
          context += `\n\n--- Context from "${ctxStage}" ---\n${output}`;
        }
      }

      // Execute stage
      await this.executeStage(runId, stage, context, definition, workingDir);

      // Wait for this stage to complete
      await this.waitForStages(runId, [stage.name], completedStages, stageOutputs);
    }

    // All stages done
    updatePipelineRun(this.db, runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    eventBus.emitServerEvent({
      type: 'pipeline:progress',
      data: { pipelineId: runId, stage: 'all', status: 'completed' },
    });
  }

  private async executeStage(
    runId: string,
    stage: PipelineStage,
    context: string,
    definition: PipelineDefinition,
    workingDir?: string,
  ): Promise<void> {
    // Update stage status to running
    const run = getPipelineRunById(this.db, runId)!;
    const stageIndex = run.stages.findIndex(s => s.name === stage.name);
    if (stageIndex === -1) return;

    run.stages[stageIndex].status = 'running';
    run.stages[stageIndex].startedAt = new Date().toISOString();
    updatePipelineRun(this.db, runId, { stages: run.stages });

    eventBus.emitServerEvent({
      type: 'pipeline:progress',
      data: { pipelineId: runId, stage: stage.name, status: 'running' },
    });

    // Create tasks for each stage task
    const taskIds: string[] = [];

    for (const stageTask of stage.tasks) {
      // Find director of the department
      const deptAgents = getAllAgents(this.db, { departmentId: stageTask.department, role: 'director' });
      const director = deptAgents[0];

      const assignTo = stageTask.assignTo || (director ? director.id : undefined);

      const instruction = context
        ? `${stageTask.instruction}\n\n${context}`
        : stageTask.instruction;

      const task = createTask(this.db, {
        title: `[${definition.name}] ${stage.displayName} - ${stageTask.department}`,
        input: instruction,
        departmentId: stageTask.department,
        assignedTo: assignTo,
        assignedBy: 'pipeline',
        pipelineId: runId,
        stageName: stage.name,
        workingDir: workingDir,
      });

      taskIds.push(task.id);

      // Try to execute if agent is assigned
      if (assignTo) {
        try {
          await this.taskEngine.executeTask(task.id);
        } catch (err) {
          console.warn(`Could not auto-execute task ${task.id}:`, (err as Error).message);
          // Task stays queued for manual execution
        }
      }
    }

    // Update stage with task IDs
    const updatedRun = getPipelineRunById(this.db, runId)!;
    const idx = updatedRun.stages.findIndex(s => s.name === stage.name);
    updatedRun.stages[idx].taskIds = taskIds;
    updatePipelineRun(this.db, runId, { stages: updatedRun.stages });
  }

  private async waitForStages(
    runId: string,
    stageNames: string[],
    completedStages: Set<string>,
    stageOutputs: Map<string, string>,
  ): Promise<void> {
    const maxWait = 600_000; // 10 minutes max
    const pollInterval = 3000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const run = getPipelineRunById(this.db, runId)!;
      let allDone = true;

      for (const name of stageNames) {
        const stage = run.stages.find(s => s.name === name);
        if (!stage) continue;

        if (stage.status === 'completed') {
          completedStages.add(name);
          // Collect outputs from stage tasks
          const tasks = getTasksByPipelineRun(this.db, runId)
            .filter(t => t.stageName === name && t.output);
          const combinedOutput = tasks.map(t => t.output).join('\n\n');
          stageOutputs.set(name, combinedOutput);
        } else if (stage.status === 'failed') {
          throw new Error(`Stage "${name}" failed`);
        } else {
          // Check if all tasks in this stage are done
          const stageTasks = getTasksByPipelineRun(this.db, runId)
            .filter(t => t.stageName === name);

          if (stageTasks.length > 0 && stageTasks.every(t => t.status === 'completed')) {
            // Mark stage completed
            const stageIdx = run.stages.findIndex(s => s.name === name);
            run.stages[stageIdx].status = 'completed';
            run.stages[stageIdx].completedAt = new Date().toISOString();
            updatePipelineRun(this.db, runId, { stages: run.stages });
            completedStages.add(name);

            const output = stageTasks.map(t => t.output).filter(Boolean).join('\n\n');
            stageOutputs.set(name, output);

            eventBus.emitServerEvent({
              type: 'pipeline:progress',
              data: { pipelineId: runId, stage: name, status: 'completed' },
            });
          } else if (stageTasks.some(t => t.status === 'failed')) {
            const stageIdx = run.stages.findIndex(s => s.name === name);
            run.stages[stageIdx].status = 'failed';
            updatePipelineRun(this.db, runId, { stages: run.stages });
            throw new Error(`Stage "${name}" has failed tasks`);
          } else {
            allDone = false;
          }
        }
      }

      if (allDone) return;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Pipeline stage timeout');
  }

  /** Get current pipeline run status */
  getRunStatus(runId: string): PipelineRun | undefined {
    return getPipelineRunById(this.db, runId);
  }
}
