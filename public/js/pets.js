// Nova's pixel pets: 16×16 sprites drawn in code, with blink and talk frames.
// Each sprite row is a string; every character is one pixel ("." is transparent).

export const PETS = {
  cat: {
    name: "Mochi",
    animal: "cat",
    sound: "Meow!",
    palette: { o: "#3b2a20", O: "#f4a340", d: "#d9822b", w: "#fff4e6", p: "#ff8fab", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "..oo........oo..",
      ".oOOo......oOOo.",
      ".oOpOooooooOpOo.",
      "oOOOOOdOOdOOOOOo",
      "oOOOOOOOOOOOOOOo",
      "oOOkhOOOOOOkhOOo",
      "oOOkkOOOOOOkkOOo",
      "oOpOwwwppwwwOpOo",
      "oOOOwwkwwkwwOOOo",
      ".oOOOwwkkwwOOOo.",
      "..ooOOOOOOOOoo..",
      "..oOOwwwwwwOOo..",
      ".oOOOwwwwwwOOOoo",
      ".oOOOwwwwwwOOOdo",
      ".oOwwOOOOOOwwOo.",
      "..oooooooooooo..",
    ],
    blink: [[5, 3, "O"], [5, 4, "O"], [5, 11, "O"], [5, 12, "O"]],
    talk: [[8, 7, "k"], [8, 8, "k"], [9, 7, "p"], [9, 8, "p"]],
  },
  dog: {
    name: "Biscuit",
    animal: "dog",
    sound: "Woof!",
    palette: { o: "#3a2618", C: "#f6dfb5", B: "#a0612d", w: "#ffffff", p: "#ff8fab", k: "#1b1b2f", h: "#ffffff", n: "#2b1d14" },
    rows: [
      "....oooooooo....",
      "...oCCCCCCCCo...",
      ".ooCCCCCCCCCCoo.",
      "oBBoCCCCCCCCoBBo",
      "oBBCkhCCCCkhCBBo",
      "oBBCkkCCCCkkCBBo",
      "oBBpCCCnnCCCpBBo",
      "oBBCCCkCCkCCCBBo",
      ".oBBoCCkkCCoBBo.",
      "..oo.oCCCCo.oo..",
      "....oCCCCCCo....",
      "...oCCwwwwCCo...",
      "..oCCCwwwwCCCooo",
      "..oCCCwwwwCCCoBo",
      "..oCwwCCCCwwCo..",
      "...oooooooooo...",
    ],
    blink: [[4, 4, "C"], [4, 5, "C"], [4, 10, "C"], [4, 11, "C"]],
    talk: [[7, 7, "k"], [7, 8, "k"], [8, 7, "p"], [8, 8, "p"]],
  },
  bunny: {
    name: "Clover",
    animal: "bunny",
    sound: "*nose wiggle*",
    palette: { o: "#4a4a68", W: "#fbfbff", g: "#dcdcef", p: "#ff9ec0", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      "...oo......oo...",
      "..oWWo....oWWo..",
      "..oWpo....opWo..",
      "..oWpo....opWo..",
      "..oWpo....opWo..",
      "..oWWoooooooWWo.",
      ".oWWWWWWWWWWWWo.",
      "oWWWWWWWWWWWWWWo",
      "oWWkhWWWWWWkhWWo",
      "oWWkkWWWWWWkkWWo",
      "oWpWWWWppWWWWpWo",
      "oWWWWWkWWkWWWWWo",
      ".oWWWWWkkWWWWWo.",
      "..ooWWWWWWWWoo..",
      ".oWWWgWWWWgWWWo.",
      "..oooooooooooo..",
    ],
    blink: [[8, 3, "W"], [8, 4, "W"], [8, 11, "W"], [8, 12, "W"]],
    talk: [[11, 7, "k"], [11, 8, "k"], [12, 7, "p"], [12, 8, "p"]],
  },
  fox: {
    name: "Ember",
    animal: "fox",
    sound: "Yip!",
    palette: { o: "#3a1f14", F: "#f07f2e", w: "#fff7ec", k: "#1b1b2f", h: "#ffffff", p: "#ff8fab" },
    rows: [
      ".o............o.",
      ".oo..........oo.",
      ".oFo........oFo.",
      ".oFFo......oFFo.",
      ".oFFFooooooFFFo.",
      "oFFFFFFFFFFFFFFo",
      "oFFFFFFFFFFFFFFo",
      "oFFkhFFFFFFkhFFo",
      "oFwkkFFFFFFkkwFo",
      "owwwwwFkkFwwwwwo",
      ".owwwwkwwkwwwwo.",
      "..oowwwkkwwwoo..",
      "....oFFFFFFo.oo.",
      "...oFFwwwwFFoFFo",
      "...oFwwFFwwFoFwo",
      "....ooooooooooo.",
    ],
    blink: [[7, 3, "F"], [7, 4, "F"], [7, 11, "F"], [7, 12, "F"]],
    talk: [[10, 7, "k"], [10, 8, "k"], [11, 7, "p"], [11, 8, "p"]],
  },
  frog: {
    name: "Pip",
    animal: "frog",
    sound: "Ribbit!",
    palette: { o: "#1f3a1f", G: "#6cc644", L: "#c7f08a", w: "#ffffff", k: "#1b1b2f", p: "#ff9eb5", m: "#2d4d1f" },
    rows: [
      "..oooo....oooo..",
      ".oGwwGo..oGwwGo.",
      ".oGwkGooooGwkGo.",
      "oGGGGGGGGGGGGGGo",
      "oGGGGGGGGGGGGGGo",
      "oGpGGGGGGGGGGpGo",
      "oGGmGGGGGGGGmGGo",
      ".oGGmmmmmmmmGGo.",
      "..oGGGGGGGGGGo..",
      ".oGGLLLLLLLLGGo.",
      "oGGGLLLLLLLLGGGo",
      "oGGGLLLLLLLLGGGo",
      ".oGGGLLLLLLGGGo.",
      "oGGGooGGGGooGGGo",
      "oGGo..oGGo..oGGo",
      ".oo....oo....oo.",
    ],
    blink: [[1, 3, "G"], [1, 4, "G"], [1, 11, "G"], [1, 12, "G"], [2, 3, "m"], [2, 4, "m"], [2, 11, "m"], [2, 12, "m"]],
    talk: [[7, 5, "p"], [7, 6, "p"], [7, 7, "p"], [7, 8, "p"], [7, 9, "p"], [7, 10, "p"], [8, 6, "m"], [8, 7, "m"], [8, 8, "m"], [8, 9, "m"]],
  },
  penguin: {
    name: "Waddles",
    animal: "penguin",
    sound: "*happy flap*",
    palette: { o: "#14142a", N: "#2b2d42", W: "#ffffff", Y: "#ffb703", p: "#ff9eb5", k: "#1b1b2f", h: "#ffffff" },
    rows: [
      ".....oooooo.....",
      "...ooNNNNNNoo...",
      "..oNNNNNNNNNNo..",
      ".oNNNWWWWWWNNNo.",
      ".oNNWWWWWWWWNNo.",
      ".oNWkhWWWWkhWNo.",
      ".oNWkkWYYWkkWNo.",
      ".oNWpWYYYYWpWNo.",
      "oNNWWWWYYWWWWNNo",
      "oNNWWWWWWWWWWNNo",
      "oNNWWWWWWWWWWNNo",
      "oNNWWWWWWWWWWNNo",
      ".oNWWWWWWWWWWNo.",
      ".oNNWWWWWWWWNNo.",
      "..ooNNNNNNNNoo..",
      "..oYYYo..oYYYo..",
    ],
    blink: [[5, 4, "W"], [5, 5, "W"], [5, 10, "W"], [5, 11, "W"]],
    talk: [[7, 7, "p"], [7, 8, "p"]],
  },
};

