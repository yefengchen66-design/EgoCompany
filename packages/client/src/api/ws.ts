import { useEffect, useRef } from 'react';
import type { ServerEvent, ClientCommand } from '@ai-company/shared';

type EventHandler = (event: ServerEvent) => void;

let globalWs: WebSocket | null = null;
const handlers = new Set<EventHandler>();

function getWs(): WebSocket {
  if (globalWs && globalWs.readyState <= 1) return globalWs;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/ws`;
  globalWs = new WebSocket(url);

  globalWs.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as ServerEvent;
      handlers.forEach(h => h(event));
    } catch { /* ignore */ }
  };

  globalWs.onclose = () => {
    setTimeout(() => { globalWs = null; getWs(); }, 3000);
  };

  return globalWs;
}

export function useWebSocket(handler: EventHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const h: EventHandler = (e) => handlerRef.current(e);
    handlers.add(h);
    getWs(); // ensure connected
    return () => { handlers.delete(h); };
  }, []);
}

export function sendCommand(command: ClientCommand) {
  const ws = getWs();
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(command));
  }
}
