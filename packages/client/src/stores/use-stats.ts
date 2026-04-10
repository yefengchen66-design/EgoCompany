import { create } from 'zustand';

interface Stats {
  agents: { total: number; active: number; busy: number; idle: number };
  tasks: { total: number; running: number; queued: number; completed: number; failed: number };
  runtimes: { total: number; available: number };
}

interface StatsStore {
  stats: Stats | null;
  setStats: (stats: Stats) => void;
}

export const useStatsStore = create<StatsStore>((set) => ({
  stats: null,
  setStats: (stats) => set({ stats }),
}));
