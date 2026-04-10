import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { getAllSkills, getSkillById, searchSkills, createSkill, updateSkill, deleteSkill, getAgentSkills, assignSkillToAgent, unassignSkillFromAgent, assignSkillToDepartment } from '../db/queries/skills.js';
import { getAllDeptContext, upsertDeptContext, deleteDeptContext } from '../db/queries/dept-context.js';
import { searchDeptMemories, rebuildMemoryFts } from '../db/queries/memories.js';

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  // === Skills ===

  app.get<{ Querystring: { category?: string; q?: string; active?: string } }>(
    '/api/skills', async (request) => {
      if (request.query.q) return searchSkills(getDb(), request.query.q, 20);
      return getAllSkills(getDb(), {
        category: request.query.category,
        active: request.query.active === 'false' ? false : undefined,
      });
    });

  app.get<{ Params: { id: string } }>(
    '/api/skills/:id', async (request, reply) => {
      const skill = getSkillById(getDb(), request.params.id);
      if (!skill) return reply.code(404).send({ error: 'Skill not found' });
      return skill;
    });

  app.post<{ Body: { name: string; description?: string; content: string; category?: string; tags?: string[]; config?: any } }>(
    '/api/skills', async (request) => {
      return createSkill(getDb(), request.body as any);
    });

  app.put<{ Params: { id: string }; Body: { name?: string; description?: string; content?: string; category?: string; tags?: string[]; isActive?: boolean; config?: any } }>(
    '/api/skills/:id', async (request, reply) => {
      const skill = updateSkill(getDb(), request.params.id, request.body as any);
      if (!skill) return reply.code(404).send({ error: 'Skill not found' });
      return skill;
    });

  app.delete<{ Params: { id: string } }>(
    '/api/skills/:id', async (request, reply) => {
      const ok = deleteSkill(getDb(), request.params.id);
      if (!ok) return reply.code(404).send({ error: 'Skill not found' });
      return { ok: true };
    });

  // Skill-agent assignment
  app.get<{ Params: { agentId: string } }>(
    '/api/agents/:agentId/skills', async (request) => {
      return getAgentSkills(getDb(), request.params.agentId);
    });

  app.post<{ Params: { skillId: string }; Body: { agentId?: string; departmentId?: string } }>(
    '/api/skills/:skillId/assign', async (request) => {
      if (request.body.departmentId) {
        const count = assignSkillToDepartment(getDb(), request.params.skillId, request.body.departmentId);
        return { assigned: count };
      }
      if (request.body.agentId) {
        assignSkillToAgent(getDb(), request.params.skillId, request.body.agentId);
        return { ok: true };
      }
      return { ok: false };
    });

  app.post<{ Params: { skillId: string }; Body: { agentId: string } }>(
    '/api/skills/:skillId/unassign', async (request) => {
      unassignSkillFromAgent(getDb(), request.params.skillId, request.body.agentId);
      return { ok: true };
    });

  // === Department Shared Context ===
  app.get<{ Params: { deptId: string } }>(
    '/api/departments/:deptId/context', async (request) => {
      return getAllDeptContext(getDb(), request.params.deptId);
    });

  app.put<{ Params: { deptId: string }; Body: { key: string; value: string; updatedBy?: string } }>(
    '/api/departments/:deptId/context', async (request) => {
      return upsertDeptContext(getDb(), request.params.deptId, request.body.key, request.body.value, request.body.updatedBy);
    });

  app.delete<{ Params: { deptId: string }; Body: { key: string } }>(
    '/api/departments/:deptId/context', async (request) => {
      const ok = deleteDeptContext(getDb(), request.params.deptId, request.body.key);
      return { ok };
    });

  // === Cross-department memory search ===
  app.get<{ Params: { deptId: string }; Querystring: { q: string } }>(
    '/api/departments/:deptId/memories/search', async (request) => {
      return searchDeptMemories(getDb(), request.params.deptId, request.query.q);
    });

  app.post('/api/admin/rebuild-fts', async () => {
    const count = rebuildMemoryFts(getDb());
    return { indexed: count };
  });
}
