# WhatsApp Poker Bot - Product Design

## Overview

A WhatsApp bot that enables Texas Hold'em No-Limit poker cash games entirely within group chats. Players interact using simple text commands. The bot manages dealing, betting rounds, pot calculations, and chip tracking.

## User Experience Flow

### Starting a Game

1. Any group member sends `!poker start 100/200` to open a table with 100/200 blinds
2. Players join by sending `!poker join 10000` with their buy-in amount
3. Once 2+ players are seated, anyone sends `!poker deal` to start the first hand

### Playing a Hand

1. **Pre-flop**: Bot posts blinds, deals 2 hole cards via private DM to each player, announces who acts first
2. **Betting**: Players act in turn using `!call`, `!raise 500`, `!fold`, `!check`, or `!all-in`
3. **Community cards**: Bot reveals flop (3), turn (1), river (1) with betting rounds between each
4. **Showdown**: Bot evaluates all hands, announces winner(s), distributes pot(s)
5. **Next hand**: Players send `!poker deal` to start the next hand

### Key Interactions

- **Group chat**: All game announcements, community cards, betting actions, and results
- **Private DMs**: Hole cards dealt individually to each player
- **Error handling**: Invalid actions get a friendly reply explaining the issue

## Command Reference

| Command | Description |
|---|---|
| `!poker start <sb>/<bb>` | Open a table with specified blinds |
| `!poker join <chips>` | Sit down with a buy-in |
| `!poker deal` | Deal a new hand |
| `!poker leave` | Leave the table (chips returned) |
| `!poker stop` | Close the table (creator only) |
| `!poker kick <name>` | Remove a player (creator only) |
| `!fold` / `!f` | Fold your hand |
| `!check` / `!x` | Check (when no bet to match) |
| `!call` / `!c` | Match the current bet |
| `!raise <amount>` / `!r` | Raise to a specific amount |
| `!all-in` / `!a` | Bet your entire stack |
| `!status` / `!s` | View current table state |
| `!balance` / `!bal` | Check your chip balance |
| `!cashout` | Cash out and leave |
| `!help` | Show all commands |
| `!history` | View last 5 hands |

## Architecture

### Tech Stack

- **Runtime**: Node.js + TypeScript
- **WhatsApp**: whatsapp-web.js (Puppeteer-based)
- **Database**: SQLite via Drizzle ORM
- **Testing**: Vitest

### System Design

```
WhatsApp Group Chat
      |
      v
[Message Handler] --> [Command Parser] --> [Command Registry]
                                                   |
                         +-------------------------+
                         |                         |
                    [Game Commands]           [Info Commands]
                         |
                         v
                   [Table Manager] -- manages --> [Game Round]
                         |                           |
                    [In-Memory State]          [Poker Engine]
                         |                     /    |    \
                         v                 Deck  Evaluator  Pot Manager
                   [DB Repositories]
                         |
                         v
                     [SQLite DB]
```

### Data Model

- **Players**: WhatsApp ID, display name, chip balance, lifetime stats
- **Games**: Group ID, blind structure, status, creator
- **Hands**: Game reference, community cards, pot total, winners
- **Hand Players**: Per-hand participation, hole cards, chip deltas
- **Actions**: Complete betting history for replay

### Key Design Decisions

1. **Pure engine separation**: The poker engine (`src/engine/`) has zero I/O dependencies. This makes it fully unit-testable and independent of WhatsApp.

2. **In-memory game state**: Active hand state lives in memory for performance. Results are persisted to SQLite at hand completion.

3. **One table per group**: Each WhatsApp group can have at most one active poker table, managed by the TableManager.

4. **Cryptographic shuffling**: Uses Node.js `crypto.randomInt()` for Fisher-Yates shuffle, ensuring fair card distribution.

5. **pokersolver for evaluation**: Well-tested hand evaluation library that handles all standard poker hands including kicker comparisons.

## Chip System

- Virtual chips (play money)
- Each new player starts with a configurable balance (default: 10,000)
- Buy-ins deducted from balance, cashouts returned to balance
- Persistent across sessions via SQLite

## Supported Scenarios

- 2-9 player tables
- Heads-up special rules (dealer = SB)
- Multiple side pots from all-in situations
- Split pots for tied hands
- Auto-fold on player leaving mid-hand
- Uncontested wins (everyone folds)
- Full showdown with hand evaluation

## Message Formatting

Uses WhatsApp-native formatting:
- **Bold** for player names and amounts
- _Italic_ for hand descriptions
- Unicode suit emojis (A♥️ K♠️ Q♦️ J♣️)
- Visual dividers and structured layouts

## Setup

```bash
# Install dependencies
npm install

# Run database migration
npm run db:migrate

# Start in development mode
npm run dev

# Scan QR code with your phone to authenticate WhatsApp
```

## Limitations

- Requires a dedicated WhatsApp phone number (unofficial API - risk of ban)
- Message rate limiting may throttle fast games with many players
- No visual poker table (text-only interface)
- Single server deployment
