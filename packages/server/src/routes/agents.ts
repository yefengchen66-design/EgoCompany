import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { getAllAgents, getAgentById, setAgentActive } from '../db/queries/agents.js';
import { getAgentConfig, saveAgentConfig } from '../db/queries/agent-configs.js';
import { eventBus } from '../services/event-bus.js';
import type { AgentRegistry } from '../services/agent-registry.js';

export function createAgentRoutes(registry: AgentRegistry) {
  return async function agentRoutes(app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: { department?: string; status?: string; role?: string } }>(
      '/api/agents', async (request) => {
        const agents = getAllAgents(getDb(), {
          departmentId: request.query.department,
          status: request.query.status,
          role: request.query.role,
        });
        return agents.map(agent => {
          const def = registry.getDefinition(agent.id);
          return {
            ...agent,
            description: def?.description || null,
            vibe: def?.vibe || null,
          };
        });
      });

    // Agent detail — includes full definition (identity, coreMission, etc.)
    app.get<{ Params: { id: string } }>('/api/agents/:id', async (request, reply) => {
      const agent = getAgentById(getDb(), request.params.id);
      if (!agent) return reply.code(404).send({ error: 'Agent not found' });
      const def = registry.getDefinition(request.params.id);
      const config = getAgentConfig(getDb(), request.params.id);
      return {
        ...agent,
        description: def?.description || null,
        vibe: def?.vibe || null,
        identity: config?.customIdentity || def?.identity || null,
        coreMission: config?.customMission || def?.coreMission || null,
        workflow: config?.customWorkflow || def?.workflow || null,
        successMetrics: config?.customMetrics || def?.successMetrics || null,
        leadershipCapabilities: def?.leadershipCapabilities || null,
        delegationRules: def?.delegationRules || null,
        subordinates: def?.subordinates || null,
        preferredRuntime: config?.preferredRuntime || null,
        notes: config?.notes || null,
        defaultIdentity: def?.identity || null,
        defaultMission: def?.coreMission || null,
        defaultWorkflow: def?.workflow || null,
        defaultMetrics: def?.successMetrics || null,
      };
    });

    app.put<{ Params: { id: string }; Body: {
      preferredRuntime?: string | null;
      customIdentity?: string | null;
      customMission?: string | null;
      customWorkflow?: string | null;
      customMetrics?: string | null;
      notes?: string | null;
    } }>('/api/agents/:id/config', async (request, reply) => {
      const agent = getAgentById(getDb(), request.params.id);
      if (!agent) return reply.code(404).send({ error: 'Agent not found' });
      saveAgentConfig(getDb(), { agentId: request.params.id, ...request.body });
      return { ok: true };
    });

    // activate/deactivate kept for backward compat but now sets standby/offline
    app.post<{ Params: { id: string } }>('/api/agents/:id/activate', async (request, reply) => {
      const db = getDb();
      const agent = getAgentById(db, request.params.id);
      if (!agent) return reply.code(404).send({ error: 'Agent not found' });
      setAgentActive(db, agent.id, true);
      eventBus.emitServerEvent({ type: 'agent:status', data: { agentId: agent.id, status: 'standby' } });
      return getAgentById(db, agent.id);
    });

    app.post<{ Params: { id: string } }>('/api/agents/:id/deactivate', async (request, reply) => {
      const db = getDb();
      const agent = getAgentById(db, request.params.id);
      if (!agent) return reply.code(404).send({ error: 'Agent not found' });
      setAgentActive(db, agent.id, false);
      eventBus.emitServerEvent({ type: 'agent:status', data: { agentId: agent.id, status: 'offline' } });
      return getAgentById(db, agent.id);
    });

    // activate-all kept for backward compat — sets all to standby
    app.post('/api/agents/activate-all', async () => {
      const db = getDb();
      db.prepare("UPDATE agents SET is_active = 1, status = 'standby', updated_at = CURRENT_TIMESTAMP WHERE status = 'offline'").run();
      const agents = getAllAgents(db);
      for (const agent of agents) {
        eventBus.emitServerEvent({ type: 'agent:status', data: { agentId: agent.id, status: agent.status } });
      }
      return { activated: agents.length };
    });
  };
}
