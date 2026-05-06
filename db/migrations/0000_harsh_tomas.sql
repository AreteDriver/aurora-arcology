CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` text NOT NULL,
	`payload` text
);
--> statement-breakpoint
CREATE TABLE `board_nodes` (
	`board_id` text NOT NULL,
	`node_id` text NOT NULL,
	`position_x` real,
	`position_y` real,
	PRIMARY KEY(`board_id`, `node_id`),
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`curator` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connection_sources` (
	`connection_id` text NOT NULL,
	`source_id` text,
	`role` text NOT NULL,
	`excerpt` text,
	`note` text,
	PRIMARY KEY(`connection_id`, `role`, `source_id`),
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`src_node_id` text NOT NULL,
	`tgt_node_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`claim` text,
	`confidence` real NOT NULL,
	`curator` text NOT NULL,
	`drawn_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`src_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tgt_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relation_type`) REFERENCES `relation_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `node_sources` (
	`node_id` text NOT NULL,
	`source_id` text NOT NULL,
	PRIMARY KEY(`node_id`, `source_id`),
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `node_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`brief` text,
	`canonicity` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`type`) REFERENCES `node_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relation_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`publisher` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`date` text,
	`excerpt` text,
	`license_tier` text NOT NULL,
	`canonicity` text,
	`local_path` text,
	`created_at` text NOT NULL
);