export const PET_KINDS = Object.keys(PETS);

/** Draw a pet into a 16×16 canvas. Scale it up in CSS with image-rendering: pixelated. */
export function drawPet(canvas, kind, { blink = false, talk = false } = {}) {
  const pet = PETS[kind] || PETS.cat;
  if (canvas.width !== 16) canvas.width = 16;
  if (canvas.height !== 16) canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 16, 16);
  const grid = pet.rows.map((row) => row.split(""));
  if (blink) for (const [r, c, ch] of pet.blink) grid[r][c] = ch;
  if (talk) for (const [r, c, ch] of pet.talk) grid[r][c] = ch;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const color = pet.palette[grid[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** A data URL of a pet frame, for places that can't share canvases (the snip answer bubble). */
export function petImage(kind, frame = {}) {
  const canvas = document.createElement("canvas");
  drawPet(canvas, kind, frame);
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------- the pet on screen

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`nova:${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`nova:${key}`, JSON.stringify(value));
    } catch {
      // storage unavailable
    }
  },
};

/**
 * Keeps every pet sprite on the page in sync and animated.
 * States: idle, thinking, talking, happy, dancing, sleeping.
 */
export class PetBuddy extends EventTarget {
  constructor() {
    super();
    const saved = store.get("petKind", "cat");
    this.kind = PETS[saved] ? saved : "cat";
    this.customName = store.get("petName", "");
    this.state = "idle";
    this.live = new Set(); // animated sprites (the pet next to the bar)
    this.stills = new Set(); // little avatars next to answers
    this.docks = new Set(); // elements that show the state (bobbing, "...", "z")
    this.isPlaying = () => false;
    this.tick = 0;
    this.blinkUntil = 0;
    this.nextBlink = Date.now() + 2500;
    setInterval(() => this.frame(), 110);
  }

  get pet() {
    return PETS[this.kind];
  }

  get name() {
    return this.customName || this.pet.name;
  }

  /** What the AI needs to play the pet. */
  get persona() {
    return { kind: this.kind, animal: this.pet.animal, name: this.name, sound: this.pet.sound };
  }

  sprite({ live = false, className = "" } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    canvas.className = `pet-sprite ${className}`.trim();
    canvas.setAttribute("aria-hidden", "true");
    drawPet(canvas, this.kind);
    (live ? this.live : this.stills).add(canvas);
    return canvas;
  }

  dock(element) {
    this.docks.add(element);
    element.dataset.state = this.state;
  }

  setKind(kind) {
    if (!PETS[kind]) return false;
    this.kind = kind;
    store.set("petKind", kind);
    for (const canvas of [...this.stills]) {
      if (!canvas.isConnected && canvas.dataset.seen) this.stills.delete(canvas);
      else drawPet(canvas, kind);
    }
    this.frame(true);
    this.setState("happy", 1300);
    this.dispatchEvent(new Event("change"));
    return true;
  }

  setName(name) {
    this.customName = String(name || "").trim().slice(0, 24);
    store.set("petName", this.customName);
    this.dispatchEvent(new Event("change"));
  }

  restingState() {
    return this.isPlaying() ? "dancing" : "idle";
  }

  /** Change state; with `ms`, go back to resting afterwards. */
  setState(state, ms = 0) {
    clearTimeout(this.stateTimer);
    this.state = state;
    if (ms) this.stateTimer = setTimeout(() => this.setState(this.restingState()), ms);
    for (const dock of this.docks) dock.dataset.state = state;
    this.frame(true);
  }

  frame(force = false) {
    const now = Date.now();
    if (now > this.nextBlink) {
      this.blinkUntil = now + 170;
      this.nextBlink = now + 2200 + Math.random() * 3800;
    }
    this.tick++;
    const blink = this.state === "sleeping" || now < this.blinkUntil;
    const talk = this.state === "talking" && this.tick % 3 !== 0;
    const key = `${this.kind}|${blink}|${talk}`;
    if (key === this.lastKey && !force) return;
    this.lastKey = key;
    for (const canvas of this.live) drawPet(canvas, this.kind, { blink, talk });
    for (const canvas of this.stills) if (canvas.isConnected) canvas.dataset.seen = "1";
  }

  /** Frames as images, for the snip answer bubble (a separate window). */
  frames() {
    return { normal: petImage(this.kind), talk: petImage(this.kind, { talk: true }), blink: petImage(this.kind, { blink: true }) };
  }
}

/** The "choose your pet" panel: one button per animal, plus a name field. */
export function createPetPicker(buddy) {
  const title = document.createElement("div");
  title.className = "pet-picker-title";
  title.textContent = "CHOOSE YOUR PET";
  const grid = document.createElement("div");
  grid.className = "pet-grid";
  const buttons = PET_KINDS.map((kind) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pet-choice";
    button.dataset.kind = kind;
    button.title = `${PETS[kind].name} the ${PETS[kind].animal}`;
    const canvas = document.createElement("canvas");
    canvas.className = "pet-sprite";
    drawPet(canvas, kind);
    const label = document.createElement("span");
    label.textContent = PETS[kind].animal;
    button.append(canvas, label);
    button.addEventListener("click", () => buddy.setKind(kind));
    grid.append(button);
    return button;
  });
  const nameRow = document.createElement("label");
  nameRow.className = "pet-name-row";
  const nameLabel = document.createElement("span");
  nameLabel.textContent = "Name";
  const input = document.createElement("input");
  input.maxLength = 24;
  input.autocomplete = "off";
  input.addEventListener("change", () => buddy.setName(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buddy.setName(input.value);
      input.blur();
    }
  });
  nameRow.append(nameLabel, input);

  const picker = document.createElement("div");
  picker.className = "pet-picker";
  picker.hidden = true;
  picker.append(title, grid, nameRow);

  const render = () => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.kind === buddy.kind));
    input.placeholder = PETS[buddy.kind].name;
    if (document.activeElement !== input) input.value = buddy.customName;
  };
  buddy.addEventListener("change", render);
  render();
  return picker;
}
