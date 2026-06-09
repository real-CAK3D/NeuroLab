import { createEventBus } from "../../../shared/events/eventBus";
import { createLogger } from "../../../shared/logging/logger";
import { db } from "../database/db";

const logger = createLogger("neurolab-websocket:event-bus");

export const eventBus = createEventBus();

eventBus.subscribe((event) => {
  logger.info({ event }, "event bus received event");
  try {
    db.prepare("INSERT INTO events (type, message, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?)")
      .run(event.type, event.message, event.entity_type ?? null, event.entity_id ?? null, JSON.stringify(event.payload ?? {}));
  } catch (error) {
    logger.error({ error, event }, "failed to persist websocket event");
  }
});

