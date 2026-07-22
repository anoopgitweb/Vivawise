import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userResources = sqliteTable("user_resources", {
  userId: text("user_id").primaryKey(),
  vectorStoreId: text("vector_store_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  r2Key: text("r2_key").notNull(),
  openaiFileId: text("openai_file_id"),
  vectorStoreId: text("vector_store_id"),
  status: text("status").notNull().default("processing"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("documents_user_created_idx").on(table.userId, table.createdAt)]);

export const vivaSessions = sqliteTable("viva_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  difficulty: text("difficulty").notNull(),
  questionCount: integer("question_count").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("sessions_user_created_idx").on(table.userId, table.createdAt)]);

export const vivaAnswers = sqliteTable("viva_answers", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  score: integer("score").notNull(),
  feedbackJson: text("feedback_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("answers_session_idx").on(table.sessionId), index("answers_user_idx").on(table.userId)]);
