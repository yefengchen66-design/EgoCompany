import type { FastifyInstance } from 'fastify';
import type { PipelineLoader } from '../services/pipeline-loader.js';
import type { PipelineExecutor } from '../services/pipeline-executor.js';
import { getAllPipelineRuns } from '../db/queries/pipelines.js';
import { getDb } from '../db/connection.js';

export function createPipelineRoutes(loader: PipelineLoader, executor: PipelineExecutor) {
  return async function pipelineRoutes(app: FastifyInstance) {
    // List available pipeline definitions
    app.get('/api/pipelines', async () => {
      return loader.getAllDefinitions();
    });

    // Get pipeline definition
    app.get<{ Params: { id: string } }>('/api/pipelines/:id', async (request, reply) => {
      const def = loader.getDefinition(request.params.id);
      if (!def) return reply.code(404).send({ error: 'Pipeline not found' });
      return def;
    });

    // Start a pipeline run
    app.post<{ Params: { id: string }; Body: { workingDir?: string } }>(
      '/api/pipelines/:id/run', async (request, reply) => {
        const def = loader.getDefinition(request.params.id);
        if (!def) return reply.code(404).send({ error: 'Pipeline not found' });
        try {
          const run = await executor.startPipeline(def, request.body?.workingDir);
          return run;
        } catch (err: any) {
          return reply.code(400).send({ error: err.message });
        }
      });

    // List pipeline runs
    app.get('/api/pipeline-runs', async () => {
      return getAllPipelineRuns(getDb());
    });

    // Get pipeline run status
    app.get<{ Params: { id: string } }>('/api/pipeline-runs/:id', async (request, reply) => {
      const run = executor.getRunStatus(request.params.id);
      if (!run) return reply.code(404).send({ error: 'Pipeline run not found' });
      return run;
    });
  };
}
