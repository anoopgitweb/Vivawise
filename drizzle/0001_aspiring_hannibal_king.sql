CREATE TABLE `mock_viva_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` text DEFAULT 'Standard' NOT NULL,
	`vector_store_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topic_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_email` text NOT NULL,
	`assigned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `topic_assignments_user_idx` ON `topic_assignments` (`user_id`,`assigned_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `topic_assignments_topic_user_idx` ON `topic_assignments` (`topic_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `topic_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`r2_key` text NOT NULL,
	`openai_file_id` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `topic_documents_topic_idx` ON `topic_documents` (`topic_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `viva_sessions` ADD `topic_id` text;
