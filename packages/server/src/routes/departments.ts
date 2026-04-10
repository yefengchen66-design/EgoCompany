import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { getAllDepartments, getDepartmentById, getDeptStats } from '../db/queries/departments.js';
import { getAllAgents } from '../db/queries/agents.js';

export async function departmentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/departments', async () => {
    const db = getDb();
    const depts = getAllDepartments(db);
    return depts.map(dept => ({
      ...dept,
      stats: getDeptStats(db, dept.id),
    }));
  });

  app.get<{ Params: { id: string } }>('/api/departments/:id', async (request, reply) => {
    const db = getDb();
    const dept = getDepartmentById(db, request.params.id);
    if (!dept) return reply.code(404).send({ error: 'Department not found' });
    const agents = getAllAgents(db, { departmentId: dept.id });
    const stats = getDeptStats(db, dept.id);
    const director = agents.find(a => a.role === 'director');
    const members = agents.filter(a => a.role === 'member');
    return { ...dept, stats, director, members };
  });
}
