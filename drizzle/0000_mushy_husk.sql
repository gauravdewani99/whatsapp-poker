CREATE TABLE `actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hand_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`phase` text NOT NULL,
	`action_type` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`pot_after` integer NOT NULL,
	`sequence` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`small_blind` integer NOT NULL,
	`big_blind` integer NOT NULL,
	`min_buy_in` integer NOT NULL,
	`max_buy_in` integer NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_by` integer NOT NULL,
	`started_at` text,
	`ended_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hand_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hand_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`seat_position` integer NOT NULL,
	`hole_cards` text,
	`chips_before` integer NOT NULL,
	`chips_after` integer NOT NULL,
	`final_action` text,
	FOREIGN KEY (`hand_id`) REFERENCES `hands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`hand_number` integer NOT NULL,
	`dealer_seat` integer NOT NULL,
	`community_cards` text,
	`pot_total` integer DEFAULT 0 NOT NULL,
	`winners_json` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wa_id` text NOT NULL,
	`display_name` text NOT NULL,
	`chip_balance` integer DEFAULT 0 NOT NULL,
	`total_buy_in` integer DEFAULT 0 NOT NULL,
	`total_cash_out` integer DEFAULT 0 NOT NULL,
	`hands_played` integer DEFAULT 0 NOT NULL,
	`hands_won` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_wa_id_unique` ON `players` (`wa_id`);