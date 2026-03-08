CREATE TABLE "actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"hand_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"phase" text NOT NULL,
	"action_type" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"pot_after" integer NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activated_groups" (
	"group_id" text PRIMARY KEY NOT NULL,
	"activated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"wa_id" text NOT NULL,
	"display_name" text NOT NULL,
	"group_id" text,
	"message" text NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"small_blind" integer NOT NULL,
	"big_blind" integer NOT NULL,
	"min_buy_in" integer NOT NULL,
	"max_buy_in" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_by" integer NOT NULL,
	"started_at" text,
	"ended_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_player_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"wa_id" text NOT NULL,
	"display_name" text NOT NULL,
	"sessions_played" integer DEFAULT 0 NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"hands_won" integer DEFAULT 0 NOT NULL,
	"total_buy_in" integer DEFAULT 0 NOT NULL,
	"total_cash_out" integer DEFAULT 0 NOT NULL,
	"biggest_pot" integer DEFAULT 0 NOT NULL,
	"last_played_at" text
);
--> statement-breakpoint
CREATE TABLE "hand_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"hand_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"seat_position" integer NOT NULL,
	"hole_cards" text,
	"chips_before" integer NOT NULL,
	"chips_after" integer NOT NULL,
	"final_action" text
);
--> statement-breakpoint
CREATE TABLE "hands" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"hand_number" integer NOT NULL,
	"dealer_seat" integer NOT NULL,
	"community_cards" text,
	"pot_total" integer DEFAULT 0 NOT NULL,
	"winners_json" text,
	"started_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"wa_id" text NOT NULL,
	"display_name" text NOT NULL,
	"chip_balance" integer DEFAULT 0 NOT NULL,
	"total_buy_in" integer DEFAULT 0 NOT NULL,
	"total_cash_out" integer DEFAULT 0 NOT NULL,
	"hands_played" integer DEFAULT 0 NOT NULL,
	"hands_won" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "players_wa_id_unique" UNIQUE("wa_id")
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_players_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_players" ADD CONSTRAINT "hand_players_hand_id_hands_id_fk" FOREIGN KEY ("hand_id") REFERENCES "public"."hands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_players" ADD CONSTRAINT "hand_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hands" ADD CONSTRAINT "hands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;