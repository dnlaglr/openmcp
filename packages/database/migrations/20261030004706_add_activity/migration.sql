CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`at` integer NOT NULL,
	`server_id` text,
	`server_name` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`client` text,
	`duration_ms` integer NOT NULL,
	`outcome` text NOT NULL,
	`error` text,
	CONSTRAINT "kind_values" CHECK("kind" in ('tool', 'prompt', 'resource')),
	CONSTRAINT "outcome_values" CHECK("outcome" in ('ok', 'tool_error', 'error', 'unavailable'))
);
--> statement-breakpoint
CREATE INDEX `activity_at` ON `activity` (`at`);