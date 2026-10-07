import { createLogger } from "../../../shared/logging/logger";

const logger = createLogger("neurolab-backend:ollama");
const NOT_CHAT_MODEL = /embed|minilm|bge|nomic|e5-|rerank|arctic-embed/i;
const MODEL_CACHE_MS = 60_000;
let modelCache: { at: number; models: Array<{ name: string; size: number }> } | undefined;

export function ollamaUrl() {
  return process.env.OLLAMA_URL || "http://host.docker.internal:11434";
}

async function chatModels() {
  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_MS) return modelCache.models;
  const response = await fetch(`${ollamaUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const data = await response.json() as { models?: Array<{ name: string; size?: number; details?: { family?: string } }> };
  const models = (data.models ?? [])
    .filter((model) => !NOT_CHAT_MODEL.test(model.name) && !/bert/i.test(model.details?.family ?? ""))
    .map((model) => ({ name: model.name, size: model.size ?? 0 }))
    .sort((a, b) => a.size - b.size);
  modelCache = { at: Date.now(), models };
  return models;
}

// Reasoning models (qwen3, deepseek-r1, gpt-oss...) emit a hidden chain of thought: they need thinking enabled and a bigger
// token budget, otherwise their reasoning leaks into the reply. Fast chat replies prefer non-reasoning models.
const REASONING_MODEL = /qwen3|deepseek-r1|-r1|gpt-oss|qwq|magistral|phi4-reasoning/i;
export const isReasoningModel = (name: string) => REASONING_MODEL.test(name);

// Preferred model: explicit env var, else the smallest installed chat-capable model
// (non-reasoning models first when `fast` is set).
export async function pickChatModel(preferred?: string, fast = false): Promise<string | undefined> {
  if (preferred) return preferred;
  const models = await chatModels();
  if (fast) {
    const plain = models.filter((model) => !isReasoningModel(model.name));
    if (plain.length) return plain[0].name;
  }
  return models[0]?.name;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function ollamaChat(messages: ChatMessage[], options: { model?: string; maxTokens?: number; temperature?: number; timeoutMs?: number; fast?: boolean } = {}): Promise<{ text: string; model: string } | undefined> {
  try {
    const model = await pickChatModel(options.model, options.fast);
    if (!model) return undefined;
    const reasoning = isReasoningModel(model);
    const response = await fetch(`${ollamaUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: reasoning,
        keep_alive: "30m",
        messages,
        options: { num_predict: (options.maxTokens ?? 160) + (reasoning ? 900 : 0), temperature: options.temperature ?? 0.8 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
    if (!response.ok) return undefined;
    const data = await response.json() as { message?: { content?: string } };
    // Some models leak reasoning ending in </think> (with or without an opening tag); keep only what follows.
    const text = data.message?.content?.replace(/<think>[\s\S]*?<\/think>/g, "").split("</think>").pop()?.trim();
    // Models ignore "no emojis" often enough that we also strip them.
    const clean = text?.replace(/[\p{Extended_Pictographic}‍️]/gu, "").replace(/\s{2,}/g, " ").trim();
    return clean ? { text: clean, model } : undefined;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, "ollama chat failed");
    return undefined;
  }
}
