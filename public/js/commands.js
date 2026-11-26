// Turns what the user typed or said into a command, without any AI.
// Used for instant actions ("music", "stop", "next") and as the whole brain in offline mode.
// Pure functions only (no DOM), so it can be unit-tested in Node.
import { looksLikeMath } from "./calc.js";
import { parseConversion } from "./extras.js";
import { editDistance } from "./autocorrect.js";

const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45, fifty: 50,
  sixty: 60, ninety: 90, couple: 2, few: 3,
};
const WORDS = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join("|");
// A number (digits or words), an optional "of", a unit, and an optional "and a half".
const DURATION_RE = new RegExp(
  `(?:(?<![\\d.])(?<num>\\d+(?:\\.\\d+)?)|\\b(?<word>${WORDS}))(?:\\s*of)?\\s*-?\\s*` +
    "(?<unit>hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])(?<half>\\s+and\\s+a\\s+half)?",
  "g",
);

function toNumber(word) {
  return word in WORD_NUMBERS ? WORD_NUMBERS[word] : Number(word);
}

function unitSeconds(unit) {
  if (/^h/.test(unit)) return 3600;
  if (/^m/.test(unit)) return 60;
  return 1;
}

/** "5 minutes", "1h30m", "an hour and a half", "90 sec", "1:30" -> seconds (or null). */
export function parseDuration(text) {
  let s = ` ${String(text).toLowerCase()} `;
  let total = 0;
  let found = false;
  if (/\bhalf an? hour\b/.test(s)) {
    total += 1800;
    found = true;
    s = s.replace(/\bhalf an? hour\b/, " ");
  }
  for (const m of s.matchAll(DURATION_RE)) {
    const { num, word, unit, half } = m.groups;
    const seconds = unitSeconds(unit);
    total += toNumber(num ?? word) * seconds + (half ? seconds / 2 : 0);
    found = true;
  }
  if (!found) {
    const clock = s.match(/\b(\d{1,2}):(\d{2})\b/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const bare = s.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
    if (bare) return Number(bare[1]) * 60; // "timer 5" means five minutes
    return null;
  }
  return total > 0 ? Math.round(total) : null;
}

/** Seconds from `now` until the next h:mm (12- or 24-hour clock). */
export function secondsUntil(hours, minutes = 0, meridiem = "", now = new Date()) {
  let h = hours % 24;
  const ampm = meridiem.replace(/\./g, "").toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  const candidates = [h];
  if (!ampm && hours <= 12) candidates.push((h + 12) % 24);
  let best = Infinity;
  for (const hour of candidates) {
    const target = new Date(now);
    target.setHours(hour, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    best = Math.min(best, (target - now) / 1000);
  }
  return Math.round(best);
}

const SITES = {
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  gmail: "https://mail.google.com",
  email: "https://mail.google.com",
  mail: "https://mail.google.com",
  maps: "https://www.google.com/maps",
  "google maps": "https://www.google.com/maps",
  drive: "https://drive.google.com",
  "google drive": "https://drive.google.com",
  docs: "https://docs.google.com",
  calendar: "https://calendar.google.com",
  translate: "https://translate.google.com",
  "google translate": "https://translate.google.com",
  news: "https://news.google.com",
  netflix: "https://www.netflix.com",
  spotify: "https://open.spotify.com",
  facebook: "https://www.facebook.com",
  instagram: "https://www.instagram.com",
  twitter: "https://x.com",
  x: "https://x.com",
  reddit: "https://www.reddit.com",
  wikipedia: "https://www.wikipedia.org",
  amazon: "https://www.amazon.com",
  github: "https://github.com",
  linkedin: "https://www.linkedin.com",
  tiktok: "https://www.tiktok.com",
  twitch: "https://www.twitch.tv",
  discord: "https://discord.com/app",
  whatsapp: "https://web.whatsapp.com",
  outlook: "https://outlook.live.com",
  pinterest: "https://www.pinterest.com",
  ebay: "https://www.ebay.com",
  claude: "https://claude.ai",
};

export function resolveSite(name) {
  const key = name.toLowerCase().replace(/^(the|my)\s+/, "").replace(/\s+(website|site|app|page)$/, "").trim();
  if (SITES[key]) return { url: SITES[key], name: key };
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(key)) return { url: `https://${key}`, name: key };
  if (/^https?:\/\//.test(key)) return { url: key, name: key };
  return { url: `https://duckduckgo.com/?q=${encodeURIComponent(`!ducky ${key}`)}`, name: key };
}

/** Lowercase, strip wake words, politeness and trailing punctuation. */
export function normalizeCommand(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^(hey|ok|okay|yo)[,\s]+/, "")
    .replace(/^nova\b[,:\s]*/, "")
    .replace(/^(please|can you|could you|would you|will you|i want you to|i'd like you to)\s+/, "")
    .replace(/^(please)\s+/, "")
    .replace(/[\s,]+please$/, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

const SCREEN_RE =
  /\b(answer|solve|do|explain|translate|summari[sz]e) (this|that|it|these|the question|this question|my question|the problem|this problem)\b|\bwhat('s| is) (this|on my screen)\b|\b(look at|read|check|see|scan) (my|the|this) screen\b|\b(screenshot|snip)\b|\bwhat does (this|it) say\b|\bhelp me with this\b/;

function parseExact(input) {
  const s = normalizeCommand(input);
  if (!s) return null;
  let m;

  if (/^(help|commands|what can you do|what can i say|\?)$/.test(s)) return { name: "help" };

  // ----- the pet -----
  const PET_WORDS = { cat: "cat", kitty: "cat", kitten: "cat", dog: "dog", puppy: "dog", doggo: "dog", bunny: "bunny", rabbit: "bunny", fox: "fox", frog: "frog", penguin: "penguin", panda: "panda", owl: "owl", hamster: "hamster", duck: "duck", duckling: "duck", chick: "duck", axolotl: "axolotl", dragon: "dragon", unicorn: "unicorn", pig: "pig", piggy: "pig", koala: "koala", turtle: "turtle", tortoise: "turtle", octopus: "octopus", raccoon: "raccoon", bear: "bear", teddy: "bear", hedgehog: "hedgehog", capybara: "capybara", sheep: "sheep", lamb: "sheep", shark: "shark", lion: "lion" };
  const petWord = `(${Object.keys(PET_WORDS).join("|")})`;
  if ((m = s.match(new RegExp(`^(?:change|switch|turn)(?: my| the| your)?(?: pet| buddy| self|self)?(?: in)?(?: to| into) (?:a |an )?${petWord}s?$|^(?:be|become) (?:a |an )?${petWord}$|^(?:i want|give me|get me) (?:a |an )?${petWord}(?: pet)?$|^${petWord} (?:pet|mode)$`)))) {
    return { name: "pet", args: { kind: PET_WORDS[m.slice(1).find(Boolean)] } };
  }
  if (/^(change|choose|pick|switch|new)( my| the| your)? (pet|buddy|animal)$|^pets?$|^change pet$/.test(s)) return { name: "pet_picker" };
  if ((m = String(input).trim().match(/^(?:(?:hey )?nova[,\s]+)?(?:rename (?:my |the )?pet(?: to)?|call yourself|your name is now|i'?ll call you|name (?:my pet|the pet|you))\s+(.+?)[.!]*$/i))) {
    return { name: "pet_name", args: { name: m[1].trim() } };
  }
  // ----- riding the cursor: "get on", "ride my cursor", "get off"
  const pointer = "(?:my |the |your )?(?:cursor|mouse|pointer|arrow)";
  if (new RegExp(`^(?:get|hop|climb|jump|sit|ride)(?: back)? on(?:to)?(?: ${pointer})?$|^ride ${pointer}$|^(?:get|hop|climb|jump|sit) on(?:to)? ${pointer}$|^${pointer} ride$`).test(s)) {
    return { name: "ride", args: { on: true } };
  }
  if (new RegExp(`^(?:get|hop|climb|jump) (?:off|down)(?: (?:of )?${pointer})?$|^(?:stop riding(?: ${pointer})?|come back|come down)$`).test(s)) {
    return { name: "ride", args: { on: false } };
  }

  // ----- the fight scene: "fight scene", "epic battle", "fight a dragon", "battle against the shark"
  const fight = "(?:fight|battle|duel|showdown|brawl)";
  const foe = `(?:a |an |the |some )?(?:evil |angry |mean |wild |giant |big )?${petWord}s?`;
  if (
    (m = s.match(
      new RegExp(
        `^(?:start |play |show(?: me)? |do |have |let'?s (?:have |do |see )?|i want(?: to see)? )?(?:a |an |the )?(?:epic |pet |big |boss |final )*${fight}(?: scene| time| mode)?(?: (?:with|against|vs|versus) ${foe})?$` +
          `|^(?:fight|battle|duel) ${foe}$|^${petWord}s? (?:fight|battle)(?: scene)?$`,
      ),
    ))
  ) {
    const word = m.slice(1).find(Boolean);
    return { name: "fight", args: { foe: word ? PET_WORDS[word] : "" } };
  }
  if (/^(clear|clear (the )?chat|new chat|start over|reset)$/.test(s)) return { name: "clear" };
  if (/\b(copy|grab|extract|get|read) (the |all the )?text (from|on|off) (my |the |this )?(screen|window|page|image)\b|^(copy|extract) text$/.test(s)) {
    return { name: "answer_screen", args: { mode: "text" } };
  }
  if (SCREEN_RE.test(s)) {
    const mode = /^translate|\btranslate (this|that|it)\b/.test(s) ? "translate" : /\b(explain|summari[sz]e)\b|what('s| is) (this|on my screen)/.test(s) ? "explain" : "answer";
    return { name: "answer_screen", args: { mode } };
  }
  if (/^copy (that|it|this|the answer|your answer|the last answer|the reply)$/.test(s)) return { name: "copy_last" };

  // ----- music controls -----
  if (/^(stop|stop (the )?music|stop playing|stop the radio|silence|shut up|be quiet|quiet|turn (it|the music) off|music off)$/.test(s)) {
    return { name: "music_control", args: { action: "stop" } };
  }
  if (/^(pause|pause (the )?(music|song|radio)|hold on)$/.test(s)) return { name: "music_control", args: { action: "pause" } };
  if (/^(resume|unpause|continue|play|keep playing|resume (the )?(music|song|radio)|continue (the )?(music|song))$/.test(s)) {
    return { name: "music_control", args: { action: "resume" } };
  }
  if (/^(next|skip|skip it|next (one|song|track|station)|skip (this )?(one|song|track|station)|change (the )?(song|station)|another (one|song|station))$/.test(s)) {
    return { name: "music_control", args: { action: "next" } };
  }
  if (/^(volume up|louder|turn it up|turn up the (music|volume)|increase (the )?volume)$/.test(s)) {
    return { name: "music_control", args: { action: "volume", delta: 15 } };
  }
  if (/^(volume down|quieter|softer|turn it down|turn down the (music|volume)|lower (the )?volume|decrease (the )?volume)$/.test(s)) {
    return { name: "music_control", args: { action: "volume", delta: -15 } };
  }
  if (/^mute$/.test(s)) return { name: "music_control", args: { action: "volume", volume: 0 } };
  if ((m = s.match(/^(?:set (?:the )?)?volume (?:to |at )?(\d{1,3})\s*%?$/))) {
    return { name: "music_control", args: { action: "volume", volume: Math.min(100, Number(m[1])) } };
  }

  // ----- YouTube -----
  if ((m = s.match(/^(?:play|watch|search|find|show me|put on)?\s*(.+?) on youtube$/)) || (m = s.match(/^youtube\s+(.+)$/))) {
    return { name: "youtube", args: { query: m[1] } };
  }

  // ----- stopwatch & focus sessions -----
  if (/^(start|begin|run)( a| the)? stopwatch$|^stopwatch$/.test(s)) return { name: "stopwatch", args: { action: "start" } };
  if (/^(stop|pause|end|check)( the)? stopwatch$/.test(s)) return { name: "stopwatch", args: { action: "stop" } };
  if (/^(reset|clear|cancel)( the)? stopwatch$/.test(s)) return { name: "stopwatch", args: { action: "reset" } };
  if ((m = s.match(/^(?:start (?:a |an )?|begin (?:a )?)?(?:focus|pomodoro|study|deep work)(?: mode| session| timer)?(?: (?:for|of) (.+))?$/))) {
    return { name: "focus", args: { seconds: (m[1] && parseDuration(m[1])) || 25 * 60 } };
  }

  // ----- passwords -----
  if (/^(generate|make|create|give me|suggest|i need)( me)? (a |an )?((new|strong|secure|random|good|long|short|\d+[- ]?(char|character|letter)s?( long)?)[ -]+)*password( with(out)? (symbols|special characters))?$|^(new |random )?password$/.test(s)) {
    const len = s.match(/(\d{1,3})(?:[- ]?(?:char|character|letter|digit)s?)?/);
    return { name: "password", args: { length: len ? Number(len[1]) : 16, symbols: !/\b(no|without) (symbols|special)/.test(s) } };
  }

  // ----- memory -----
  if ((m = String(input).trim().match(/^(?:(?:hey )?nova[,\s]+)?remember(?: that)?[:,\s]+(.+)$/i))) {
    return { name: "memory_add", args: { text: m[1].trim().replace(/[.!]+$/, "") } };
  }
  if (/^(what do you remember|what do you know about me|(show|list) (your |my )?memor(y|ies)|memories)$/.test(s)) return { name: "memory_list" };
  if (/^forget (everything|all|all memories|everything you know about me)$/.test(s)) return { name: "memory_clear" };
  if ((m = s.match(/^forget (?:that |about )?(.+)$/))) return { name: "memory_forget", args: { text: m[1] } };

  // ----- timers & alarms -----
  if (/^(cancel|stop|clear|delete) (all )?(the |my )?(timers?|alarms?|reminders?)$/.test(s)) return { name: "cancel_timers" };
  if (/^((show|list|check) )?(my )?(timers?|alarms?|reminders?)$/.test(s) || /^how much time (is )?left/.test(s)) {
    return { name: "list_timers" };
  }
  if ((m = s.match(/^remind me (?:in|after) (.+?) (?:to|that|about) (.+)$/))) {
    const seconds = parseDuration(m[1]);
    if (seconds) return { name: "timer", args: { seconds, label: m[2] } };
  }
  if ((m = s.match(/^remind me (?:to |about )?(.+?) in (.+)$/))) {
    const seconds = parseDuration(m[2]);
    if (seconds) return { name: "timer", args: { seconds, label: m[1] } };
  }
  if ((m = s.match(/^(?:set (?:an? )?|wake me up |remind me )?(?:alarm )?(?:for |at )(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?:\s+(?:to|for)\s+(.+))?$/))
    && /alarm|wake|remind/.test(s)) {
    return {
      name: "alarm",
      args: { hours: Number(m[1]), minutes: Number(m[2] || 0), meridiem: m[3] || "", label: m[4] || "Alarm" },
    };
  }
  if (/\b(timer|countdown)\b/.test(s)) {
    const rest = s.replace(/\b(set|start|a|an|timer|countdown|for|me)\b/g, " ");
    const labelMatch = s.match(/\b(?:for|called|named|labeled)\s+(?:the\s+)?([a-z][a-z ]+)$/);
    const seconds = parseDuration(rest);
    if (seconds) {
      const label = labelMatch && !parseDuration(labelMatch[1]) ? labelMatch[1] : "Timer";
      return { name: "timer", args: { seconds, label } };
    }
  }

  // ----- music: play something -----
  if (/^(music|songs?|tunes|radio|some music|play (some )?music|play something|play a song|put on (some )?music|i want (to hear )?(some )?music)$/.test(s)) {
    return { name: "music_play", args: { query: "" } };
  }
  if ((m = s.match(/^(?:play|put on|start playing|listen to|i want to (?:hear|listen to)|turn on|blast)\s+(.+)$/))) {
    return { name: "music_play", args: { query: m[1] } };
  }
  if ((m = s.match(/^(.+?) (music|songs|radio|playlist)$/)) && m[1].split(" ").length <= 4 && !/^(what|who|how|why|where|when)\b/.test(m[1])) {
    return { name: "music_play", args: { query: m[1] } };
  }

  // ----- time & date -----
  if (/^(what('s| is) the )?time( is it)?( now| right now)?$|^what time is it|^(the )?current time$/.test(s)) return { name: "time" };
  if (/^(what('s| is) )?(the |today's )?date( today)?$|^what day is (it|today)|^what's today|^what is today/.test(s)) return { name: "date" };

  // ----- weather -----
  if ((m = s.match(/\b(?:weather|forecast|temperature|how (?:hot|cold|warm) is it|is it (?:going to )?(?:rain|snow)(?:ing)?)\b(?:\s+(?:like\s+)?(?:today\s+|tomorrow\s+|now\s+)?(?:in|for|at|near)\s+(.+?))?(?:\s+(?:today|tomorrow|now|this week|right now))?$/))) {
    return { name: "weather", args: { location: (m[1] || "").trim() } };
  }

  // ----- fun -----
  if (/\b(joke|make me laugh|something funny|cheer me up)\b/.test(s)) return { name: "joke" };
  if (/\b(flip a coin|coin flip|toss a coin|heads or tails)\b/.test(s)) return { name: "coin" };
  if ((m = s.match(/\broll (?:a |an |(\d+) )?(?:(\d+)-sided )?(?:dice|die|d(\d+))\b/))) {
    return { name: "dice", args: { count: Math.min(10, Number(m[1] || 1)), sides: Number(m[2] || m[3] || 6) } };
  }
  if ((m = s.match(/\b(?:random number|pick a number)(?: (?:between|from) (-?\d+) (?:and|to) (-?\d+))?/))) {
    return { name: "random", args: { min: Number(m[1] ?? 1), max: Number(m[2] ?? 100) } };
  }

  // ----- notes / to-do -----
  if ((m = s.match(/^(?:add|put) (.+?) (?:to|on) (?:my |the )?(?:list|notes|to-?do(?: list)?|shopping list|grocery list)$/))) {
    return { name: "note_add", args: { text: m[1] } };
  }
  if ((m = String(input).trim().match(/^(?:(?:take|make|write) (?:a )?note|note|jot down)[:\s,]+(.+)$/i))) {
    return { name: "note_add", args: { text: m[1].trim() } };
  }
  if (/^(clear|delete|erase) (all )?(my |the )?(notes|list|to-?do list)$/.test(s)) return { name: "note_clear" };
  if ((m = s.match(/^(?:delete|remove|cross off) (?:note |item |number )?#?(\d+)(?: from (?:my |the )?(?:list|notes))?$/))) {
    return { name: "note_remove", args: { index: Number(m[1]) } };
  }
  if (/^((show|list|read|open|see|check) )?(me )?(my |the )?(notes|list|to-?do(s| list)?|shopping list|grocery list)$|^what('s| is) on my list$|^what are my notes$/.test(s)) {
    return { name: "note_list" };
  }

  // ----- appearance -----
  if ((m = s.match(/\b(dark|light|night|day) (mode|theme)\b/))) {
    return { name: "theme", args: { theme: m[1] === "dark" || m[1] === "night" ? "dark" : "light" } };
  }

  // ----- web -----
  if ((m = s.match(/^(?:open|go to|launch|visit|take me to|bring up)\s+(.+)$/))) return { name: "open", args: resolveSite(m[1]) };
  if ((m = s.match(/^(?:search(?: the web| google| online)?(?: for)?|google|look up|bing)\s+(.+)$/))) return { name: "search", args: { query: m[1] } };

  // ----- speech -----
  if ((m = String(input).trim().match(/^(?:nova[,\s]+)?(?:say|repeat after me|repeat)[:,\s]+(.+)$/i))) return { name: "say", args: { text: m[1] } };

  // ----- dictionary -----
  if ((m = s.match(/^(?:define|definition of|meaning of|what's the meaning of|what is the meaning of)\s+(?:the word\s+)?([a-z'-]+)$/)) ||
      (m = s.match(/^what does (?:the word )?([a-z'-]+) mean$/))) {
    return { name: "define", args: { word: m[1] } };
  }

  // ----- unit & currency conversion -----
  const conversion = parseConversion(s);
  if (conversion) return { name: "convert", args: conversion };

  // ----- math -----
  const mathText = s.replace(/^(what('s| is)|calculate|calc|compute|solve|how much is|evaluate)\s+/, "").replace(/=\s*$/, "");
  if (looksLikeMath(mathText)) return { name: "calc", args: { expression: mathText } };

  // ----- small talk -----
  if (/^(hi|hello|hey|hiya|howdy|yo|sup|good (morning|afternoon|evening))\b/.test(s)) return { name: "greet" };
  if (/^(thanks|thank you|thx|ty|cheers)\b/.test(s)) return { name: "thanks" };
  if (/^how are you/.test(s)) return { name: "how_are_you" };
  if (/^(who|what) are you$|^what('s| is) your name$/.test(s)) return { name: "about" };

  // ----- encyclopedia -----
  if ((m = s.match(/^(?:who|what|where) (?:is|was|are|were) (?:a |an |the )?(.+)$/)) ||
      (m = s.match(/^(?:tell me about|wiki(?:pedia)?|look up|info on|information about)\s+(.+)$/))) {
    return { name: "wiki", args: { query: m[1] } };
  }

  return null;
}

// ---------------------------------------------------------------- understanding typos

// Words Nova's built-in commands care about. A slightly misspelled one ("plya", "tiemr",
// "wether") is matched to the closest of these when a message isn't understood as typed.
const GENRE_WORDS = `jazz lofi classical christmas rock pop chill chillhop relaxing relax study studying focus sleep sleeping ambient piano
  country metal reggae techno house dance party workout happy sad indie blues rap hiphop soul funk folk acoustic electronic dubstep
  bossa lounge retro romantic halloween spooky kpop jpop anime latin gospel oldies disco trance`.split(/\s+/);
const VOCAB = new Set([
  ...`play music song songs radio stop pause resume continue next skip volume louder quieter mute unmute timer timers alarm alarms
  remind reminder minutes minute seconds second hours hour cancel weather forecast temperature joke jokes flip coin roll dice random
  number note notes list shopping remember forget password generate stopwatch pomodoro focus start open search google youtube define
  meaning translate explain answer solve screen screenshot copy clipboard convert calculate time date today tomorrow help clear dark
  light mode theme pet change switch become rename what weather miles kilometers meters centimeters feet inches pounds ounces grams
  fight battle scene duel epic cursor mouse pointer ride hop climb
  kilograms celsius fahrenheit gallons liters dollars euros`.split(/\s+/),
  ...GENRE_WORDS,
  ..."cat dog bunny rabbit fox frog penguin panda owl hamster duck axolotl dragon unicorn pig koala turtle octopus raccoon bear hedgehog capybara sheep shark lion".split(" "),
]);

/** The closest vocabulary word for a misspelled word, or the word itself. */
function fuzzWord(word, vocab, isWord) {
  if (word.length < 3 || /[^a-z]/.test(word) || vocab.has(word) || isWord?.(word)) return word;
  const max = word.length >= 7 ? 2 : 1; // short words may only be off by one letter
  let best = null;
  let tie = false;
  for (const candidate of vocab) {
    if (Math.abs(candidate.length - word.length) > max) continue;
    let d = editDistance(word, candidate, max);
    // Scrambled letters ("mucis" -> "music") count as a near miss.
    if (d > max && word.length >= 4 && word.length === candidate.length && word[0] === candidate[0] && [...word].sort().join("") === [...candidate].sort().join("")) d = max;
    if (d > max || (d > 1 && candidate[0] !== word[0])) continue;
    const score = d * 10 + (candidate[0] === word[0] ? 0 : 5);
    if (!best || score < best.score) {
      best = { candidate, score };
      tie = false;
    } else if (score === best.score && candidate !== best.candidate) {
      tie = true;
    }
  }
  return best && !tie ? best.candidate : word;
}

/** "play jaz" -> "play jazz": fix a slightly misspelled genre in a short music request. */
function fixMusicQuery(command, isWord) {
  if (command?.name !== "music_play" || !command.args.query) return command;
  const words = command.args.query.split(/\s+/);
  if (words.length > 3) return command;
  const genres = new Set([...GENRE_WORDS, "music", "songs", "song", "radio", "something"]);
  const fixed = words.map((w) => fuzzWord(w, genres, isWord)).join(" ");
  if (fixed === command.args.query) return command;
  // "play msic" -> just "music": play right away, like typing "music".
  const generic = fixed.split(" ").every((w) => ["music", "songs", "song", "radio", "some", "something"].includes(w));
  return { ...command, args: { query: generic ? "" : fixed }, understood: `play ${fixed}` };
}

/**
 * Understands what the user typed or said. Returns { name, args } or null.
 * If the text isn't understood as typed, misspelled command words are matched to the closest
 * known word and Nova tries again; then the result carries `understood` (the text it went with).
 * options.isWord(word): true for real dictionary words, which are never "corrected".
 */
export function parseCommand(input, { isWord } = {}) {
  const exact = parseExact(input);
  if (exact) return fixMusicQuery(exact, isWord);
  const s = normalizeCommand(input);
  if (!s) return null;
  // Capitalized words after the first are names ("Paris", "Adele"): never change those.
  const names = new Set(
    String(input)
      .trim()
      .split(/\s+/)
      .slice(1)
      .filter((w) => /^[A-Z]/.test(w))
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, "")),
  );
  const fixed = s
    .split(/\s+/)
    .map((w) => (names.has(w) ? w : fuzzWord(w, VOCAB, isWord)))
    .join(" ");
  if (fixed === s) return null;
  const again = parseExact(fixed);
  return again ? { ...fixMusicQuery(again, isWord), understood: fixed } : null;
}

/** Commands that run instantly in the browser even when the AI is available. */
export function isInstant(command) {
  if (!command) return false;
  const instant = ["music_control", "help", "clear", "theme", "cancel_timers", "list_timers", "copy_last", "stopwatch", "focus", "password", "convert", "pet", "pet_picker", "pet_name", "fight", "ride"];
  if (instant.includes(command.name)) return true;
  return command.name === "music_play" && command.args.query === "";
}
