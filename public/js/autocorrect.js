// Auto-correct, like a phone keyboard: when you finish a word (space or punctuation),
// a misspelled word is replaced with the closest common English word.
// Backspace right after a fix undoes it, and Nova remembers not to change that word again.

// Contractions typed without the apostrophe, and a few classics.
const FIXES = {
  i: "I", im: "I'm", ive: "I've", dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't",
  isnt: "isn't", wasnt: "wasn't", werent: "weren't", arent: "aren't", havent: "haven't", hasnt: "hasn't", hadnt: "hadn't",
  couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", mustnt: "mustn't", youre: "you're", theyre: "they're",
  thats: "that's", whats: "what's", theres: "there's", heres: "here's", wheres: "where's", whos: "who's", hows: "how's",
  youve: "you've", weve: "we've", theyve: "they've", youll: "you'll", theyll: "they'll", itll: "it'll", shes: "she's",
  hes: "he's", alot: "a lot", aswell: "as well", infact: "in fact",
};

// The most common English words (and Nova's own command words) win close calls,
// so "realy" becomes "really", not "relay".
const COMMON = new Set(
  `the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one
  all would there their what so up out if about who get which go me when make can like time no just him know take people into year
  your good some could them see other than then now look only come its over think also back after use two how our work first well way
  even new want because any these give day most us really please thanks thank very much more many where why here should need feel
  try ask tell find help call keep let put mean seem leave show hear play run move live believe hold bring happen write sit stand lose
  pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win
  offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell
  require report decide pull great little long right old big high different small large next early young important few public bad
  same able last late hard real best better sure free full special easy clear recent certain personal open whole today tomorrow
  yesterday tonight morning evening night week month again still never always sometimes something nothing everything anything someone
  everyone thing things question answer weather music song songs timer alarm minutes minute seconds hours remind reminder translate
  explain note notes password joke clipboard focus pause next screen picture picture quiz homework friend friends family school house
  home water food money world life hand part place case point group problem fact number lot word words name idea story`.split(/\s+/),
);

// Neighbouring keys on a QWERTY keyboard: typos usually hit one of these.
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const NEIGHBORS = {};
ROWS.forEach((row, r) => {
  [...row].forEach((ch, c) => {
    const near = new Set();
    for (const dr of [-1, 0, 1]) {
      const other = ROWS[r + dr];
      if (!other) continue;
      for (const dc of [-1, 0, 1]) if (other[c + dc] && !(dr === 0 && dc === 0)) near.add(other[c + dc]);
    }
    NEIGHBORS[ch] = near;
  });
});

/** Optimal-string-alignment distance (edits, counting a swap of two letters as one), with an early exit. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

export const editDistance = distance;

function isSwap(a, b) {
  if (a.length !== b.length) return false;
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

function isNeighborSlip(a, b) {
  if (a.length !== b.length) return false;
  let found = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (found || !NEIGHBORS[a[i]]?.has(b[i])) return false;
    found = true;
  }
  return found;
}

/** "realy" -> "really": the candidate only adds a second copy of a letter. */
function missedDouble(typed, candidate) {
  for (let i = 0; i < candidate.length; i++) {
    if (candidate.slice(0, i) + candidate.slice(i + 1) === typed) return candidate[i] === candidate[i - 1] || candidate[i] === candidate[i + 1];
  }
  return false;
}

