import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { initDb, closeDb } from '../db/connection.js';
import { initializeSchema } from '../db/schema.js';
import { upsertDepartment } from '../db/queries/departments.js';
import { upsertAgent } from '../db/queries/agents.js';
import { departmentRoutes } from '../routes/departments.js';
import { createAgentRoutes } from '../routes/agents.js';
import { createTaskRoutes } from '../routes/tasks.js';
import { createTask } from '../db/queries/tasks.js';
import { statsRoutes } from '../routes/stats.js';

describe('REST API Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    // Initialize in-memory DB — sets module-level db so getDb() works in routes
    const db = initDb(':memory:');
    initializeSchema(db);

    // Seed test data
    upsertDepartment(db, {
      id: 'engineering',
      name: '工程部',
      nameEn: 'Engineering',
      directorId: null,
      color: '#1565C0',
      emoji: '⚙️',
      sortOrder: 0,
    });

    upsertAgent(db, {
      id: 'eng-000',
      name: 'Engineering Director',
      departmentId: 'engineering',
      role: 'director',
      emoji: '👨‍💼',
      color: '#1565C0',
      runtimes: ['claude-code'],
      maxConcurrentTasks: 5,
      definitionPath: 'engineering/director.md',
      definitionHash: 'abc123',
    });

    upsertAgent(db, {
      id: 'eng-001',
      name: 'Frontend Developer',
      departmentId: 'engineering',
      role: 'member',
      emoji: '🎨',
      color: '#4FC3F7',
      runtimes: ['claude-code'],
      maxConcurrentTasks: 2,
      definitionPath: 'engineering/frontend-developer.md',
      definitionHash: 'def456',
    });

    upsertAgent(db, {
      id: 'eng-002',
      name: 'Backend Developer',
      departmentId: 'engineering',
      role: 'member',
      emoji: '⚙️',
      color: '#81C784',
      runtimes: ['claude-code'],
      maxConcurrentTasks: 3,
      definitionPath: 'engineering/backend-developer.md',
      definitionHash: 'ghi789',
    });

    // Update director_id
    upsertDepartment(db, {
      id: 'engineering',
      name: '工程部',
      nameEn: 'Engineering',
      directorId: 'eng-000',
      color: '#1565C0',
      emoji: '⚙️',
      sortOrder: 0,
    });

    // Set up Fastify app
    app = Fastify({ logger: false });
    await app.register(departmentRoutes);
    const mockRegistry = {
      getDefinition: (id: string) => id === 'eng-001' ? { identity: '资深前端开发者', coreMission: '构建前端应用', workflow: '1. 分析 2. 开发 3. 测试', successMetrics: 'Lighthouse > 90' } : null,
    } as any;
    await app.register(createAgentRoutes(mockRegistry));
    const mockTaskEngine = {
      submitTask: async (input: any) => createTask(db, input),
      executeTask: async () => 'session-123',
    } as any;
    await app.register(createTaskRoutes(mockTaskEngine));
    await app.register(statsRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  // ---- Department routes ----

  it('GET /api/departments returns list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/departments' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    const eng = body.find((d: any) => d.id === 'engineering');
    expect(eng).toBeDefined();
    expect(eng.stats).toBeDefined();
    expect(eng.stats.totalAgents).toBe(3);
  });

  it('GET /api/departments/engineering returns detail with director and members', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/departments/engineering' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('engineering');
    expect(body.director).toBeDefined();
    expect(body.director.id).toBe('eng-000');
    expect(body.members).toBeDefined();
    expect(body.members).toHaveLength(2);
    expect(body.stats).toBeDefined();
  });

  it('GET /api/departments/unknown returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/departments/unknown' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Department not found');
  });

  // ---- Agent routes ----

  it('GET /api/agents returns list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);
  });

  it('GET /api/agents?department=engineering filters correctly', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents?department=engineering' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBe(3);
    for (const agent of body) {
      expect(agent.departmentId).toBe('engineering');
    }
  });

  it('GET /api/agents?department=nonexistent returns empty array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents?department=nonexistent' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('POST /api/agents/:id/activate sets agent active', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/agents/eng-001/activate' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isActive).toBe(true);
    expect(body.status).toBe('standby');
  });

  it('POST /api/agents/:id/deactivate sets agent inactive', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/agents/eng-001/deactivate' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isActive).toBe(false);
    expect(body.status).toBe('offline');
  });

  it('POST /api/agents/unknown/activate returns 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/agents/unknown/activate' });
    expect(res.statusCode).toBe(404);
  });

  // ---- Task routes ----

  it('POST /api/tasks creates a task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'Build login page',
        input: 'Create a React login component',
        assignedTo: 'eng-001',
        departmentId: 'engineering',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Build login page');
    expect(body.status).toBe('queued');
    expect(body.assignedTo).toBe('eng-001');
  });

  it('GET /api/tasks returns tasks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it('PATCH /api/tasks/:id updates task status', async () => {
    // First create a task
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Test task', input: 'test input' },
    });
    const task = createRes.json();

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      payload: { status: 'running' },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = patchRes.json();
    expect(updated.status).toBe('running');
    expect(updated.startedAt).toBeTruthy();
  });

  it('POST /api/tasks/:id/cancel cancels task', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Cancel me', input: 'cancel input' },
    });
    const task = createRes.json();

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/cancel`,
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().status).toBe('cancelled');
  });

  it('PATCH /api/tasks/unknown returns 404', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/unknown-id',
      payload: { status: 'running' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/tasks/:id/execute returns session id', async () => {
    // First create a task
    const createRes = await app.inject({
      method: 'POST', url: '/api/tasks',
      payload: { title: 'Exec test', input: 'do something', assignedTo: 'eng-001', departmentId: 'engineering' },
    });
    const task = JSON.parse(createRes.body);

    const res = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/execute` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sessionId).toBe('session-123');
  });

  // ---- Stats route ----

  it('GET /api/stats returns overview', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agents).toBeDefined();
    expect(body.agents.total).toBeGreaterThanOrEqual(3);
    expect(body.tasks).toBeDefined();
    expect(body.tasks.total).toBeGreaterThanOrEqual(1);
    expect(body.runtimes).toBeDefined();
    expect(typeof body.runtimes.total).toBe('number');
    expect(typeof body.runtimes.available).toBe('number');
  });
});
