import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { getAllRuntimes } from '../db/queries/runtimes.js';
import { RuntimeDetector } from '../services/runtime-detector.js';

export async function runtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/runtimes', async () => getAllRuntimes(getDb()));

  app.post('/api/runtimes/detect', async () => {
    const detector = new RuntimeDetector(getDb());
    detector.detectAll();
    return getAllRuntimes(getDb());
  });
}
