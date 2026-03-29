# Whatsapp Poker

A WhatsApp bot that lets you play Texas Hold'em No-Limit poker cash games directly in group chats.

## What it does

- Play full Texas Hold'em poker within WhatsApp group conversations
- Virtual chip system with persistent balance tracking across sessions
- Supports 2–9 players per table with heads-up special rules
- Hole cards dealt privately via DM
- Multi-way pots and split pot handling

## How it works

Players interact with the bot through WhatsApp messages using commands like `deal`, `join`, `raise`, `fold`, `check`, `call`, and `all-in`. The bot manages the entire game flow — dealing, betting rounds, pot calculation, and hand evaluation.

## Tech stack

- **Runtime:** Node.js + TypeScript
- **WhatsApp API:** Baileys ([@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys))
- **Database:** PostgreSQL + Drizzle ORM
- **Poker engine:** pokersolver
- **Server:** Express.js
- **Testing:** Vitest