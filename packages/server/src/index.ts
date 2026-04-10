import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import path from 'node:path';
import { initDb, closeDb } from './db/connection.js';
import { AgentRegistry } from './services/agent-registry.js';
import { RuntimeDetector } from './services/runtime-detector.js';
import { TerminalManager } from './services/terminal-manager.js';
import { TaskEngine } from './services/task-engine.js';
import { registerClient, setTerminalManager } from './ws/hub.js';
import { departmentRoutes } from './routes/departments.js';
import { createAgentRoutes } from './routes/agents.js';
import { createTaskRoutes } from './routes/tasks.js';
import { runtimeRoutes } from './routes/runtimes.js';
import { statsRoutes } from './routes/stats.js';
import { createTerminalRoutes } from './routes/terminals.js';
import { DEFAULT_SERVER_PORT } from '@ai-company/shared';
import { PipelineLoader } from './services/pipeline-loader.js';
import { PipelineExecutor } from './services/pipeline-executor.js';
import { createPipelineRoutes } from './routes/pipelines.js';
import { MeetingExecutor } from './services/meeting-executor.js';
import { createMeetingRoutes } from './routes/meetings.js';
import { memoryRoutes } from './routes/memories.js';
import { deptMessageRoutes } from './routes/dept-messages.js';
import { skillRoutes } from './routes/skills.js';
import { createCrossDeptRoutes } from './routes/cross-dept.js';
import { voiceRoutes } from './routes/voice.js';

async function main() {
  const app = Fastify({ logger: true });
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);

  // Resolve project root: works whether cwd is project root or packages/server
  const projectRoot = process.cwd().endsWith(path.join('packages', 'server'))
    ? path.resolve(process.cwd(), '..', '..')
    : process.cwd();

  const dbPath = path.join(projectRoot, 'data', 'ai-company.db');
  const db = initDb(dbPath);

  const agentsDir = path.join(projectRoot, 'packages', 'agents');
  const registry = new AgentRegistry(db, agentsDir);
  const loadResult = await registry.loadAll();
  app.log.info(`Loaded ${loadResult.agents} agents across ${loadResult.departments} departments`);

  const detector = new RuntimeDetector(db);
  detector.detectAll();

  const logsDir = path.join(projectRoot, 'data', 'logs');
  const terminalManager = new TerminalManager(db, logsDir);
  const taskEngine = new TaskEngine(db, registry, terminalManager);

  const pipelinesDir = path.join(projectRoot, 'packages', 'agents', 'pipelines');
  const pipelineLoader = new PipelineLoader(pipelinesDir);
  const pipelineCount = await pipelineLoader.loadAll();
  app.log.info(`Loaded ${pipelineCount} pipeline definitions`);

  const pipelineExecutor = new PipelineExecutor(db, taskEngine);
  const meetingExecutor = new MeetingExecutor(db, registry, terminalManager);
  meetingExecutor.setTaskEngine(taskEngine);

  setTerminalManager(terminalManager);

  app.get('/ws', { websocket: true }, (socket) => { registerClient(socket); });

  await app.register(departmentRoutes);
  await app.register(createAgentRoutes(registry));
  await app.register(createTaskRoutes(taskEngine));
  await app.register(runtimeRoutes);
  await app.register(statsRoutes);
  await app.register(createTerminalRoutes(terminalManager));
  await app.register(createPipelineRoutes(pipelineLoader, pipelineExecutor));
  await app.register(createMeetingRoutes(meetingExecutor));
  await app.register(memoryRoutes);
  await app.register(deptMessageRoutes);
  await app.register(skillRoutes);
  await app.register(createCrossDeptRoutes(taskEngine));
  await app.register(voiceRoutes);

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  const port = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
  await app.listen({ port, host: '0.0.0.0' });

  const shutdown = async () => {
    app.log.info('Shutting down...');
    terminalManager.killAll();
    await app.close();
    closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
