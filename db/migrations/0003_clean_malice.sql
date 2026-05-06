CREATE TABLE `suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`matched_text` text NOT NULL,
	`candidate_type` text NOT NULL,
	`existing_node_id` text,
	`rationale` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`curator` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`existing_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE no action
);
