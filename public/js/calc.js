// A safe calculator (no eval). Understands + - * / ^, parentheses, percentages,
// factorials, common functions, and spoken forms like "5 times 3" or "20% of 80".

const FUNCTIONS = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
};
const CONSTANTS = { pi: Math.PI, π: Math.PI, e: Math.E };

function normalize(input) {
  return String(input)
    .toLowerCase()
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(/[×x](?=\s*[\d(.])/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/√/g, "sqrt")
    .replace(/\bsquare root of\b/g, "sqrt")
    .replace(/\bcube root of\b/g, "cbrt")
    .replace(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\s+/g, "($1/100)*")
    .replace(/\bplus\b|\band\b/g, "+")
    .replace(/\bminus\b|\bless\b/g, "-")
    .replace(/\btimes\b|\bmultiplied by\b/g, "*")
    .replace(/\bdivided by\b|\bover\b/g, "/")
    .replace(/\bto the power of\b|\braised to\b/g, "^")
    .replace(/\bsquared\b/g, "^2")
    .replace(/\bcubed\b/g, "^3")
    .replace(/\bmod(?:ulo)?\b/g, " mod ")
    .replace(/\*\*/g, "^")
    .replace(/\?$/, "")
    .trim();
}

function tokenize(text) {
  const tokens = [];
  const re = /\s*(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+|[a-zπ]+|[-+*/^%!()])/gy;
  let match;
  let index = 0;
  while (index < text.length) {
    re.lastIndex = index;
    match = re.exec(text);
    if (!match) {
      if (/\s/.test(text[index])) {
        index++;
        continue;
      }
      throw new Error(`Unexpected "${text[index]}"`);
    }
    tokens.push(match[1]);
    index = re.lastIndex;
  }
  return tokens;
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error("Factorial needs a whole number from 0 to 170");
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isNumber = (t) => t !== undefined && /^(\d|\.\d)/.test(t);
  const startsPrimary = (t) => t !== undefined && (isNumber(t) || t === "(" || t in FUNCTIONS || t in CONSTANTS);

  function expression() {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = term();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }
  function term() {
    let value = unary();
    for (;;) {
      const t = peek();
      if (t === "*" || t === "/" || t === "mod" || t === "%") {
        next();
        const rhs = unary();
        if (t === "*") value *= rhs;
        else if (t === "/") {
          if (rhs === 0) throw new Error("Can't divide by zero");
          value /= rhs;
        } else value %= rhs;
      } else if (startsPrimary(t)) {
        value *= power(); // implicit multiplication: 2(3), 2pi
      } else {
        return value;
      }
    }
  }
  // Unary minus binds looser than ^, so -3^2 is -(3^2) = -9.
  function unary() {
    if (peek() === "-") {
      next();
      return -unary();
    }
    if (peek() === "+") {
      next();
      return unary();
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (peek() === "^") {
      next();
      return base ** unary();
    }
    return base;
  }
  function postfix() {
    let value = primary();
    for (;;) {
      if (peek() === "!") {
        next();
        value = factorial(value);
      } else if (peek() === "%" && !startsPrimary(tokens[pos + 1])) {
        next();
        value /= 100;
      } else {
        return value;
      }
    }
  }
  function primary() {
    const t = next();
    if (t === undefined) throw new Error("Incomplete expression");
    if (isNumber(t)) return Number(t);
    if (t in CONSTANTS) return CONSTANTS[t];
    if (t in FUNCTIONS) {
      const arg = peek() === "(" ? primary() : power();
      return FUNCTIONS[t](arg);
    }
    if (t === "(") {
      const value = expression();
      if (next() !== ")") throw new Error("Missing )");
      return value;
    }
    throw new Error(`Unexpected "${t}"`);
  }

  const value = expression();
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos]}"`);
  return value;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-9 && value !== 0)) return value.toExponential(6);
  return String(Number(value.toPrecision(12)));
}

/** Returns the computed number, or throws if the text isn't a valid expression. */
export function calculate(input) {
  const tokens = tokenize(normalize(input));
  if (!tokens.length) throw new Error("Nothing to calculate");
  const value = parse(tokens);
  if (!Number.isFinite(value)) throw new Error("The result isn't a finite number");
  return value;
}

/** True when the text looks like arithmetic rather than a sentence. */
export function looksLikeMath(input) {
  const text = normalize(input);
  if (!/\d/.test(text)) return false;
  if (!/[-+*/^%!]|\b(sqrt|cbrt|abs|ln|log|exp|sin|cos|tan|mod|round|floor|ceil)\b/.test(text)) return false;
  const words = text.match(/[a-z]+/g) || [];
  if (!words.every((w) => w in FUNCTIONS || w in CONSTANTS || w === "mod")) return false;
  try {
    calculate(input);
    return true;
  } catch {
    return false;
  }
}
