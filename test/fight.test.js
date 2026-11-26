// The fight scene's command and set-up (no browser needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, isInstant } from "../public/js/commands.js";
import { chooseFoe, foeName, fightLayout } from "../public/js/fight.js";
import { PET_KINDS } from "../public/js/pets.js";

const fight = (text) => parseCommand(text, { isWord: (w) => ["who", "won", "the", "battle", "of", "hastings", "how", "to", "fight", "a", "cold", "club", "movie"].includes(w) });

test("'fight scene' and friends start a fight", () => {
  for (const text of ["fight scene", "Fight scene!", "epic battle", "start a fight scene", "show me an epic battle", "let's have a fight", "fight", "pet fight", "battle"]) {
    assert.deepEqual(fight(text), { name: "fight", args: { foe: "" } }, text);
  }
});

test("you can pick who your pet fights", () => {
  assert.equal(fight("fight scene with a dragon").args.foe, "dragon");
  assert.equal(fight("battle against the shark").args.foe, "shark");
  assert.equal(fight("fight a lion").args.foe, "lion");
  assert.equal(fight("dragon fight").args.foe, "dragon");
  assert.equal(fight("duel the evil penguin").args.foe, "penguin");
  assert.equal(fight("fight with a teddy").args.foe, "bear");
});

test("fights are instant (no AI needed) and typos still work", () => {
  assert.ok(isInstant(fight("fight scene")));
  assert.equal(fight("figth scene").name, "fight");
});

test("questions about fights and battles aren't fight scenes", () => {
  for (const text of ["who won the battle of hastings", "how to fight a cold", "fight club movie"]) assert.equal(fight(text), null, text);
});

test("the opponent is the animal asked for, or a different random pet", () => {
  assert.equal(chooseFoe("cat", "shark"), "shark");
  assert.equal(chooseFoe("cat", "cat"), "cat"); // a mirror match
  for (let i = 0; i < 50; i++) {
    const foe = chooseFoe("cat", "");
    assert.ok(PET_KINDS.includes(foe) && foe !== "cat");
  }
  assert.equal(foeName("cat", "Mochi", "dragon"), "Ziggy");
  assert.equal(foeName("cat", "Mochi", "cat"), "Shadow Mochi");
});

test("the pixel world fits any screen with big fighters", () => {
  for (const [w, h] of [[1920, 1080], [1280, 760], [2560, 1080], [390, 844], [800, 600]]) {
    const L = fightLayout(w, h);
    assert.ok(L.W * L.p >= w && L.H * L.p >= h, `${w}x${h} is covered`);
    assert.ok(L.S >= 32 && L.S * 2.5 < L.W, `${w}x${h}: fighters are big but both fit`);
    assert.ok(L.ground > L.S && L.ground < L.H, `${w}x${h}: room above the ground`);
  }
});
