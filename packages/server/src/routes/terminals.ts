import type { FastifyInstance } from 'fastify';
import type { TerminalManager } from '../services/terminal-manager.js';

export function createTerminalRoutes(terminalManager: TerminalManager) {
  return async function terminalRoutes(app: FastifyInstance) {
    app.get('/api/terminals', async () => terminalManager.getActiveSessions());

    app.post<{ Params: { id: string }; Body: { input: string } }>(
      '/api/terminals/:id/input', async (request, reply) => {
        const ok = terminalManager.sendInput(request.params.id, request.body.input);
        if (!ok) return reply.code(404).send({ error: 'Session not found' });
        return { ok: true };
      });

    app.post<{ Params: { id: string } }>(
      '/api/terminals/:id/kill', async (request, reply) => {
        const ok = terminalManager.killSession(request.params.id);
        if (!ok) return reply.code(404).send({ error: 'Session not found' });
        return { ok: true };
      });
  };
}
