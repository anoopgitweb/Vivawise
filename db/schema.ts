import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  topicId: text("topic_id"),
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

export const mockVivaTopics = sqliteTable("mock_viva_topics", {
  id: text("id").primaryKey(), title: text("title").notNull(), subject: text("subject").notNull(),
  description: text("description").notNull(), difficulty: text("difficulty").notNull().default("Standard"),
  vectorStoreId: text("vector_store_id"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const topicDocuments = sqliteTable("topic_documents", {
  id: text("id").primaryKey(), topicId: text("topic_id").notNull(), fileName: text("file_name").notNull(), mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(), r2Key: text("r2_key").notNull(), openaiFileId: text("openai_file_id"), status: text("status").notNull().default("processing"),
  errorMessage: text("error_message"), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("topic_documents_topic_idx").on(table.topicId, table.createdAt)]);

export const topicAssignments = sqliteTable("topic_assignments", {
  id: text("id").primaryKey(), topicId: text("topic_id").notNull(), userId: text("user_id").notNull(), assignedEmail: text("assigned_email").notNull(), assignedAt: integer("assigned_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("topic_assignments_user_idx").on(table.userId, table.assignedAt), uniqueIndex("topic_assignments_topic_user_idx").on(table.topicId, table.userId)]);
