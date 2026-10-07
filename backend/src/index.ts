import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { createLogger } from "../../shared/logging/logger";
import { apiRouter, computeSummary, readFacilityDevices } from "./api/routes";
import { startLifecycle } from "./services/lifecycle";
import { startMonitoring } from "./services/monitoring";
import { db, initDatabase } from "./database/db";
import { eventBus } from "./events/bus";
import { connectWebsocketWithRetry } from "./websocket/client";

const logger = createLogger("neurolab-backend");
const port = Number(process.env.PORT || 3006);
const app = express();

initDatabase();
connectWebsocketWithRetry();
startMonitoring(computeSummary);
startLifecycle(() => readFacilityDevices());

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true, service: "neurolab-backend", database: "ready", uptimeSeconds: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false, service: "neurolab-backend", database: "unavailable" });
  }
});

app.use("/api", apiRouter());

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unexpected backend error");
  eventBus.publish({
    type: "ALERT",
    message: "Backend encountered an unexpected error.",
    entity_type: "service",
    payload: { service: "backend", error: err.message },
  });
  res.status(500).json({ error: "Unexpected backend error" });
});

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "NeuroLab backend listening");
});

