import { create } from 'zustand';

interface TerminalStore {
  outputs: Map<string, string[]>;
  activeSessionId: string | null;
  appendOutput: (sessionId: string, chunk: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  clearOutput: (sessionId: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  outputs: new Map(),
  activeSessionId: null,
  appendOutput: (sessionId, chunk) =>
    set((state) => {
      const updated = new Map(state.outputs);
      const existing = updated.get(sessionId) || [];
      updated.set(sessionId, [...existing, chunk]);
      return { outputs: updated };
    }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  clearOutput: (sessionId) =>
    set((state) => {
      const updated = new Map(state.outputs);
      updated.delete(sessionId);
      return { outputs: updated };
    }),
}));
