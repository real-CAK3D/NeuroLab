import { EventEmitter } from "node:events";
import { eventSchema, type ActivityEvent } from "../schemas/domain";

export type NeuroLabEvent = ActivityEvent & {
  source?: string;
};

type EventBusListener = (event: NeuroLabEvent) => void;

export class NeuroLabEventBus {
  private readonly emitter = new EventEmitter();

  publish(event: NeuroLabEvent) {
    const normalized = eventSchema.parse({
      ...event,
      payload: event.payload ?? {},
      created_at: event.created_at ?? new Date().toISOString(),
    }) as NeuroLabEvent;
    this.emitter.emit("event", normalized);
    this.emitter.emit(normalized.type, normalized);
    return normalized;
  }

  subscribe(listener: EventBusListener) {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  on(type: string, listener: EventBusListener) {
    this.emitter.on(type, listener);
    return () => this.emitter.off(type, listener);
  }
}

export function createEventBus() {
  return new NeuroLabEventBus();
}

