import type { FastifyInstance } from 'fastify';
import type { CreateTaskInput } from '@ai-company/shared';
import { getDb } from '../db/connection.js';
import { createTask, getAllTasks, getTaskById, updateTaskStatus } from '../db/queries/tasks.js';
import { getAgentById, setAgentActive } from '../db/queries/agents.js';
import { getReviewsForTask } from '../db/queries/task-reviews.js';
import { getTaskUsage } from '../db/queries/task-usage.js';
import { eventBus } from '../services/event-bus.js';
import type { TaskEngine } from '../services/task-engine.js';

export function createTaskRoutes(taskEngine: TaskEngine) {
  return async function taskRoutes(app: FastifyInstance) {
    app.get<{ Querystring: { status?: string; department?: string; assigned_to?: string } }>(
      '/api/tasks', async (request) => {
        return getAllTasks(getDb(), {
          status: request.query.status,
          departmentId: request.query.department,
          assignedTo: request.query.assigned_to,
        });
      });

    app.post<{ Body: CreateTaskInput & { autoStart?: boolean } }>('/api/tasks', async (request, reply) => {
      try {
        const task = await taskEngine.submitTask(request.body);
        eventBus.emitServerEvent({ type: 'task:update', data: { task } });
        return task;
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    });

    app.patch<{ Params: { id: string }; Body: { status?: string; output?: string } }>(
      '/api/tasks/:id', async (request, reply) => {
        const db = getDb();
        const task = getTaskById(db, request.params.id);
        if (!task) return reply.code(404).send({ error: 'Task not found' });
        if (request.body.status) updateTaskStatus(db, task.id, request.body.status, request.body.output);
        const updated = getTaskById(db, task.id)!;
        eventBus.emitServerEvent({ type: 'task:update', data: { task: updated } });
        return updated;
      });

    app.post<{ Params: { id: string } }>('/api/tasks/:id/cancel', async (request, reply) => {
      const db = getDb();
      const task = getTaskById(db, request.params.id);
      if (!task) return reply.code(404).send({ error: 'Task not found' });
      updateTaskStatus(db, task.id, 'cancelled');
      const updated = getTaskById(db, task.id)!;
      eventBus.emitServerEvent({ type: 'task:update', data: { task: updated } });
      return updated;
    });

    app.post<{ Params: { id: string } }>('/api/tasks/:id/execute', async (request, reply) => {
      try {
        const sessionId = await taskEngine.executeTask(request.params.id);
        return { sessionId };
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    });

    // POST /api/tasks/:id/retry — retry a failed/cancelled task (resets status, re-executes)
    app.post<{ Params: { id: string } }>('/api/tasks/:id/retry', async (request, reply) => {
      const db = getDb();
      const task = getTaskById(db, request.params.id);
      if (!task) return reply.code(404).send({ error: 'Task not found' });
      if (!['failed', 'cancelled'].includes(task.status)) {
        return reply.code(400).send({ error: 'Can only retry failed or cancelled tasks' });
      }
      // Reset to queued, then execute
      updateTaskStatus(db, task.id, 'queued');
      try {
        const sessionId = await taskEngine.executeTask(task.id);
        return { sessionId, status: 'retrying' };
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    });

    // POST /api/tasks/:id/redispatch — re-run a department task through the full delegation flow
    app.post<{ Params: { id: string } }>('/api/tasks/:id/redispatch', async (request, reply) => {
      const db = getDb();
      const task = getTaskById(db, request.params.id);
      if (!task) return reply.code(404).send({ error: 'Task not found' });
      if (!task.departmentId) return reply.code(400).send({ error: 'Not a department task' });
      try {
        // Mark old one as cancelled
        if (['running', 'queued'].includes(task.status)) {
          updateTaskStatus(db, task.id, 'cancelled');
        }
        // Create fresh department task
        const result = await taskEngine.submitDepartmentTask(task.departmentId, task.input, task.title);
        return result;
      } catch (err: any) {
        return reply.code(400).send({ error: err.message });
      }
    });

    // GET /api/tasks/:id/tree — full task tree with subtasks, reviews, usage
    app.get<{ Params: { id: string } }>('/api/tasks/:id/tree', async (request, reply) => {
      const db = getDb();
      const task = getTaskById(db, request.params.id);
      if (!task) return reply.code(404).send({ error: 'Task not found' });

      // Get subtasks
      const subtasks = getAllTasks(db, { parentTaskId: task.id }).map(sub => {
        let resultPreview = sub.output || '';
        try { const p = JSON.parse(resultPreview); resultPreview = p.result || resultPreview; } catch {}
        const agent = getAgentById(db, sub.assignedTo!);
        return {
          ...sub,
          resultPreview: resultPreview.substring(0, 500),
          agentName: agent?.name || sub.assignedTo,
          usage: getTaskUsage(db, sub.id),
        };
      });

      // Get reviews
      const reviews = getReviewsForTask(db, task.id);

      // Parse parent result
      let parentResult = task.output || '';
      try { const p = JSON.parse(parentResult); parentResult = p.result || parentResult; } catch {}

      const director = getAgentById(db, task.assignedTo!);

      return {
        ...task,
        resultPreview: parentResult.substring(0, 1000),
        directorName: director?.name || task.assignedTo,
        subtasks,
        reviews,
        usage: getTaskUsage(db, task.id),
        summary: reviews.length > 0 ? reviews[reviews.length - 1].summary : null,
      };
    });

    // POST /api/tasks/department — director delegation flow
    app.post<{ Body: { departmentId: string; instruction: string; title?: string } }>(
      '/api/tasks/department', async (request, reply) => {
        try {
          const { departmentId, instruction, title } = request.body;
          if (!departmentId || !instruction) {
            return reply.code(400).send({ error: 'departmentId and instruction required' });
          }
          const result = await taskEngine.submitDepartmentTask(departmentId, instruction, title);
          return result;
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });

    // POST /api/tasks/batch — create and execute multiple tasks in parallel
    app.post<{ Body: { tasks: Array<{ title: string; input: string; assignedTo: string; departmentId?: string }> } }>(
      '/api/tasks/batch', async (request, reply) => {
        try {
          const results = [];
          for (const t of request.body.tasks) {
            // Auto-activate agent
            const agent = getAgentById(getDb(), t.assignedTo);
            if (agent && !agent.isActive) {
              setAgentActive(getDb(), t.assignedTo, true);
            }
            const task = await taskEngine.submitTask({ ...t, autoStart: true });
            results.push(task);
          }
          return { tasks: results, count: results.length };
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });
  };
}
