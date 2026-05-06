CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key_hash` text NOT NULL,
	`scope` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`status_code` integer,
	`attempted_at` text NOT NULL,
	`latency_ms` integer,
	`error` text,
	FOREIGN KEY (`subscription_id`) REFERENCES `webhook_subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`event_types` text NOT NULL,
	`secret_hash` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`last_delivery_at` text
);
