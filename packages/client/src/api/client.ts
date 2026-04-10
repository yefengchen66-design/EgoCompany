const BASE = '';  // proxied by Vite

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  // Only set Content-Type for requests with a body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Departments
  getDepartments: () => request<any[]>('/api/departments'),
  getDepartment: (id: string) => request<any>(`/api/departments/${id}`),

  // Agents
  getAgents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/api/agents${qs}`);
  },
  getAgent: (id: string) => request<any>(`/api/agents/${id}`),
  activateAgent: (id: string) => request<any>(`/api/agents/${id}/activate`, { method: 'POST', body: '{}' }),
  deactivateAgent: (id: string) => request<any>(`/api/agents/${id}/deactivate`, { method: 'POST', body: '{}' }),
  activateAll: () => request<any>('/api/agents/activate-all', { method: 'POST', body: '{}' }),
  activateDepartment: (dept: string) => request<any>(`/api/departments/${dept}/activate-all`, { method: 'POST', body: '{}' }),
  saveAgentConfig: (id: string, config: any) =>
    request<any>(`/api/agents/${id}/config`, { method: 'PUT', body: JSON.stringify(config) }),

  // Tasks
  getTasks: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/api/tasks${qs}`);
  },
  createTask: (input: any) => request<any>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  batchTasks: (tasks: Array<{ title: string; input: string; assignedTo: string; departmentId?: string }>) =>
    request<any>('/api/tasks/batch', { method: 'POST', body: JSON.stringify({ tasks }) }),
  submitDeptTask: (departmentId: string, instruction: string, title?: string) =>
    request<any>('/api/tasks/department', { method: 'POST', body: JSON.stringify({ departmentId, instruction, title }) }),
  executeTask: (id: string) => request<any>(`/api/tasks/${id}/execute`, { method: 'POST', body: '{}' }),
  cancelTask: (id: string) => request<any>(`/api/tasks/${id}/cancel`, { method: 'POST', body: '{}' }),
  retryTask: (id: string) => request<any>(`/api/tasks/${id}/retry`, { method: 'POST', body: '{}' }),
  redispatchTask: (id: string) => request<any>(`/api/tasks/${id}/redispatch`, { method: 'POST', body: '{}' }),

  // Terminals
  getTerminals: () => request<any[]>('/api/terminals'),
  sendTerminalInput: (id: string, input: string) =>
    request<any>(`/api/terminals/${id}/input`, { method: 'POST', body: JSON.stringify({ input }) }),
  killTerminal: (id: string) => request<any>(`/api/terminals/${id}/kill`, { method: 'POST', body: '{}' }),

  // Runtimes
  getRuntimes: () => request<any[]>('/api/runtimes'),
  detectRuntimes: () => request<any[]>('/api/runtimes/detect', { method: 'POST', body: '{}' }),

  // Stats
  getStats: () => request<any>('/api/stats'),

  // Pipelines
  getPipelines: () => request<any[]>('/api/pipelines'),
  getPipeline: (id: string) => request<any>(`/api/pipelines/${id}`),
  startPipeline: (id: string, workingDir?: string) =>
    request<any>(`/api/pipelines/${id}/run`, { method: 'POST', body: JSON.stringify({ workingDir }) }),
  getPipelineRuns: () => request<any[]>('/api/pipeline-runs'),
  getPipelineRun: (id: string) => request<any>(`/api/pipeline-runs/${id}`),

  // Memories
  getAgentMemories: (agentId: string) => request<any[]>(`/api/agents/${agentId}/memories`),
  addAgentMemory: (agentId: string, content: string, tags?: string[], type?: string) =>
    request<any>(`/api/agents/${agentId}/memories`, { method: 'POST', body: JSON.stringify({ content, tags, type }) }),
  searchMemories: (query: string, agentId?: string) => {
    const params = new URLSearchParams({ q: query });
    if (agentId) params.set('agent', agentId);
    return request<any[]>(`/api/memories/search?${params}`);
  },
  deleteMemory: (id: string) => request<any>(`/api/memories/${id}`, { method: 'DELETE' }),

  // Department Messages
  getDeptMessages: (deptId: string, limit = 30) =>
    request<any[]>(`/api/departments/${deptId}/messages?limit=${limit}`),
  getTaskThread: (taskId: string) => request<any[]>(`/api/tasks/${taskId}/thread`),
  getTaskReviews: (taskId: string) => request<any[]>(`/api/tasks/${taskId}/reviews`),
  getTaskTree: (taskId: string) => request<any>(`/api/tasks/${taskId}/tree`),
  getTaskMessages: (taskId: string) => request<any[]>(`/api/tasks/${taskId}/messages`),
  getTaskUsage: (taskId: string) => request<any[]>(`/api/tasks/${taskId}/usage`),
  getAgentMentions: (agentId: string) => request<any[]>(`/api/agents/${agentId}/mentions`),

  // Skills
  getSkills: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/api/skills${qs}`);
  },
  getSkill: (id: string) => request<any>(`/api/skills/${id}`),
  createSkill: (input: { name: string; description?: string; content: string; category?: string; tags?: string[] }) =>
    request<any>('/api/skills', { method: 'POST', body: JSON.stringify(input) }),
  updateSkill: (id: string, input: any) =>
    request<any>(`/api/skills/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteSkill: (id: string) => request<any>(`/api/skills/${id}`, { method: 'DELETE' }),
  searchSkills: (q: string) => request<any[]>(`/api/skills?q=${encodeURIComponent(q)}`),
  getAgentSkills: (agentId: string) => request<any[]>(`/api/agents/${agentId}/skills`),
  assignSkill: (skillId: string, body: { agentId?: string; departmentId?: string }) =>
    request<any>(`/api/skills/${skillId}/assign`, { method: 'POST', body: JSON.stringify(body) }),
  unassignSkill: (skillId: string, agentId: string) =>
    request<any>(`/api/skills/${skillId}/unassign`, { method: 'POST', body: JSON.stringify({ agentId }) }),

  // Department Context
  getDeptContext: (deptId: string) => request<any[]>(`/api/departments/${deptId}/context`),
  setDeptContext: (deptId: string, key: string, value: string) =>
    request<any>(`/api/departments/${deptId}/context`, { method: 'PUT', body: JSON.stringify({ key, value }) }),
  searchDeptMemories: (deptId: string, q: string) =>
    request<any[]>(`/api/departments/${deptId}/memories/search?q=${encodeURIComponent(q)}`),

  // Cross-department requests
  getCrossDeptRequests: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/api/cross-dept-requests${qs}`);
  },
  createCrossDeptRequest: (input: { fromDeptId: string; toDeptId: string; fromAgentId: string; title: string; description: string; context?: string }) =>
    request<any>('/api/cross-dept-requests', { method: 'POST', body: JSON.stringify(input) }),
  acceptCrossDeptRequest: (id: string) =>
    request<any>(`/api/cross-dept-requests/${id}/accept`, { method: 'POST', body: '{}' }),
  completeCrossDeptRequest: (id: string, summary?: string) =>
    request<any>(`/api/cross-dept-requests/${id}/complete`, { method: 'POST', body: JSON.stringify({ summary }) }),
  rejectCrossDeptRequest: (id: string) =>
    request<any>(`/api/cross-dept-requests/${id}/reject`, { method: 'POST', body: '{}' }),

  // Meetings
  getMeetings: () => request<any[]>('/api/meetings'),
  getMeeting: (id: string) => request<any>(`/api/meetings/${id}`),
  createMeeting: (data: { title: string; topic: string; participantIds: string[] }) =>
    request<any>('/api/meetings', { method: 'POST', body: JSON.stringify(data) }),
  meetingFollowup: (id: string, message: string) =>
    request<any>(`/api/meetings/${id}/followup`, { method: 'POST', body: JSON.stringify({ message }) }),
  dispatchMeetingWork: (id: string) =>
    request<any>(`/api/meetings/${id}/dispatch`, { method: 'POST', body: '{}' }),
  synthesizeMeeting: (id: string, synthesizerId?: string) =>
    request<any>(`/api/meetings/${id}/synthesize`, { method: 'POST', body: JSON.stringify({ synthesizerId }) }),
};
