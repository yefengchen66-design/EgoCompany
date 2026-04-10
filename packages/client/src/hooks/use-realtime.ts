import { useWebSocket } from '@/api/ws';
import { useAgentStore } from '@/stores/use-agents';
import { useTaskStore } from '@/stores/use-tasks';
import { useTerminalStore } from '@/stores/use-terminal';
import type { ServerEvent } from '@ai-company/shared';

export function useRealtime() {
  const updateAgentStatus = useAgentStore(s => s.updateAgentStatus);
  const updateTask = useTaskStore(s => s.updateTask);
  const appendOutput = useTerminalStore(s => s.appendOutput);

  useWebSocket((event: ServerEvent) => {
    switch (event.type) {
      case 'agent:status':
        updateAgentStatus(event.data.agentId, event.data.status);
        break;
      case 'task:update':
        updateTask(event.data.task);
        break;
      case 'terminal:output':
        appendOutput(event.data.sessionId, event.data.chunk);
        break;
      case 'task:output':
        // Also track by task id — terminal:output is by session
        break;
    }
  });
}
