import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { addMemory, getMemories, searchMemories, deleteMemory } from '../db/queries/memories.js';

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  // Get memories for an agent
  app.get<{ Params: { agentId: string }; Querystring: { limit?: string } }>(
    '/api/agents/:agentId/memories', async (request) => {
      return getMemories(getDb(), request.params.agentId, parseInt(request.query.limit || '20'));
    });

  // Add a memory
  app.post<{ Params: { agentId: string }; Body: { content: string; tags?: string[]; type?: string } }>(
    '/api/agents/:agentId/memories', async (request) => {
      return addMemory(getDb(), request.params.agentId, request.body.content, request.body.tags, request.body.type);
    });

  // Search memories
  app.get<{ Querystring: { q: string; agent?: string } }>(
    '/api/memories/search', async (request) => {
      return searchMemories(getDb(), request.query.q, request.query.agent);
    });

  // Delete a memory
  app.delete<{ Params: { id: string } }>(
    '/api/memories/:id', async (request) => {
      deleteMemory(getDb(), request.params.id);
      return { ok: true };
    });
}
