import type { ServerEvent, ClientCommand } from '@ai-company/shared';
import { eventBus } from '../services/event-bus.js';
import type { TerminalManager } from '../services/terminal-manager.js';

interface WsLike {
  readyState: number;
  send(data: string): void;
  on(event: string, cb: (...args: any[]) => void): void;
}

const clients = new Set<WsLike>();
let terminalManagerRef: TerminalManager | null = null;

export function setTerminalManager(tm: TerminalManager): void {
  terminalManagerRef = tm;
}

export function registerClient(socket: WsLike): void {
  clients.add(socket);
  socket.on('message', (raw: any) => {
    try {
      const command = JSON.parse(raw.toString()) as ClientCommand;
      if (command.type === 'terminal:input' && terminalManagerRef) {
        terminalManagerRef.sendInput(command.data.sessionId, command.data.input);
      }
    } catch { /* ignore malformed */ }
  });
  socket.on('close', () => { clients.delete(socket); });
}

export function broadcast(event: ServerEvent): void {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) client.send(message);
  }
}

eventBus.onServerEvent((event) => { broadcast(event); });
