import { getVivaEnv } from "./runtime";

const OPENAI_BASE = "https://api.openai.com/v1";

function configuration() {
  const env = getVivaEnv();
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || "gpt-5.6-terra",
  };
}

async function openAI(path: string, init: RequestInit) {
  const { apiKey } = configuration();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  const response = await fetch(`${OPENAI_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}): ${detail.slice(0, 500)}`,
    );
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export async function createVectorStore(userId: string) {
  const result = await openAI("/vector_stores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      name: `Vivawise syllabus ${userId.slice(0, 12)}`,
      metadata: { vivawise_user: userId },
    }),
  });
  return String(result.id);
}

export async function createTopicVectorStore(topicId: string, title: string) {
  const result = await openAI("/vector_stores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({
      name: `Vivawise: ${title}`.slice(0, 240),
      metadata: { vivawise_topic: topicId },
    }),
  });
  return String(result.id);
}

export async function uploadKnowledgeFile(file: File) {
  const body = new FormData();
  body.set("purpose", "assistants");
  body.set("file", file, file.name);
  const result = await openAI("/files", { method: "POST", body });
  return String(result.id);
}

export async function attachFile(vectorStoreId: string, fileId: string) {
  return openAI(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function detachFile(vectorStoreId: string, fileId: string) {
  return openAI(
    `/vector_stores/${encodeURIComponent(vectorStoreId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE", headers: { "OpenAI-Beta": "assistants=v2" } },
  );
}

export async function deleteKnowledgeFile(fileId: string) {
  return openAI(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
}

export async function createVivaResponse(
  input: string,
  schemaName: string,
  schema: Record<string, unknown>,
  vectorStoreId?: string | null,
  maxFileResults = 6,
  maxOutputTokens = 1800,
) {
  const { model } = configuration();
  const result = await openAI("/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      input,
      tools: vectorStoreId
        ? [
            {
              type: "file_search",
              vector_store_ids: [vectorStoreId],
              max_num_results: maxFileResults,
            },
          ]
        : undefined,
      tool_choice: vectorStoreId ? { type: "file_search" } : undefined,
      text: {
        verbosity: "low",
        format: { type: "json_schema", name: schemaName, strict: true, schema },
      },
      max_output_tokens: maxOutputTokens,
      store: false,
    }),
  });
  const output = result.output as
    | Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>
    | undefined;
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("The AI examiner returned no usable response.");
  return JSON.parse(text) as Record<string, unknown>;
}
