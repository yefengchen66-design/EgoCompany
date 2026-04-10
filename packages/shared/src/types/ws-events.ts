import type { Agent, AgentStatus } from './agent.js';
import type { Task } from './task.js';
import type { DeptStats } from './department.js';

export type ServerEvent =
  | { type: 'agent:status'; data: { agentId: string; status: AgentStatus } }
  | { type: 'task:update'; data: { task: Task } }
  | { type: 'task:output'; data: { taskId: string; chunk: string } }
  | { type: 'terminal:output'; data: { sessionId: string; chunk: string } }
  | { type: 'department:stats'; data: { departmentId: string; stats: DeptStats } }
  | { type: 'pipeline:progress'; data: { pipelineId: string; stage: string; status: string } }
  | { type: 'dept:message'; data: { departmentId: string } };

export type ClientCommand =
  | { type: 'terminal:input'; data: { sessionId: string; input: string } }
  | { type: 'subscribe'; data: { channels: string[] } }
  | { type: 'unsubscribe'; data: { channels: string[] } };
