import type { TableState } from '../models/table.js';
import type { CardString } from '../models/card.js';
import type { SeatPlayer } from '../models/player.js';
import type { BettingAction } from '../models/game.js';
import type { BlindPositions } from '../engine/blinds.js';
import type { EvaluatedHand } from '../engine/hand-evaluator.js';
import type { PotState } from '../models/pot.js';
import { renderCard, renderCards, renderHiddenCards } from './card-renderer.js';
import { formatChips, divider } from './formatter.js';

/** Sum of in-progress bets (current street) + already-collected pots (prior streets). */
function calculateCurrentPot(table: TableState): number {
  return table.seats
    .filter((s): s is SeatPlayer => s !== null)
    .reduce((sum, s) => sum + s.currentBet, 0)
    + (table.potState?.totalAmount || 0);
}

export function gameStartMessage(smallBlind: number, bigBlind: number, minBuyIn: number, maxBuyIn: number): string {
  return [
    `\u2660\uFE0F *POKER TABLE OPEN* \u2660\uFE0F`,
    '',
    `Blinds: *${formatChips(smallBlind)}/${formatChips(bigBlind)}*`,
    `Buy-in: ${formatChips(minBuyIn)} - ${formatChips(maxBuyIn)}`,
    '',
    `Type *!poker join <amount>* to sit down.`,
    `Min 2 players to start.`,
  ].join('\n');
}

export function playerJoinedMessage(player: SeatPlayer, table: TableState): string {
  const seated = table.seats.filter((s): s is SeatPlayer => s !== null && !s.isSittingOut);
  const playerList = seated
    .map((s, i) => `${i + 1}. ${s.displayName} - ${formatChips(s.chipStack)}`)
    .join('\n');

  return [
    `\u2705 *${player.displayName}* joined with *${formatChips(player.chipStack)}* chips.`,
    '',
    `Players (${seated.length}/${table.config.maxPlayers}):`,
    playerList,
    '',
    seated.length < 2 ? `Need at least 2 players. Type *!poker join <amount>* to join.` : `Type *!poker deal* to start dealing!`,
  ].join('\n');
}

export function playerLeftMessage(name: string): string {
  return `\u274C *${name}* left the table.`;
}

export function newHandMessage(table: TableState, positions: BlindPositions): string {
  const dealer = table.seats[positions.dealerSeat]!;
  const sb = table.seats[positions.smallBlindSeat]!;
  const bb = table.seats[positions.bigBlindSeat]!;
  const firstToAct = table.seats[table.currentPlayerSeatIndex]!;

  const potTotal = sb.currentBet + bb.currentBet;

  return [
    divider(),
    `\uD83C\uDCCF *New Hand*`,
    divider(),
    `Dealer: *${dealer.displayName}* \uD83C\uDD5B`,
    `Small Blind: ${sb.displayName} (${formatChips(table.config.smallBlind)})`,
    `Big Blind: ${bb.displayName} (${formatChips(table.config.bigBlind)})`,
    '',
    `Cards have been dealt! Check your DMs. \uD83D\uDCE9`,
    '',
    `Pot: *${formatChips(potTotal)}*`,
    `Action on: *${firstToAct.displayName}*`,
  ].join('\n');
}

export function holeCardsMessage(_handNumber: number, cards: [CardString, CardString]): string {
  return [
    `  ${renderCards(cards)}`,
    '',
    `Good luck! \uD83C\uDF40`,
  ].join('\n');
}

export function actionMessage(player: SeatPlayer, action: BettingAction, amount: number | undefined, table: TableState): string {
  const potTotal = calculateCurrentPot(table);

  switch (action) {
    case 'fold':
      return `\u274C *${player.displayName}* folds`;
    case 'check':
      return `\u2705 *${player.displayName}* checks | Pot: *${formatChips(potTotal)}*`;
    case 'call':
      return `\u27A1\uFE0F *${player.displayName}* calls ${formatChips(player.currentBet)} | Pot: *${formatChips(potTotal)}*`;
    case 'raise':
      return `\u2B06\uFE0F *${player.displayName}* raises to ${formatChips(player.currentBet)} | Pot: *${formatChips(potTotal)}*`;
    case 'all_in':
      return `\uD83D\uDD25 *${player.displayName}* ALL-IN for ${formatChips(player.currentBet)}! | Pot: *${formatChips(potTotal)}*`;
  }
}

/** Render active player stacks for street messages. */
function activeStacks(table: TableState): string {
  return table.seats
    .filter((s): s is SeatPlayer => s !== null && s.isActive)
    .map(s => `${s.displayName}: ${formatChips(s.chipStack)}`)
    .join(' | ');
}

export function flopMessage(cards: CardString[], potTotal: number, table: TableState): string {
  return [
    `\u2500\u2500\u2500 *FLOP* \u2500\u2500\u2500`,
    '',
    `  ${renderCards(cards)}`,
    '',
    `Pot: *${formatChips(potTotal)}*`,
    activeStacks(table),
  ].join('\n');
}

