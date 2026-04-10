import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { getRecentDeptMessages, getTaskThread, getMentionsFor } from '../db/queries/dept-messages.js';
import { getReviewsForTask } from '../db/queries/task-reviews.js';
import { getTaskMessages } from '../db/queries/task-messages.js';
import { getTaskUsage } from '../db/queries/task-usage.js';

export async function deptMessageRoutes(app: FastifyInstance): Promise<void> {
  // Get recent messages for a department
  app.get<{ Params: { deptId: string }; Querystring: { limit?: string } }>(
    '/api/departments/:deptId/messages', async (request) => {
      const limit = parseInt(request.query.limit || '30', 10);
      return getRecentDeptMessages(getDb(), request.params.deptId, limit);
    });

  // Get message thread for a parent task
  app.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/thread', async (request) => {
      return getTaskThread(getDb(), request.params.taskId);
    });

  // Get mentions for an agent
  app.get<{ Params: { agentId: string } }>(
    '/api/agents/:agentId/mentions', async (request) => {
      return getMentionsFor(getDb(), request.params.agentId);
    });

  // Get reviews for a parent task
  app.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/reviews', async (request) => {
      return getReviewsForTask(getDb(), request.params.taskId);
    });

  // Get execution messages for a task (adapted from Multica task_message)
  app.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/messages', async (request) => {
      return getTaskMessages(getDb(), request.params.taskId);
    });

  // Get token usage for a task (adapted from Multica task_usage)
  app.get<{ Params: { taskId: string } }>(
    '/api/tasks/:taskId/usage', async (request) => {
      return getTaskUsage(getDb(), request.params.taskId);
    });
}
