import type { ParsedCommand, CommandResult } from '../../models/command.js';
import type { CommandRegistry } from '../command-registry.js';

const NEEDLE_PHRASES = [
  'Bhai tera call itna weak tha, ATM machine bhi decline kar de 💳❌',
  'Tu poker khelta hai ya donations deta hai? 🤲',
  'Tere chips toh already mere hain, formality baaki hai bas 😏',
  'Tera poker face toh WhatsApp pe bhi dikh raha hai 📱🤡',
  'Bhai slow play mat kar, tera hand toh sabko pata hai 🔍',
  'Isse achha toh lottery kharid leta, odds better hote 🎫',
  'Tera bluff itna transparent hai, glass bhi sharmaye 🪟',
  'Fold kar le bhai, dignity bachale apni thodi 🙏',
  'Tune yeh call kaise kiya? Paisa jyada hai kya? 💸🤔',
  'Bhai tujhe poker nahi, teen patti khelni chahiye 🃏',
];

const TIGHT_PHRASES = [
  'Kitna tight khelega be? Khul ke ji, zindagi ek hi hai 😤',
  'Bhai fold fold fold... tujhe dealer ne cards diye hain ya parking tickets? 🅿️',
  'Itna tight mat khel, blood circulation ruk jayega 🩸',
  'Tera range itna tight hai, needle bhi na ghuse 🪡',
  'Bhai tu poker player hai ya watchman? Sirf dekh raha hai 👀',
  'Premium hands ka wait kar raha hai? Retirement tak milenge shayad 👴',
  'Fold fold fold... tera nickname "Origami" rakh dete hain 📄',
  'Abe kuch toh khel, blinds khaa rahe hain tujhe 🐛',
  'Tu itna tight khelega toh log sochenge AFK hai 💤',
  'Bhai poker hai, naukri nahi. Thoda risk le 🎰',
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
  'Abe chal hat, tere cards toh gande honge 🗑️',
  'Yeh banda har haath mein all-in karega kya?! 😂',
  'Bhai rehne de, tu nahi jeetega aaj 📉',
  'Kitna ghatiya khelta hai tu yaar 🤮',
  'Abe ullu, yeh kya move tha?! 🦉',
  'Paisa barbaad bc 💸',
];

const RAGEBAIT_ENGLISH_PHRASES = [
  "You call THAT a bet? My grandma plays harder at bingo 🧓",
  "Nice fold, coward. Were you scared of the flop or just life? 😱",
  "You're basically a charity at this point. Thanks for the donation 💝",
  "I've seen better poker from a random number generator 🤖",
  "Please keep playing like this. My rent depends on it 🏠",
  "Did you learn poker from a YouTube Shorts? 📱",
  "Your stack is shrinking faster than your confidence 📉",
  "That was the worst bluff since 'the check is in the mail' 📬",
  "Are you even looking at your cards or just vibing? 🧘",
  "Somewhere out there, a fish is calling YOU a fish 🐠",
  "You play poker like you parallel park — poorly and with too much confidence 🚗",
  "That call was so bad, even the dealer flinched 😬",
];

const GG_COMPLIMENTS = [
  'What a hand! 👏 Well played!',
  'Absolute masterclass. Take a bow 🎩',
  "GG! You're on fire 🔥",
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

export function registerBanterCommands(registry: CommandRegistry): void {
  registry.register('taunt' , (_command: ParsedCommand): CommandResult => {
    return {
      groupMessage: '😉',
    };
  });

  registry.register('ragebait' , (command: ParsedCommand): CommandResult => {
    const lang = command.args[0]?.toLowerCase();
    let pool: string[];

    if (lang === 'hindi' || lang === 'h') {
      pool = RAGEBAIT_PHRASES;
    } else if (lang === 'english' || lang === 'e') {
      pool = RAGEBAIT_ENGLISH_PHRASES;
    } else {
      // No arg or unrecognised → random from combined pool
      pool = [...RAGEBAIT_PHRASES, ...RAGEBAIT_ENGLISH_PHRASES];
    }

    const random = pool[Math.floor(Math.random() * pool.length)];
    return { groupMessage: random };
  });

  registry.register('needle', (_command: ParsedCommand): CommandResult => {
    const random = NEEDLE_PHRASES[Math.floor(Math.random() * NEEDLE_PHRASES.length)];
    return { groupMessage: random };
  });

  registry.register('tight', (_command: ParsedCommand): CommandResult => {
    const random = TIGHT_PHRASES[Math.floor(Math.random() * TIGHT_PHRASES.length)];
    return { groupMessage: random };
  });

  registry.register('gg', (_command: ParsedCommand): CommandResult => {
    const random = GG_COMPLIMENTS[Math.floor(Math.random() * GG_COMPLIMENTS.length)];
    return { groupMessage: random };
  });
}
