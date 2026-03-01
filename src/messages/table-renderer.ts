import type { TableState } from '../models/table.js';
import type { SeatPlayer } from '../models/player.js';
import { formatChips } from './formatter.js';
import { renderCards, renderHiddenCards } from './card-renderer.js';

export function renderTableOverview(table: TableState): string {
  const seated = table.seats.filter((s): s is SeatPlayer => s !== null && !s.isSittingOut);
  const lines: string[] = [];

  for (const player of seated) {
    const marker = player.seatIndex === table.dealerSeatIndex ? '\uD83C\uDD5B' : '  ';
    const turn = player.seatIndex === table.currentPlayerSeatIndex && player.isActive ? '\u25C0\uFE0F' : '';
    const status = player.isAllIn ? '(ALL-IN)' : player.isActive ? '' : '(FOLD)';
    lines.push(`${marker} ${player.displayName}: ${formatChips(player.chipStack)} ${status} ${turn}`);
  }

  return lines.join('\n');
}
