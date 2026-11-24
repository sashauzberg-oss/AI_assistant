import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Corrector } from "../public/js/autocorrect.js";

const corrector = new Corrector(fs.readFileSync(new URL("../public/data/words.txt", import.meta.url), "utf8"));

test("fixes common typos", () => {
  const cases = {
    teh: "the", hte: "the", wich: "which", realy: "really", recieve: "receive", musci: "music", tiemr: "timer",
    weahter: "weather", anwser: "answer", definately: "definitely", seperate: "separate", becuase: "because",
    tommorow: "tomorrow", freind: "friend", neccessary: "necessary", dont: "don't", im: "I'm", i: "I", Teh: "The",
  };
  for (const [typo, fixed] of Object.entries(cases)) assert.equal(corrector.suggest(typo), fixed, typo);
});

test("leaves real words, names, slang and shouting alone", () => {
  for (const word of ["time", "jazz", "lofi", "spotify", "pomodoro", "kpop", "okay", "app", "wifi", "hmm", "lol", "gonna", "its", "were", "well", "ill", "emoji", "online", "NASA", "sooo"]) {
    assert.equal(corrector.suggest(word), null, word);
  }
});

test("only corrects plain words in context", () => {
  const at = (text, word) => corrector.correctAt(text, text.indexOf(word) + word.length);
  assert.deepEqual(at("play musci ", "musci"), { start: 5, end: 10, original: "musci", replacement: "music" });
  assert.equal(at("open exmaple.com/teh ", "teh"), null); // part of a link
  assert.equal(at("my iPhoen is ", "iPhoen"), null); // mixed case: a name
  assert.equal(at("email bob@teh ", "teh"), null);
  assert.equal(corrector.correctAt("call Mochie ", 11, { protect: (w) => w === "Mochie" }), null);
});

test("only corrects English text", () => {
  const fix = (text) => corrector.correctAt(text, text.length)?.replacement ?? null;
  assert.equal(fix("can you play some msic"), "music");
  assert.equal(fix("call Mochi at exmaple.com and NASA teh"), "the");
  assert.equal(fix("quiero escuchar musica tranquila esta nohce"), null);
});
