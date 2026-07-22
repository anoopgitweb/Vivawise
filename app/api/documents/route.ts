import { attachFile, createVectorStore, uploadKnowledgeFile } from "../../../lib/openai";
import { requireVivaUser } from "../../../lib/identity";
import { ensureSchema, requireBucket, requireDatabase } from "../../../lib/runtime";

const allowedTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);

export async function GET(request: Request) {
  try {
    const user = await requireVivaUser(request);
    await ensureSchema();
    const rows = await requireDatabase().prepare(
      "SELECT id, file_name AS fileName, mime_type AS mimeType, size_bytes AS sizeBytes, status, error_message AS errorMessage, created_at AS createdAt FROM documents WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.userId).all();
    return Response.json({ documents: rows.results, user: { displayName: user.displayName } });
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireVivaUser(request);
    await ensureSchema();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a document to upload." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "Only PDF, DOCX and TXT documents are supported." }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return Response.json({ error: "Documents must be 25 MB or smaller." }, { status: 400 });

    const db = requireDatabase();
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const r2Key = `users/${user.userId}/documents/${id}/${safeName}`;
    await requireBucket().put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { owner: user.userId, originalName: file.name } });

    await db.prepare("INSERT INTO documents (id, user_id, file_name, mime_type, size_bytes, r2_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)")
      .bind(id, user.userId, file.name, file.type, file.size, r2Key, Date.now()).run();

    let resource = await db.prepare("SELECT vector_store_id AS vectorStoreId FROM user_resources WHERE user_id = ?").bind(user.userId).first<{ vectorStoreId?: string }>();
    let vectorStoreId = resource?.vectorStoreId;
    if (!vectorStoreId) {
      vectorStoreId = await createVectorStore(user.userId);
      await db.prepare("INSERT INTO user_resources (user_id, vector_store_id, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET vector_store_id = excluded.vector_store_id, updated_at = excluded.updated_at")
        .bind(user.userId, vectorStoreId, Date.now(), Date.now()).run();
    }

    try {
      const openaiFileId = await uploadKnowledgeFile(file);
      await attachFile(vectorStoreId, openaiFileId);
      await db.prepare("UPDATE documents SET openai_file_id = ?, vector_store_id = ?, status = 'ready' WHERE id = ? AND user_id = ?")
        .bind(openaiFileId, vectorStoreId, id, user.userId).run();
      return Response.json({ document: { id, fileName: file.name, sizeBytes: file.size, status: "ready", createdAt: Date.now() } }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Document indexing failed";
      await db.prepare("UPDATE documents SET status = 'failed', error_message = ? WHERE id = ? AND user_id = ?").bind(message.slice(0, 500), id, user.userId).run();
      throw error;
    }
  } catch (error) { return routeError(error); }
}

function routeError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
  return Response.json({ error: message }, { status });
}
