import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { getAllRuntimes } from '../db/queries/runtimes.js';
import { getTotalUsage } from '../db/queries/task-usage.js';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stats', async () => {
    const db = getDb();
    const agentStats = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy,
        SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END) as idle
      FROM agents
    `).get() as any;

    const taskStats = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM tasks
    `).get() as any;

    const runtimes = getAllRuntimes(db);

    // Token usage stats (adapted from Multica's task_usage dashboard)
    const usage = getTotalUsage(db);

    return {
      agents: agentStats,
      tasks: taskStats,
      runtimes: { total: runtimes.length, available: runtimes.filter(r => r.isAvailable).length },
      usage,
    };
  });
}