export function turnMessage(card: CardString, allCommunity: CardString[], potTotal: number, table: TableState): string {
  return [
    `\u2500\u2500\u2500 *TURN* \u2500\u2500\u2500`,
    '',
    `  ${renderCards(allCommunity)}`,
    '',
    `Pot: *${formatChips(potTotal)}*`,
    activeStacks(table),
  ].join('\n');
}

export function riverMessage(card: CardString, allCommunity: CardString[], potTotal: number, table: TableState): string {
  return [
    `\u2500\u2500\u2500 *RIVER* \u2500\u2500\u2500`,
    '',
    `  ${renderCards(allCommunity)}`,
    '',
    `Pot: *${formatChips(potTotal)}*`,
    activeStacks(table),
  ].join('\n');
}

export function rimPromptMessage(table: TableState): string {
  return [
    `\uD83D\uDD25 *All-in! Run it once, twice, or thrice?*`,
    `_Running it multiple times deals the remaining cards again and splits the pot across runs._`,
    '',
    `Reply *!1*, *!2*, or *!3*`,
    `_Lowest vote wins · 30s to decide · default !1_`,
  ].join('\n');
}

export function rimRunMessage(
  runNum: number,
  totalRuns: number,
  communityCards: CardString[],
  evaluated: EvaluatedHand[],
  runWinners: EvaluatedHand[],
  table: TableState,
): string {
  const lines: string[] = [
    `\u2500\u2500\u2500 *RUN ${runNum} of ${totalRuns}* \u2500\u2500\u2500`,
    '',
    `  ${renderCards(communityCards)}`,
    '',
  ];

  // Show each player's hand
  for (const seat of table.seats) {
    if (!seat || !seat.isActive || !seat.holeCards) continue;
    const evalHand = evaluated.find(h => h.playerId === seat.profileId);
    const desc = evalHand ? evalHand.handDescription : 'Unknown';
    lines.push(`\uD83D\uDC40 *${seat.displayName}*: ${renderCards(seat.holeCards)} - _${desc}_`);
  }

  lines.push('');
  for (const w of runWinners) {
    const seat = table.seats.find(s => s?.profileId === w.playerId);
    if (seat) {
      lines.push(`\uD83C\uDFC6 *${seat.displayName}* wins Run ${runNum}`);
    }
  }

  return lines.join('\n');
}

export function rimSummaryMessage(
  totalRuns: number,
  totalWinnings: Map<number, number>,
  table: TableState,
): string {
  const lines: string[] = [
    `\u2500\u2500\u2500 *RESULTS (${totalRuns} RUN${totalRuns > 1 ? 'S' : ''})* \u2500\u2500\u2500`,
    '',
  ];

  for (const [playerId, amount] of totalWinnings) {
    const seat = table.seats.find(s => s?.profileId === playerId);
    if (seat) {
      lines.push(`\uD83C\uDFC6 *${seat.displayName}*: ${formatChips(amount)}`);
    }
  }

  lines.push(divider());
  return lines.join('\n');
}

export function uncontestedWinMessage(winner: SeatPlayer, potTotal: number): string {
  return [
    `\uD83C\uDFC6 *${winner.displayName}* wins *${formatChips(potTotal)}* (uncontested)`,
    divider(),
  ].join('\n');
}

export function showdownMessage(
  table: TableState,
  evaluated: EvaluatedHand[],
  winnings: Map<number, number>,
  winnerHands: Map<number, string>,
  potState: PotState,
): string {
  const lines: string[] = [
    `\u2500\u2500\u2500 *SHOWDOWN* \u2500\u2500\u2500`,
    '',
    `Community: ${renderCards(table.communityCards)}`,
    '',
  ];

  // Show each player's hand
  for (const seat of table.seats) {
    if (!seat) continue;
    if (seat.isActive && seat.holeCards) {
      const evalHand = evaluated.find(h => h.playerId === seat.profileId);
      const desc = evalHand ? evalHand.handDescription : 'Unknown';
      lines.push(`\uD83D\uDC40 *${seat.displayName}*: ${renderCards(seat.holeCards)} - _${desc}_`);
    } else if (!seat.isActive && !seat.isSittingOut) {
      lines.push(`\uD83D\uDE45 *${seat.displayName}*: folded`);
    }
  }

  lines.push('');

  // Show pot results
  if (potState.pots.length > 1) {
    potState.pots.forEach((pot, idx) => {
      const potName = idx === 0 ? 'Main Pot' : `Side Pot ${idx}`;
      const potWinnerIds = [...winnings.entries()]
        .filter(([id]) => pot.eligiblePlayerIds.includes(id))
        .map(([id]) => id);

      for (const wId of potWinnerIds) {
        const seat = table.seats.find(s => s?.profileId === wId);
        const hand = winnerHands.get(wId) || '';
        if (seat) {
          lines.push(`${potName} (${formatChips(pot.amount)}): *${seat.displayName}* wins with _${hand}_`);
        }
      }
    });
  }

  // Total winnings
  for (const [playerId, amount] of winnings) {
    const seat = table.seats.find(s => s?.profileId === playerId);
    if (seat) {
      lines.push(`\uD83C\uDFC6 *${seat.displayName}* wins *${formatChips(amount)}*`);
    }
  }

  lines.push(divider());
  return lines.join('\n');
}

