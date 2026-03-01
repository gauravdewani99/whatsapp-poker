export function bold(text: string): string {
  return `*${text}*`;
}

export function italic(text: string): string {
  return `_${text}_`;
}

export function mono(text: string): string {
  return `\`\`\`${text}\`\`\``;
}

export function formatChips(amount: number): string {
  return amount.toLocaleString('en-US');
}

export function divider(): string {
  return '\u2500'.repeat(20);
}