function matchCase(original, word) {
  if (word === "I" || word.startsWith("I'")) return word;
  return original[0] === original[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}

export class Corrector {
  /** `text` is public/data/words.txt: one line per frequency tier, "10 a ability able ...". */
  constructor(text) {
    this.rank = new Map();
    this.byLength = new Map();
    const tiers = [];
    for (const line of text.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const [tier, ...words] = line.trim().split(" ");
      tiers.push(Number(tier));
      const rank = tiers.length - 1; // 0 = most common
      for (const w of words) {
        if (this.rank.has(w)) continue;
        this.rank.set(w, rank);
        if (!this.byLength.has(w.length)) this.byLength.set(w.length, []);
        this.byLength.get(w.length).push([w, rank]);
      }
    }
    this.rarest = tiers.length - 1;
  }

  isKnown(word) {
    return this.rank.has(word.toLowerCase());
  }

  /** The correction for one word, or null if it looks fine (or Nova isn't sure). */
  suggest(word) {
    const lower = word.toLowerCase();
    if (FIXES[lower]) return matchCase(word, FIXES[lower]);
    if (lower.length < 3 || lower.length > 18 || this.rank.has(lower)) return null;
    if (word.length > 1 && word === word.toUpperCase()) return null; // NASA, LOL
    if (/(.)\1\1/.test(lower) || !/[aeiouy]/.test(lower)) return null; // "sooo", "hmm", "brr": on purpose
    const max = lower.length <= 5 ? 1 : 2;
    let best = null;
    let second = null;
    for (let len = lower.length - max; len <= lower.length + max; len++) {
      for (const [candidate, rank] of this.byLength.get(len) || []) {
        const d = distance(lower, candidate, max);
        if (d > max || (rank === this.rarest && d > 1)) continue;
        let score = d * 10 + rank * 1.5;
        const swap = d === 1 && isSwap(lower, candidate);
        if (candidate[0] !== lower[0] && !swap) score += 4;
        if (swap) score -= 3;
        else if (d === 1 && candidate.length === lower.length) score += isNeighborSlip(lower, candidate) ? -2 : 1;
        if (d === 1 && candidate.length === lower.length + 1 && missedDouble(lower, candidate)) score -= 1;
        if (COMMON.has(candidate)) score -= 3;
        const entry = { candidate, score, d };
        if (!best || score < best.score) {
          second = best;
          best = entry;
        } else if (!second || score < second.score) {
          second = entry;
        }
      }
    }
    if (!best) return null;
    if (best.d === 2 && second && second.score - best.score < 3) return null; // too close to call
    return matchCase(word, best.candidate);
  }

  /**
   * Correct the word that ends just before position `end` in `text`.
   * Returns { start, end, original, replacement } or null.
   */
  correctAt(text, end, { protect = () => false } = {}) {
    const before = text.slice(0, end);
    const m = before.match(/(^|[\s(“"'])([A-Za-z]+)$/);
    if (!m) return null;
    const original = m[2];
    const start = end - original.length;
    const token = before.slice(before.search(/\S*$/));
    if (/[@/\\:#_\d`{}<>=*]|\.\w/.test(token)) return null; // links, emails, code, numbers
    if (/`|=>|\{/.test(text)) return null; // looks like code
    if (/[A-Z]/.test(original.slice(1))) return null; // NASA, iPhone, McDonald
    if (protect(original)) return null;
    const replacement = this.suggest(original);
    if (!replacement || replacement === original) return null;
    return { start, end, original, replacement };
  }
}

let loading = null;
/** Load the dictionary once (about 60,000 words). */
export function loadCorrector(url = "data/words.txt") {
  loading ??= fetch(url)
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`dictionary: ${res.status}`))))
    .then((text) => new Corrector(text))
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

const BOUNDARY = /^[\s.,!?;:)\]]$/;

/**
 * Auto-correct a text box as the user types.
 * options: enabled() -> bool, protect(word) -> bool, onCorrect(fix), onUndo(fix)
 * Returns { flush() } to correct the last word before sending.
 */
export function attachAutocorrect(input, { enabled, protect, onCorrect, onUndo, onRevert }) {
  let corrector = null;
  let last = null; // the most recent fix, undoable with Backspace
  const ready = () => {
    if (!corrector && enabled()) loadCorrector().then((c) => (corrector = c), () => {});
    return corrector;
  };
  input.addEventListener("focus", ready);

  input.addEventListener("input", (e) => {
    const typed = e.data;
    // A letter right after a "." that triggered a fix means it was a link or abbreviation
    // ("exmaple.com"), so quietly put the original word back.
    if (last && last.typed === "." && e.inputType === "insertText" && /^[A-Za-z0-9]$/.test(typed || "")) {
      const expected = last.after.slice(0, last.afterCaret) + typed + last.after.slice(last.afterCaret);
      if (input.value === expected && input.selectionStart === last.afterCaret + 1) {
        input.value = last.before.slice(0, last.beforeCaret) + typed + last.before.slice(last.beforeCaret);
        input.setSelectionRange(last.beforeCaret + 1, last.beforeCaret + 1);
        const fix = last;
        last = null;
        onRevert?.(fix);
        return;
      }
    }
    if (!enabled() || e.inputType !== "insertText" || !typed || !BOUNDARY.test(typed) || !ready()) {
      last = null;
      return;
    }
    const caret = input.selectionStart;
    const fix = corrector.correctAt(input.value, caret - typed.length, { protect });
    if (!fix) {
      last = null;
      return;
    }
    const value = input.value;
    input.value = value.slice(0, fix.start) + fix.replacement + value.slice(fix.end);
    const shift = fix.replacement.length - fix.original.length;
    input.setSelectionRange(caret + shift, caret + shift);
    last = { ...fix, typed, before: value, beforeCaret: caret, after: input.value, afterCaret: caret + shift };
    onCorrect?.(last);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Backspace" || !last) return;
    if (input.value !== last.after || input.selectionStart !== last.afterCaret || input.selectionEnd !== last.afterCaret) return;
    e.preventDefault();
    undo();
  });

  function undo() {
    if (!last) return;
    const fix = last;
    // Put the original word back (Backspace also removes the space or punctuation typed after it).
    input.value = fix.before.slice(0, fix.beforeCaret - 1) + fix.before.slice(fix.beforeCaret);
    input.setSelectionRange(fix.beforeCaret - 1, fix.beforeCaret - 1);
    last = null;
    onUndo?.(fix);
  }

  return {
    undo,
    /** Correct the final word (no space typed after it yet), e.g. right before sending. */
    flush() {
      if (!enabled() || !ready()) return null;
      const value = input.value;
      const end = value.replace(/\s+$/, "").length;
      const fix = corrector.correctAt(value, end, { protect });
      if (!fix) return null;
      input.value = value.slice(0, fix.start) + fix.replacement + value.slice(fix.end);
      return fix;
    },
  };
}
