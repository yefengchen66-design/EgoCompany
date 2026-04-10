import { create } from 'zustand';
import type { Task } from '@ai-company/shared';

interface TaskStore {
  tasks: Map<string, Task>;
  setTasks: (tasks: Task[]) => void;
  updateTask: (task: Task) => void;
  removeTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: new Map(),
  setTasks: (tasks) => set({ tasks: new Map(tasks.map(t => [t.id, t])) }),
  updateTask: (task) =>
    set((state) => {
      const updated = new Map(state.tasks);
      updated.set(task.id, task);
      return { tasks: updated };
    }),
  removeTask: (id) =>
    set((state) => {
      const updated = new Map(state.tasks);
      updated.delete(id);
      return { tasks: updated };
    }),
}));
