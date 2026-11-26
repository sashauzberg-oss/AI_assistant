// Offline helpers: unit and currency conversion parsing, and secure password generation.
// Pure functions (no DOM), so they can be unit-tested in Node.

// unit id -> [category, factor to the category's base unit, aliases]
const UNITS = {
  m: ["length", 1, ["m", "meter", "meters", "metre", "metres"]],
  km: ["length", 1000, ["km", "kms", "kilometer", "kilometers", "kilometre", "kilometres"]],
  cm: ["length", 0.01, ["cm", "centimeter", "centimeters", "centimetre", "centimetres"]],
  mm: ["length", 0.001, ["mm", "millimeter", "millimeters", "millimetre", "millimetres"]],
  mi: ["length", 1609.344, ["mi", "mile", "miles"]],
  yd: ["length", 0.9144, ["yd", "yds", "yard", "yards"]],
  ft: ["length", 0.3048, ["ft", "foot", "feet"]],
  in: ["length", 0.0254, ["in", "inch", "inches"]],
  nmi: ["length", 1852, ["nmi", "nautical mile", "nautical miles"]],
  kg: ["mass", 1, ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"]],
  g: ["mass", 0.001, ["g", "gram", "grams"]],
  mg: ["mass", 1e-6, ["mg", "milligram", "milligrams"]],
  lb: ["mass", 0.45359237, ["lb", "lbs", "pound", "pounds"]],
  oz: ["mass", 0.028349523125, ["oz", "ounce", "ounces"]],
  st: ["mass", 6.35029318, ["st", "stone", "stones"]],
  t: ["mass", 1000, ["t", "tonne", "tonnes", "metric ton", "metric tons"]],
  l: ["volume", 1, ["l", "liter", "liters", "litre", "litres"]],
  ml: ["volume", 0.001, ["ml", "milliliter", "milliliters", "millilitre", "millilitres"]],
  gal: ["volume", 3.785411784, ["gal", "gallon", "gallons"]],
  qt: ["volume", 0.946352946, ["qt", "quart", "quarts"]],
  pt: ["volume", 0.473176473, ["pt", "pint", "pints"]],
  cup: ["volume", 0.2365882365, ["cup", "cups"]],
  floz: ["volume", 0.0295735295625, ["fl oz", "floz", "fluid ounce", "fluid ounces"]],
  tbsp: ["volume", 0.01478676478125, ["tbsp", "tablespoon", "tablespoons"]],
  tsp: ["volume", 0.00492892159375, ["tsp", "teaspoon", "teaspoons"]],
  kmh: ["speed", 1 / 3.6, ["km/h", "kmh", "kph", "kilometers per hour", "kilometres per hour"]],
  mph: ["speed", 0.44704, ["mph", "miles per hour"]],
  mps: ["speed", 1, ["m/s", "meters per second", "metres per second"]],
  kn: ["speed", 0.514444, ["knot", "knots", "kn"]],
  m2: ["area", 1, ["m2", "m²", "sq m", "square meter", "square meters", "square metre", "square metres"]],
  km2: ["area", 1e6, ["km2", "km²", "sq km", "square kilometer", "square kilometers", "square kilometre", "square kilometres"]],
  ft2: ["area", 0.09290304, ["ft2", "ft²", "sq ft", "square foot", "square feet"]],
  mi2: ["area", 2589988.110336, ["mi2", "mi²", "sq mi", "square mile", "square miles"]],
  acre: ["area", 4046.8564224, ["acre", "acres"]],
  ha: ["area", 10000, ["ha", "hectare", "hectares"]],
  B: ["data", 1, ["b", "byte", "bytes"]],
  KB: ["data", 1024, ["kb", "kilobyte", "kilobytes"]],
  MB: ["data", 1024 ** 2, ["mb", "megabyte", "megabytes"]],
  GB: ["data", 1024 ** 3, ["gb", "gigabyte", "gigabytes"]],
  TB: ["data", 1024 ** 4, ["tb", "terabyte", "terabytes"]],
  sec: ["time", 1, ["s", "sec", "secs", "second", "seconds"]],
  min: ["time", 60, ["min", "mins", "minute", "minutes"]],
  hr: ["time", 3600, ["h", "hr", "hrs", "hour", "hours"]],
  day: ["time", 86400, ["day", "days"]],
  week: ["time", 604800, ["week", "weeks"]],
  year: ["time", 31557600, ["yr", "yrs", "year", "years"]],
  C: ["temperature", null, ["c", "°c", "celsius", "centigrade", "degrees c", "degrees celsius"]],
  F: ["temperature", null, ["f", "°f", "fahrenheit", "degrees f", "degrees fahrenheit"]],
  K: ["temperature", null, ["k", "kelvin", "kelvins"]],
};

const UNIT_NAMES = {
  m: "meters", km: "kilometers", cm: "centimeters", mm: "millimeters", mi: "miles", yd: "yards", ft: "feet", in: "inches",
  nmi: "nautical miles", kg: "kg", g: "grams", mg: "mg", lb: "pounds", oz: "ounces", st: "stone", t: "tonnes", l: "liters",
  ml: "ml", gal: "US gallons", qt: "quarts", pt: "pints", cup: "cups", floz: "fl oz", tbsp: "tablespoons", tsp: "teaspoons",
  kmh: "km/h", mph: "mph", mps: "m/s", kn: "knots", m2: "m²", km2: "km²", ft2: "sq ft", mi2: "sq mi", acre: "acres", ha: "hectares",
  B: "bytes", KB: "KB", MB: "MB", GB: "GB", TB: "TB", sec: "seconds", min: "minutes", hr: "hours", day: "days", week: "weeks",
  year: "years", C: "°C", F: "°F", K: "K",
};

const ALIASES = new Map();
for (const [id, [, , aliases]] of Object.entries(UNITS)) for (const a of aliases) ALIASES.set(a, id);

// Currencies with daily reference rates (Frankfurter / European Central Bank).
export const CURRENCIES = new Set(
  "AUD BGN BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF IDR ILS INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON SEK SGD THB TRY USD ZAR".split(" "),
);
const CURRENCY_WORDS = {
  $: "USD", dollar: "USD", dollars: "USD", bucks: "USD", "us dollars": "USD", "€": "EUR", euro: "EUR", euros: "EUR",
  "£": "GBP", "british pounds": "GBP", sterling: "GBP", "¥": "JPY", yen: "JPY", rupee: "INR", rupees: "INR", yuan: "CNY",
  rmb: "CNY", franc: "CHF", francs: "CHF", "swiss francs": "CHF", won: "KRW", peso: "MXN", pesos: "MXN", real: "BRL",
  reais: "BRL", "canadian dollars": "CAD", "australian dollars": "AUD", zloty: "PLN", lira: "TRY", rand: "ZAR",
  krona: "SEK", kronor: "SEK", krone: "NOK",
};

function currencyCode(word, otherIsCurrency) {
  const w = word.trim().toLowerCase();
  if (CURRENCIES.has(w.toUpperCase()) && w.length === 3) return w.toUpperCase();
  if (CURRENCY_WORDS[w]) return CURRENCY_WORDS[w];
  if ((w === "pound" || w === "pounds") && otherIsCurrency) return "GBP";
  return null;
}

function unitId(word) {
  const w = word.trim().toLowerCase().replace(/\.$/, "");
  return ALIASES.get(w) || ALIASES.get(w.replace(/^degrees? /, "")) || null;
}

function toKelvin(value, unit) {
  if (unit === "C") return value + 273.15;
  if (unit === "F") return ((value - 32) * 5) / 9 + 273.15;
  return value;
}
function fromKelvin(value, unit) {
  if (unit === "C") return value - 273.15;
  if (unit === "F") return ((value - 273.15) * 9) / 5 + 32;
  return value;
}

/**
 * "convert 5 miles to km", "100 f to c", "how many ounces in a pound", "$20 to euros".
 * Returns { kind: "unit", value, from, to, result, text } | { kind: "currency", amount, from, to } | null.
 */
export function parseConversion(input) {
  let s = String(input).toLowerCase().trim().replace(/[?!.]+$/, "");
  s = s.replace(/^(convert|what(?:'s| is)|how much is|how many is|change)\s+/, "");
  let amount;
  let fromWord;
  let toWord;
  let symbol = null;
  let m = s.match(/^how many\s+(.+?)\s+(?:are\s+)?(?:in|per)\s+(?:an?\s+|one\s+|(-?\d[\d,]*(?:\.\d+)?)\s*)?(.+)$/);
  if (m) {
    [, toWord, amount, fromWord] = m;
    amount = amount ?? "1";
  } else {
    m = s.match(/^([$€£¥])?\s*(-?\d[\d,]*(?:\.\d+)?|\.\d+)(?:\s*(.+?))?\s+(?:to|in|into|as)\s+(.+)$/);
    if (!m) return null;
    [, symbol, amount, fromWord, toWord] = m;
    if (!fromWord && !symbol) return null;
  }
  const value = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  toWord = toWord.trim();

  // Currency: a symbol ("$20") or currency words/codes on both sides ("20 usd to eur").
  const toIsCurrency = !!currencyCode(toWord, true);
  const fromCur = symbol ? currencyCode(symbol, true) : currencyCode(fromWord, toIsCurrency);
  const toCur = currencyCode(toWord, !!fromCur);
  if (fromCur && toCur) return { kind: "currency", amount: value, from: fromCur, to: toCur };
  if (!fromWord) return null;

  const from = unitId(fromWord);
  const to = unitId(toWord);
  if (!from || !to) return null;
  const [category] = UNITS[from];
  if (UNITS[to][0] !== category) return null;
  const result = category === "temperature" ? fromKelvin(toKelvin(value, from), to) : (value * UNITS[from][1]) / UNITS[to][1];
  return { kind: "unit", category, value, from, to, result, fromName: UNIT_NAMES[from], toName: UNIT_NAMES[to] };
}

/** A secure random password using the Web Crypto API (no modulo bias). */
/** What to say after "close all my tabs", from the desktop app's result. */
export function describeClosedTabs(result) {
  if (!result.ok) {
    if (result.error === "unsupported-platform") return "Closing all your tabs works in the Nova desktop app on Windows.";
    return "I couldn't close your tabs this time.";
  }
  const closed = result.closed.filter((c) => c.windows > 0);
  if (!closed.length) return "You don't have any browser windows open. 🙂";
  const names = closed.map((c) => c.browser);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  const windows = closed.reduce((n, c) => n + c.windows, 0);
  return `🗂️ Closed **${windows} ${list} window${windows === 1 ? "" : "s"}** with all their tabs. Changed your mind? Open the browser and press **Ctrl+Shift+T** to bring them back.`;
}

export function generatePassword({ length = 16, symbols = true } = {}) {
  const n = Math.max(8, Math.min(128, Math.round(length)));
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const syms = "!@#$%^&*-_=+?";
  const groups = symbols ? [lower, upper, digits, syms] : [lower, upper, digits];
  const all = groups.join("");
  const randomIndex = (max) => {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    for (;;) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
  };
  for (;;) {
    let out = "";
    for (let i = 0; i < n; i++) out += all[randomIndex(all.length)];
    if (groups.every((g) => [...out].some((c) => g.includes(c)))) return out;
  }
}
