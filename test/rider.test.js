// Riding the cursor: the commands and what the pet says when (no browser needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, isInstant } from "../public/js/commands.js";
import { nextLine, RIDE_LINES } from "../public/js/rider.js";

const parse = (text) => parseCommand(text, { isWord: (w) => ["get", "on", "the", "bus", "ride", "a", "bike", "off", "work"].includes(w) });

test("'get on' and friends put the pet on the cursor", () => {
  for (const text of ["get on", "Get on!", "hop on", "get on my cursor", "ride my mouse", "climb onto the cursor", "sit on my mouse", "get back on"]) {
    assert.deepEqual(parse(text), { name: "ride", args: { on: true } }, text);
  }
  assert.ok(isInstant(parse("get on")));
});

test("'get off' and friends bring it back", () => {
  for (const text of ["get off", "get down", "hop off my cursor", "stop riding", "come back", "get off of my cursor"]) {
    assert.deepEqual(parse(text), { name: "ride", args: { on: false } }, text);
  }
});

test("other things you get on or ride aren't the cursor", () => {
  for (const text of ["get on the bus", "ride a bike", "get off work"]) assert.equal(parse(text), null, text);
});

const calm = { now: 100000, speed: 0, fastFor: 0, peak: 0, idleFor: 0, lastLine: 99000, nextChatter: 12000, saidView: false, sleeping: false };

test("the pet shouts when the ride gets fast, but not every moment", () => {
  assert.equal(nextLine({ ...calm, speed: 2000, fastFor: 200, lastLine: 90000 })?.kind, "fast");
  assert.equal(nextLine({ ...calm, speed: 2000, fastFor: 200, lastLine: 99000 }), null, "just said something");
  assert.equal(nextLine({ ...calm, speed: 2000, fastFor: 50, lastLine: 90000 }), null, "a tiny twitch isn't a ride");
});

test("a sudden stop, a rest and a long nap", () => {
  assert.equal(nextLine({ ...calm, peak: 2000, speed: 20, lastLine: 90000 })?.kind, "stop");
  assert.equal(nextLine({ ...calm, idleFor: 5000, lastLine: 90000 })?.kind, "view");
  assert.equal(nextLine({ ...calm, idleFor: 5000, lastLine: 90000, saidView: true }), null, "only once per rest");
  assert.equal(nextLine({ ...calm, idleFor: 45000 })?.kind, "sleep");
  assert.equal(nextLine({ ...calm, sleeping: true }), null);
  assert.equal(nextLine({ ...calm, sleeping: true, speed: 300 })?.kind, "wake");
});

test("it chats now and then while you move around", () => {
  assert.equal(nextLine({ ...calm, speed: 400, lastLine: 80000 })?.kind, "chatter");
  assert.equal(nextLine({ ...calm, speed: 400, lastLine: 95000 }), null);
});

test("the lines include the ones asked for", () => {
  assert.ok(RIDE_LINES.view.includes("Great view up here!"));
  assert.ok(RIDE_LINES.fast.includes("Wheee!"));
});
