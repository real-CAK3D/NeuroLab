import { createEventBus } from "../../../shared/events/eventBus";
import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("neurolab-ai:event-bus");

export const eventBus = createEventBus();

eventBus.subscribe((event) => {
  logger.info({ event }, "AI event bus received event");
});

