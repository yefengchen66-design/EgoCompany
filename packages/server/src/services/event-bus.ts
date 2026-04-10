import { EventEmitter } from 'node:events';
import type { ServerEvent } from '@ai-company/shared';

class EventBus extends EventEmitter {
  emitServerEvent(event: ServerEvent): boolean {
    return this.emit('server-event', event);
  }
  onServerEvent(listener: (event: ServerEvent) => void): this {
    return this.on('server-event', listener);
  }
}

export const eventBus = new EventBus();
