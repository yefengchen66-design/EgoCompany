import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { createCrossDeptRequest, getAllCrossDeptRequests, getCrossDeptRequest, updateCrossDeptRequest } from '../db/queries/cross-dept.js';
import { insertDeptMessage } from '../db/queries/dept-messages.js';
import { eventBus } from '../services/event-bus.js';
import type { TaskEngine } from '../services/task-engine.js';

export function createCrossDeptRoutes(taskEngine: TaskEngine) {
  return async function crossDeptRoutes(app: FastifyInstance) {

    // List all cross-dept requests (optionally filter)
    app.get<{ Querystring: { from?: string; to?: string; status?: string } }>(
      '/api/cross-dept-requests', async (request) => {
        return getAllCrossDeptRequests(getDb(), {
          fromDeptId: request.query.from,
          toDeptId: request.query.to,
          status: request.query.status,
        });
      });

    // Get single request
    app.get<{ Params: { id: string } }>(
      '/api/cross-dept-requests/:id', async (request, reply) => {
        const req = getCrossDeptRequest(getDb(), request.params.id);
        if (!req) return reply.code(404).send({ error: 'Not found' });
        return req;
      });

    // Create a cross-dept request (any department director can request help from another)
    app.post<{ Body: { fromDeptId: string; toDeptId: string; fromAgentId: string; title: string; description: string; context?: string; sourceTaskId?: string } }>(
      '/api/cross-dept-requests', async (request, reply) => {
        const { fromDeptId, toDeptId, fromAgentId, title, description, context, sourceTaskId } = request.body;
        if (!fromDeptId || !toDeptId || !title || !description) {
          return reply.code(400).send({ error: 'fromDeptId, toDeptId, title, description required' });
        }
        if (fromDeptId === toDeptId) {
          return reply.code(400).send({ error: 'Cannot request from same department' });
        }

        const db = getDb();
        const req = createCrossDeptRequest(db, { fromDeptId, toDeptId, fromAgentId, title, description, context, sourceTaskId });

        // Post to both department boards
        insertDeptMessage(db, fromDeptId, fromAgentId, null, 'request',
          `[Cross-Dept Request → ${toDeptId}] ${title}: ${description.substring(0, 200)}`);
        insertDeptMessage(db, toDeptId, fromAgentId, null, 'request',
          `[Cross-Dept Request from ${fromDeptId}] ${title}: ${description.substring(0, 200)}`);
        eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId: fromDeptId } });
        eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId: toDeptId } });

        return req;
      });

    // Accept and execute: target department director receives the request and runs department delegation
    app.post<{ Params: { id: string } }>(
      '/api/cross-dept-requests/:id/accept', async (request, reply) => {
        const db = getDb();
        const req = getCrossDeptRequest(db, request.params.id);
        if (!req) return reply.code(404).send({ error: 'Not found' });
        if (req.status !== 'pending') return reply.code(400).send({ error: 'Already processed' });

        updateCrossDeptRequest(db, req.id, { status: 'accepted' });

        // Dispatch as department task to the target department
        const instruction = `Cross-department request from ${req.fromDeptId}:\n\nTitle: ${req.title}\nDescription: ${req.description}\n${req.context ? `\nContext:\n${req.context}` : ''}\n\nPlease analyze this request, delegate to your team members, and deliver the results.`;

        try {
          const result = await taskEngine.submitDepartmentTask(req.toDeptId, instruction, `[Cross-Dept] ${req.title}`);
          updateCrossDeptRequest(db, req.id, { resultTaskId: result.parentTask.id });

          insertDeptMessage(db, req.toDeptId, req.fromAgentId, result.parentTask.id, 'directive',
            `[Accepted] Cross-dept request: ${req.title}`);
          eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId: req.toDeptId } });

          return { ...req, status: 'accepted', resultTaskId: result.parentTask.id };
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });

    // Mark as completed with summary
    app.post<{ Params: { id: string }; Body: { summary?: string } }>(
      '/api/cross-dept-requests/:id/complete', async (request, reply) => {
        const db = getDb();
        const req = getCrossDeptRequest(db, request.params.id);
        if (!req) return reply.code(404).send({ error: 'Not found' });

        updateCrossDeptRequest(db, req.id, { status: 'completed', resultSummary: request.body?.summary });

        // Notify requesting department
        insertDeptMessage(db, req.fromDeptId, req.fromAgentId, null, 'result',
          `[Cross-Dept Complete from ${req.toDeptId}] ${req.title}: ${(request.body?.summary || 'Done').substring(0, 200)}`);
        eventBus.emitServerEvent({ type: 'dept:message', data: { departmentId: req.fromDeptId } });

        return getCrossDeptRequest(db, req.id);
      });

    // Reject
    app.post<{ Params: { id: string } }>(
      '/api/cross-dept-requests/:id/reject', async (request, reply) => {
        const db = getDb();
        const req = getCrossDeptRequest(db, request.params.id);
        if (!req) return reply.code(404).send({ error: 'Not found' });
        updateCrossDeptRequest(db, req.id, { status: 'rejected' });
        return getCrossDeptRequest(db, req.id);
      });
  };
}
