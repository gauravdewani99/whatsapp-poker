import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';

const NEEDLE_PHRASES = [
  'Tera call itna weak tha, ATM machine bhi decline kar de 💳❌',
  'Tu poker khelta hai ya donations deta hai? 🤲',
  'Tere chips toh already mere hain, formality baaki hai 😏',
  'Tera poker face WhatsApp pe bhi dikh raha hai 📱🤡',
  'Slow play mat kar, tera hand sabko pata hai 🔍',
  'Isse achha toh lottery kharid leta, odds better hote 🎫',
  'Tera bluff itna transparent hai, glass bhi sharmaye 🪟',
  'Fold kar le, dignity bacha le thodi 🙏',
  'Yeh call kaise kiya? Paisa jyada hai kya? 💸',
  'Tujhe poker nahi, teen patti khelni chahiye 🃏',
];

const TIGHT_PHRASES = [
  'Kitna tight khelega? Khul ke ji, zindagi ek hi hai 😤',
  'Fold fold fold… dealer ne cards diye hain ya parking tickets? 🅿️',
  'Itna tight mat khel, blood circulation ruk jayega 🩸',
  'Tera range itna tight hai, needle bhi na ghuse 🪡',
  'Tu poker player hai ya watchman? Sirf dekh raha hai 👀',
  'Premium hands ka wait? Retirement tak milenge shayad 👴',
  'Fold fold fold… nickname "Origami" rakh dete hain 📄',
  'Kuch toh khel, blinds khaa rahe hain tujhe 🐛',
  'Tu itna tight khelega toh log sochenge AFK hai 💤',
  'Poker hai, naukri nahi. Thoda risk le 🎰',
];

const RAGEBAIT_PHRASES = [
  'Abe saale, fold kar na! 🤬',
  'Chal be, tere se na ho payega 😤',
  'Kya kar raha hai be, donkey! 🫏',
  'Teri toh lag gayi ab 💀',
  'Nikal lavde, pehli fursat mein nikal 🚪',
  'Bhag bc, bluff mat kar 🏃',
  'Abe gadhe, call kyun kiya?! 🤡',
  'Tujhe poker nahi, ludo khelna chahiye 🎲',
  'Bhai tu fish hai pakka 🐟',
  'Chal hat, tere cards toh gande honge 🗑️',
  'Yeh banda har haath mein all-in karega kya?! 😂',
  'Rehne de, tu nahi jeetega aaj 📉',
  'Kitna ghatiya khelta hai tu yaar 🤮',
  'Abe ullu, yeh kya move tha?! 🦉',
  'Paisa barbaad bc 💸',
];

const FISH_PHRASES = [
  '🐟 Raise raise raise, all day long — your stack is shrinking, your reads are wrong.',
  '🐟 The fish who bets with nothing in hand, will watch their chips turn into sand.',
  '🐟 Big bets, small brain — a classic tale. The House has seen this movie, you always fail.',
  '🐟 Swimming upstream with pocket air? Bold move. The river always wins.',
  '🐟 All-in with vibes and a prayer — the poker gods have left the chat.',
  '🐟 Bluff so big, even your cards are embarrassed. The House sees everything.',
  '🐟 Splash the pot, feed the sharks. Another day, another donation.',
  '🐟 You bet like you have aces. You play like you have 7-2 off. The House never forgets.',
];

const SHAME_PHRASES = [
  '🪦 The House sends its condolences.',
  '📉 That was painful to watch. Even The House looked away.',
  '🫠 Somewhere, a poker tutorial is crying for you.',
  '💀 That hand belongs in a crime scene, not a poker table.',
  '🚨 Call the ambulance. Actually, call a coach first.',
  '📦 Pack it up. The felt doesn\'t deserve this.',
  '🕳️ If there was a hole in the table, you\'d crawl into it right now.',
  '🧊 Stone cold loss. The House respects the commitment though.',
];

const GG_COMPLIMENTS = [
  'What a hand! 👏 Well played.',
  'Absolute masterclass. Take a bow 🎩',
  'GG! You\'re on fire 🔥',
  'Clean play, nothing but respect 🫡',
  'That was beautiful poker right there ✨',
  'Ice cold execution. Legend 🧊',
  'You just owned that table 💪',
  'Poetry in motion. GG! 🎶',
  'The poker gods smile upon you today 🙏',
  'Smooth operator! Well deserved 😎',
  'That hand was textbook perfect 📖',
  'Take a victory lap, you earned it 🏆',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function registerBanterCommands(registry: CommandRegistry): void {
  registry.register('ragebait', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: randomFrom(RAGEBAIT_PHRASES) };
  });

  registry.register('needle', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: randomFrom(NEEDLE_PHRASES) };
  });

  registry.register('tight', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: randomFrom(TIGHT_PHRASES) };
  });

  registry.register('fish', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: randomFrom(FISH_PHRASES) };
  });

  registry.register('shame', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: randomFrom(SHAME_PHRASES) };
  });

  registry.register('gg', (_command: ParsedCommand): CommandResult => {
    return { groupMessage: randomFrom(GG_COMPLIMENTS) };
  });
}
