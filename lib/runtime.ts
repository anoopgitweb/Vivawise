import { env } from "cloudflare:workers";

type R2BucketLike = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

export type VivaEnv = {
  DB: D1Database;
  SYLLABUS_BUCKET: R2BucketLike;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

export function getVivaEnv() { return env as unknown as VivaEnv; }

export function requireDatabase() {
  const runtime = getVivaEnv();
  if (!runtime.DB) throw new Error("Vivawise database is not configured.");
  return runtime.DB;
}

export function requireBucket() {
  const runtime = getVivaEnv();
  if (!runtime.SYLLABUS_BUCKET) throw new Error("Vivawise document storage is not configured.");
  return runtime.SYLLABUS_BUCKET;
}

let schemaReady = false;
export async function ensureSchema() {
  if (schemaReady) return;
  const db = requireDatabase();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS user_resources (user_id TEXT PRIMARY KEY NOT NULL, vector_store_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, r2_key TEXT NOT NULL, openai_file_id TEXT, vector_store_id TEXT, status TEXT DEFAULT 'processing' NOT NULL, error_message TEXT, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS documents_user_created_idx ON documents (user_id, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS viva_sessions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, subject TEXT NOT NULL, difficulty TEXT NOT NULL, question_count INTEGER DEFAULT 0 NOT NULL, total_score INTEGER DEFAULT 0 NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS sessions_user_created_idx ON viva_sessions (user_id, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS viva_answers (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL, user_id TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, score INTEGER NOT NULL, feedback_json TEXT NOT NULL, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS answers_session_idx ON viva_answers (session_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS answers_user_idx ON viva_answers (user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS mock_viva_topics (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL, difficulty TEXT DEFAULT 'Standard' NOT NULL, vector_store_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS topic_documents (id TEXT PRIMARY KEY NOT NULL, topic_id TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, r2_key TEXT NOT NULL, openai_file_id TEXT, status TEXT DEFAULT 'processing' NOT NULL, error_message TEXT, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS topic_documents_topic_idx ON topic_documents (topic_id, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS topic_assignments (id TEXT PRIMARY KEY NOT NULL, topic_id TEXT NOT NULL, user_id TEXT NOT NULL, assigned_email TEXT NOT NULL, assigned_at INTEGER NOT NULL, UNIQUE(topic_id, user_id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS topic_assignments_user_idx ON topic_assignments (user_id, assigned_at)"),
  ]);
  try { await db.prepare("ALTER TABLE viva_sessions ADD COLUMN topic_id TEXT").run(); } catch { /* already migrated */ }
  schemaReady = true;
}
