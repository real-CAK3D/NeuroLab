import cors from "cors";
import express, { type Request, type Response } from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { appConfig } from "../../shared/index";
import { createLogger } from "../../shared/logging/logger";
import { initDatabase } from "./database/db";
import { buildSnapshot } from "./database/queries";
import { eventBus } from "./events/bus";
import { advanceSimulation } from "./simulation/engine";

const logger = createLogger("neurolab-websocket");
const port = Number(process.env.PORT || 3007);
const tickMs = Number(process.env.SIMULATION_TICK_MS || appConfig.simulation.simulationTickMs);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

let tick = 0;

initDatabase();

app.use(cors());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "neurolab-websocket", tickMs, tick });
});

app.get("/status", (_req: Request, res: Response) => {
  res.json({ ok: true, clients: io.engine.clientsCount, tickMs, tick });
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "frontend connected to websocket");
  socket.emit("simulation:snapshot", buildSnapshot(tick, tickMs));
  socket.on("command:intercom", (payload) => {
    eventBus.publish({
      type: "SYSTEM",
      message: "Intercom command received.",
      entity_type: "command",
      payload,
    });
  });
});

eventBus.subscribe((event) => {
  io.emit("event", event);
});

setInterval(() => {
  try {
    tick += 1;
    advanceSimulation(tick, tickMs);
    io.emit("simulation:snapshot", buildSnapshot(tick, tickMs));
  } catch (error) {
    logger.error({ error }, "simulation tick failed");
  }
}, tickMs);

httpServer.listen(port, "0.0.0.0", () => {
  logger.info({ port, tickMs }, "NeuroLab websocket listening");
});
