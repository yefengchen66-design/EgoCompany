export type AgentRole = 'director' | 'member';
export type AgentStatus = 'online' | 'standby' | 'busy' | 'idle' | 'offline';

export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  vibe?: string;
  department: string;
  role: AgentRole;
  emoji: string;
  color: string;
  runtimes: string[];
  maxConcurrentTasks: number;
  subordinates?: string[];
  identity: string;
  criticalRules?: string;
  communicationStyle?: string;
  coreMission: string;
  workflow?: string;
  successMetrics?: string;
  leadershipCapabilities?: string;
  delegationRules?: string;
}

export interface Agent {
  id: string;
  name: string;
  departmentId: string;
  role: AgentRole;
  emoji: string;
  color: string;
  status: AgentStatus;
  runtimes: string[];
  maxConcurrentTasks: number;
  definitionPath: string;
  definitionHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