export function statusMessage(table: TableState): string {
  const potTotal = calculateCurrentPot(table);

  const lines: string[] = [
    `\u2660\uFE0F *TABLE STATUS* \u2660\uFE0F`,
    '',
    `Phase: *${table.phase}*`,
    `Blinds: ${formatChips(table.config.smallBlind)}/${formatChips(table.config.bigBlind)} | Pot: *${formatChips(potTotal)}*`,
  ];

  if (table.communityCards.length > 0) {
    lines.push('', `Community: ${renderCards(table.communityCards)}`);
  }

  lines.push('', 'Players:');
  for (const seat of table.seats) {
    if (!seat) continue;
    const isDealer = seat.seatIndex === table.dealerSeatIndex ? ' \uD83C\uDD5B' : '';
    const isTurn = seat.seatIndex === table.currentPlayerSeatIndex && seat.isActive ? ' \u25C0\uFE0F' : '';
    const cards = seat.isActive ? renderHiddenCards() : 'folded';

    if (seat.isSittingOut) {
      lines.push(`  _${seat.displayName} - sitting out_`);
    } else if (!seat.isActive) {
      lines.push(`  _${seat.displayName} - folded_`);
    } else {
      lines.push(`  *${seat.displayName}* - ${formatChips(seat.chipStack)} (${cards})${isDealer}${isTurn}`);
    }
  }

  lines.push('', '\u25C0\uFE0F = current turn | \uD83C\uDD5B = dealer');
  return lines.join('\n');
}

export function welcomeMessage(): string {
  return [
    `\u2660\uFE0F *The House has joined the table* \u2660\uFE0F`,
    '',
    `I'm here to host your poker games \u2014 cards, chips & turns handled.`,
    '',
    `When you're ready, type *!help* to see all commands.`,
    `Good luck \u2014 you'll need it. \uD83C\uDCCF`,
  ].join('\n');
}

export function dmWelcomeMessage(): string {
  return [
    `Greetings from The House \u2660\uFE0F`,
    '',
    `To play a game, add me to a group chat with your friends.`,
    `Once I'm in the group, you can start a game and manage the table.`,
    '',
    `To see all available commands, type *!help* here or in the group.`,
  ].join('\n');
}

export function dmCommandRejectionMessage(): string {
  return [
    `That command only works in a group chat \u2660\uFE0F`,
    '',
    `Add The House to a group with your friends to start playing.`,
  ].join('\n');
}

export function helpMessage(): string {
  return [
    `\u2660\uFE0F *THE HOUSE \u2014 COMMANDS* \u2660\uFE0F`,
    '',
    '*Game Management:*',
    '!poker start <sb>/<bb> - Start a table',
    '!poker join <amount> - Join with buy-in',
    '!deal - Deal a new hand',
    '!poker leave - Leave the table',
    '!poker stop - End the session',
    '!poker kick <name> - Vote to kick a player',
    '!sitout - Sit out (skip hands)',
    '!sitin - Return to the table',
    '',
    '*Betting:*',
    '!fold (!f) - Fold your hand',
    '!check (!x) - Check',
    '!call (!c) - Call the current bet',
    '!raise <amount> (!r) - Raise',
    '!all-in (!a) - Go all-in',
    '!1 / !2 / !3 - Run it multiple (when all-in)',
    '',
    '*Info:*',
    '!status (!s) - Show table state',
    '!stacks (!lb) - Leaderboard & P/L',
    '!buyins (!b) - Buy-in report per player',
    '!groupstats - All-time group stats',
    '!stats - Your win/loss stats',
    '!history - Last 5 hands',
    '!rules - Hand rankings & basics',
    '!rebuy <amount> - Reload chips',
    '!show - Reveal your cards after a hand',
    '!feedback <msg> - Send feedback to The House',
    '!help - Show this message',
    '',
    '*Banter:*',
    '!ragebait (!rbh) - Hindi trash talk',
    '!needle - Get under their skin',
    '!tight - Roast the folder',
    '!fish - Poetic roast for the aggressor',
    '!shame - Tease the loser',
    '!gg - Compliment the winner',
    '!taunt - Taunt your opponent',
  ].join('\n');
}

export function historyMessage(hands: Array<{
  handNumber: number;
  winner: string;
  amount: number;
  hand: string;
}>): string {
  if (hands.length === 0) return 'No hands played yet.';

  const lines = ['\uD83D\uDCDC *HAND HISTORY* \uD83D\uDCDC', ''];
  for (const h of hands) {
    lines.push(`\u2022 *${h.winner}* won ${formatChips(h.amount)} (${h.hand})`);
  }
  return lines.join('\n');
}
