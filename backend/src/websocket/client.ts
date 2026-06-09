import { io } from "socket.io-client";
import { createLogger } from "../../../shared/logging/logger";
import { eventBus } from "../events/bus";

const logger = createLogger("neurolab-backend:websocket-client");
const websocketUrl = process.env.WEBSOCKET_URL || "http://neurolab-websocket:3007";

export function connectWebsocketWithRetry() {
  const socket = io(websocketUrl, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 1500,
  });

  socket.on("connect", () => {
    logger.info({ websocketUrl }, "backend connected to websocket service");
    eventBus.publish({
      type: "SYSTEM",
      message: "Backend connected to WebSocket engine.",
      entity_type: "service",
      payload: { websocketUrl },
    });
  });

  socket.on("connect_error", (error) => {
    logger.warn({ websocketUrl, error: error.message }, "websocket unavailable; retrying");
  });

  return socket;
}

