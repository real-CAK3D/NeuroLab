import cors from "cors";
import express, { type Request, type Response } from "express";
import { appConfig } from "../../shared/index";
import { createLogger } from "../../shared/logging/logger";
import { eventBus } from "./events/bus";

const logger = createLogger("neurolab-ai");
const port = Number(process.env.PORT || 3008);
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "neurolab-ai", mode: "template-placeholder" });
});

app.get("/summary", (_req: Request, res: Response) => {
  const message = "AI summary placeholder: no Ollama/local LLM is enabled in the MVP.";
  const payload = {
    summary: message,
    generatedAt: new Date().toISOString(),
    intervalMs: appConfig.simulation.aiReportGenerationMs,
    recommendations: ["Keep simulation stable", "Review alert queue", "Assign queued tasks"],
  };
  eventBus.publish({
    type: "AI_MESSAGE",
    message,
    entity_type: "ai",
    payload,
  });
  res.json(payload);
});

app.post("/reports/department", (req: Request, res: Response) => {
  const department = String(req.body.department || "General");
  const report = {
    department,
    title: `${department} template briefing`,
    body: `${department} is operating in placeholder analysis mode. No autonomous AI action was taken.`,
    generatedAt: new Date().toISOString(),
  };
  eventBus.publish({
    type: "AI_MESSAGE",
    message: `Generated template report for ${department}.`,
    entity_type: "department",
    payload: report,
  });
  res.json(report);
});

app.post("/commands/preview", (req: Request, res: Response) => {
  eventBus.publish({
    type: "AI_MESSAGE",
    message: "Command preview generated without executing infrastructure actions.",
    entity_type: "command",
    payload: req.body,
  });
  res.json({
    accepted: true,
    mode: "preview-only",
    input: req.body,
    message: "Command preview generated without executing infrastructure actions.",
  });
});

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "NeuroLab AI placeholder listening");
});

