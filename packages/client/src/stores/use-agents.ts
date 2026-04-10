import { create } from 'zustand';
import type { Agent, AgentStatus } from '@ai-company/shared';

interface AgentStore {
  agents: Map<string, Agent>;
  setAgents: (agents: Agent[]) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  updateAgent: (agent: Agent) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: new Map(),
  setAgents: (agents) => set({ agents: new Map(agents.map(a => [a.id, a])) }),
  updateAgentStatus: (agentId, status) =>
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;
      const updated = new Map(state.agents);
      updated.set(agentId, { ...agent, status });
      return { agents: updated };
    }),
  updateAgent: (agent) =>
    set((state) => {
      const updated = new Map(state.agents);
      updated.set(agent.id, agent);
      return { agents: updated };
    }),
}));
