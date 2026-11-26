// The built-in jokes and the joke cutscene's sprite maths (no browser needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { JOKES, randomJoke, jokeText } from "../public/js/jokes.js";
import { petGeometry, shadeLenses, micSpot } from "../public/js/cutscene.js";
import { PET_KINDS } from "../public/js/pets.js";

test("every built-in joke has a setup and a punchline", () => {
  assert.ok(JOKES.length >= 50);
  for (const [setup, punchline] of JOKES) {
    assert.ok(setup.trim() && punchline.trim(), `${setup} / ${punchline}`);
    assert.ok(setup.length <= 120 && punchline.length <= 120);
  }
  assert.equal(new Set(JOKES.map(([setup]) => setup)).size, JOKES.length, "no duplicate jokes");
});

test("random jokes skip the recently told ones", () => {
  const recent = JOKES.map((_, i) => i).filter((i) => i !== 7);
  for (let n = 0; n < 20; n++) assert.equal(randomJoke(recent).index, 7);
  // when everything was told recently, it still tells one
  const all = JOKES.map((_, i) => i);
  const joke = randomJoke(all);
  assert.ok(joke.setup && joke.punchline);
});

test("a joke reads as setup, then the punchline in bold", () => {
  assert.equal(jokeText({ setup: "Why?", punchline: "Because." }), "🎤 Why?\n\n**Because.**");
});

test("every pet gets shades over its eyes and a mic beside its mouth", () => {
  for (const kind of PET_KINDS) {
    const geo = petGeometry(kind);
    assert.equal(geo.eyes.length, 2, `${kind} has two eyes`);
    const lenses = shadeLenses(geo);
    for (const lens of lenses) {
      assert.ok(lens.left >= 0 && lens.right <= 15 && lens.top >= 0 && lens.bottom <= 15, `${kind} lens fits`);
      assert.ok(lens.bottom > lens.top, `${kind} lens is at least two pixels tall`);
    }
    assert.ok(lenses[0].right < lenses[1].left, `${kind} lenses don't overlap`);
    const mic = micSpot(geo);
    assert.ok(mic.x > geo.mouth.right, `${kind}: the mic doesn't cover the mouth`);
    assert.ok(mic.x + 5 <= 17 && mic.y + 9 <= 16, `${kind}: the mic stays on the pet`);
    assert.match(geo.fur, /^#[0-9a-f]{6}$/i);
  }
});
