export type TerminalSessionStatus = 'active' | 'closed';

export interface TerminalSession {
  id: string;
  taskId: string;
  agentId: string;
  runtime: string;
  pid: number | null;
  status: TerminalSessionStatus;
  logPath: string | null;
  createdAt: string;
  closedAt: string | null;
}
