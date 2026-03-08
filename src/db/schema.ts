import { pgTable, text, integer, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const players = pgTable('players', {
  id: serial('id').primaryKey(),
  waId: text('wa_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  chipBalance: integer('chip_balance').notNull().default(0),
  totalBuyIn: integer('total_buy_in').notNull().default(0),
  totalCashOut: integer('total_cash_out').notNull().default(0),
  handsPlayed: integer('hands_played').notNull().default(0),
  handsWon: integer('hands_won').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull(),
  smallBlind: integer('small_blind').notNull(),
  bigBlind: integer('big_blind').notNull(),
  minBuyIn: integer('min_buy_in').notNull(),
  maxBuyIn: integer('max_buy_in').notNull(),
  status: text('status').notNull().default('waiting'),
  createdBy: integer('created_by').notNull().references(() => players.id),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const hands = pgTable('hands', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  handNumber: integer('hand_number').notNull(),
  dealerSeat: integer('dealer_seat').notNull(),
  communityCards: text('community_cards'),
  potTotal: integer('pot_total').notNull().default(0),
  winnersJson: text('winners_json'),
  startedAt: text('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  endedAt: text('ended_at'),
});

export const handPlayers = pgTable('hand_players', {
  id: serial('id').primaryKey(),
  handId: integer('hand_id').notNull().references(() => hands.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  seatPosition: integer('seat_position').notNull(),
  holeCards: text('hole_cards'),
  chipsBefore: integer('chips_before').notNull(),
  chipsAfter: integer('chips_after').notNull(),
  finalAction: text('final_action'),
});

export const activatedGroups = pgTable('activated_groups', {
  groupId: text('group_id').primaryKey(),
  activatedAt: text('activated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const groupPlayerStats = pgTable('group_player_stats', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull(),
  waId: text('wa_id').notNull(),
  displayName: text('display_name').notNull(),
  sessionsPlayed: integer('sessions_played').notNull().default(0),
  handsPlayed: integer('hands_played').notNull().default(0),
  handsWon: integer('hands_won').notNull().default(0),
  totalBuyIn: integer('total_buy_in').notNull().default(0),
  totalCashOut: integer('total_cash_out').notNull().default(0),
  biggestPot: integer('biggest_pot').notNull().default(0),
  lastPlayedAt: text('last_played_at'),
});

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  waId: text('wa_id').notNull(),
  displayName: text('display_name').notNull(),
  groupId: text('group_id'),
  message: text('message').notNull(),
  processed: integer('processed').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const actions = pgTable('actions', {
  id: serial('id').primaryKey(),
  handId: integer('hand_id').notNull().references(() => hands.id),
  playerId: integer('player_id').notNull().references(() => players.id),
  phase: text('phase').notNull(),
  actionType: text('action_type').notNull(),
  amount: integer('amount').notNull().default(0),
  potAfter: integer('pot_after').notNull(),
  sequence: integer('sequence').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
