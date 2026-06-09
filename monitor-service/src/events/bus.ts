import { createEventBus } from "../../../shared/events/eventBus";
import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("neurolab-monitor:event-bus");

export const eventBus = createEventBus();

eventBus.subscribe((event) => {
  logger.info({ event }, "monitor event bus received event");
});

