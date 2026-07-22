import { requireAdmin } from "../../../../lib/admin-auth";
import { userIdFromEmail } from "../../../../lib/identity";
import { attachFile, createTopicVectorStore, uploadKnowledgeFile } from "../../../../lib/openai";
import { ensureSchema, requireBucket, requireDatabase } from "../../../../lib/runtime";

export async function GET(request: Request) {
  try {
    await requireAdmin(request); await ensureSchema();
    const result = await requireDatabase().prepare(`SELECT t.*, COUNT(DISTINCT d.id) document_count, COUNT(DISTINCT a.id) assignment_count
      FROM mock_viva_topics t LEFT JOIN topic_documents d ON d.topic_id=t.id LEFT JOIN topic_assignments a ON a.topic_id=t.id
      GROUP BY t.id ORDER BY t.created_at DESC`).all();
    return Response.json({ topics: result.results });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request); await ensureSchema();
    const db = requireDatabase();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(); const topicId = String(form.get("topicId") || ""); const file = form.get("file");
      if (!topicId || !(file instanceof File)) return Response.json({ error: "Topic and document are required." }, { status: 400 });
      const topic = await db.prepare("SELECT title, vector_store_id vectorStoreId FROM mock_viva_topics WHERE id=?").bind(topicId).first<{ title: string; vectorStoreId?: string }>();
      if (!topic) return Response.json({ error: "Topic not found." }, { status: 404 });
      let vectorStoreId = topic.vectorStoreId;
      if (!vectorStoreId) { vectorStoreId = await createTopicVectorStore(topicId, topic.title); await db.prepare("UPDATE mock_viva_topics SET vector_store_id=?, updated_at=? WHERE id=?").bind(vectorStoreId, Date.now(), topicId).run(); }
      const id = crypto.randomUUID(); const r2Key = `topics/${topicId}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await requireBucket().put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { topicId, originalName: file.name } });
      const openaiFileId = await uploadKnowledgeFile(file); await attachFile(vectorStoreId, openaiFileId);
      await db.prepare("INSERT INTO topic_documents (id,topic_id,file_name,mime_type,size_bytes,r2_key,openai_file_id,status,created_at) VALUES (?,?,?,?,?,?,?,'ready',?)")
        .bind(id, topicId, file.name, file.type || "application/octet-stream", file.size, r2Key, openaiFileId, Date.now()).run();
      return Response.json({ ok: true });
    }
    const body = await request.json() as { action?: string; title?: string; subject?: string; description?: string; difficulty?: string; topicId?: string; email?: string };
    if (body.action === "create") {
      if (!body.title?.trim() || !body.subject?.trim()) return Response.json({ error: "Title and subject are required." }, { status: 400 });
      const id = crypto.randomUUID(); const now = Date.now();
      await db.prepare("INSERT INTO mock_viva_topics (id,title,subject,description,difficulty,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
        .bind(id, body.title.trim(), body.subject.trim(), body.description?.trim() || "", body.difficulty || "Standard", now, now).run();
      return Response.json({ id });
    }
    if (body.action === "assign") {
      const email = body.email?.trim().toLowerCase(); if (!body.topicId || !email || !email.includes("@")) return Response.json({ error: "A valid student email is required." }, { status: 400 });
      const userId = await userIdFromEmail(email);
      await db.prepare("INSERT OR REPLACE INTO topic_assignments (id,topic_id,user_id,assigned_email,assigned_at) VALUES (?,?,?,?,?)")
        .bind(crypto.randomUUID(), body.topicId, userId, email, Date.now()).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return Response.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 });
}
