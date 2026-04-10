export interface Department {
  id: string;
  name: string;
  nameEn: string;
  directorId: string | null;
  color: string;
  emoji: string;
  sortOrder: number;
  createdAt: string;
}

export interface DeptStats {
  departmentId: string;
  totalAgents: number;
  activeAgents: number;
  busyAgents: number;
  runningTasks: number;
  queuedTasks: number;
}
