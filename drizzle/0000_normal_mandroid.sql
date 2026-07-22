CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`r2_key` text NOT NULL,
	`openai_file_id` text,
	`vector_store_id` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_user_created_idx` ON `documents` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_resources` (
	`user_id` text PRIMARY KEY NOT NULL,
	`vector_store_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `viva_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`score` integer NOT NULL,
	`feedback_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `answers_session_idx` ON `viva_answers` (`session_id`);--> statement-breakpoint
CREATE INDEX `answers_user_idx` ON `viva_answers` (`user_id`);--> statement-breakpoint
CREATE TABLE `viva_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`difficulty` text NOT NULL,
	`question_count` integer DEFAULT 0 NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_created_idx` ON `viva_sessions` (`user_id`,`created_at`);