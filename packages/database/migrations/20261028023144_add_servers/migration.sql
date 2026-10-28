CREATE TABLE `installed_servers` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`source` text NOT NULL,
	`registry_name` text,
	`version` text,
	`launch` text NOT NULL,
	`autostart` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "source_values" CHECK("source" in ('registry', 'custom')),
	CONSTRAINT "registry_fields" CHECK("source" = 'custom' or ("registry_name" is not null and "version" is not null))
);
