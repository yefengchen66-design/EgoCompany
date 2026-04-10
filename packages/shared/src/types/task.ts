export type TaskStatus = 'queued' | 'assigned' | 'running' | 'reviewing' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  departmentId: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  parentTaskId: string | null;
  pipelineId: string | null;
  stageName: string | null;
  runtime: string | null;
  status: TaskStatus;
  priority: number;
  input: string;
  output: string | null;
  workingDir: string | null;
  sessionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  departmentId?: string;
  assignedTo?: string;
  runtime?: string;
  priority?: number;
  input: string;
  workingDir?: string;
}
