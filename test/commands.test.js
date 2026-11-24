import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, parseDuration, secondsUntil, isInstant } from "../public/js/commands.js";
import { calculate, looksLikeMath } from "../public/js/calc.js";

const name = (text) => parseCommand(text)?.name ?? null;

test("music requests", () => {
  assert.deepEqual(parseCommand("music"), { name: "music_play", args: { query: "" } });
  assert.deepEqual(parseCommand("Play some jazz"), { name: "music_play", args: { query: "some jazz" } });
  assert.deepEqual(parseCommand("play Bohemian Rhapsody by Queen"), { name: "music_play", args: { query: "bohemian rhapsody by queen" } });
  assert.deepEqual(parseCommand("relaxing music"), { name: "music_play", args: { query: "relaxing" } });
  assert.deepEqual(parseCommand("Nova, put on some lofi please"), { name: "music_play", args: { query: "some lofi" } });
  assert.equal(parseCommand("stop").args.action, "stop");
  assert.equal(parseCommand("pause the music").args.action, "pause");
  assert.equal(parseCommand("next song").args.action, "next");
  assert.equal(parseCommand("louder").args.delta, 15);
  assert.equal(parseCommand("volume 40").args.volume, 40);
  assert.equal(name("cat videos on youtube"), "youtube");
});

test("screen questions", () => {
  for (const t of ["answer this", "Nova, answer this question", "solve this", "what's on my screen", "look at my screen", "help me with this"]) {
    assert.equal(name(t), "answer_screen", t);
  }
});

test("timers, reminders and alarms", () => {
  assert.deepEqual(parseCommand("timer 5 minutes"), { name: "timer", args: { seconds: 300, label: "Timer" } });
  assert.equal(parseCommand("set a timer for 90 seconds").args.seconds, 90);
  assert.equal(parseCommand("5 minute timer").args.seconds, 300);
  assert.deepEqual(parseCommand("remind me in 20 minutes to stretch"), { name: "timer", args: { seconds: 1200, label: "stretch" } });
  assert.deepEqual(parseCommand("remind me to call mom in an hour"), { name: "timer", args: { seconds: 3600, label: "call mom" } });
  const alarm = parseCommand("set an alarm for 7:30 am");
  assert.equal(alarm.name, "alarm");
  assert.deepEqual([alarm.args.hours, alarm.args.minutes, alarm.args.meridiem], [7, 30, "am"]);
  assert.equal(name("cancel all timers"), "cancel_timers");
});

test("parseDuration", () => {
  assert.equal(parseDuration("1h30m"), 5400);
  assert.equal(parseDuration("an hour and a half"), 5400);
  assert.equal(parseDuration("half an hour"), 1800);
  assert.equal(parseDuration("two minutes 30 seconds"), 150);
  assert.equal(parseDuration("1:30"), 90);
  assert.equal(parseDuration("5"), 300);
  assert.equal(parseDuration("soon"), null);
});

test("secondsUntil picks the next occurrence", () => {
  const now = new Date(2026, 10, 24, 6, 0, 0);
  assert.equal(secondsUntil(7, 30, "am", now), 5400);
  assert.equal(secondsUntil(5, 0, "am", now), 23 * 3600);
  assert.equal(secondsUntil(7, 0, "pm", now), 13 * 3600);
  assert.equal(secondsUntil(7, 0, "", now), 3600); // no am/pm: the nearest 7 o'clock
});

test("everyday intents", () => {
  assert.equal(name("what time is it"), "time");
  assert.equal(name("what's the date today"), "date");
  assert.deepEqual(parseCommand("weather in Tokyo"), { name: "weather", args: { location: "tokyo" } });
  assert.deepEqual(parseCommand("what's the weather"), { name: "weather", args: { location: "" } });
  assert.equal(name("tell me a joke"), "joke");
  assert.equal(name("flip a coin"), "coin");
  assert.deepEqual(parseCommand("roll 2 dice").args, { count: 2, sides: 6 });
  assert.deepEqual(parseCommand("note: buy milk"), { name: "note_add", args: { text: "buy milk" } });
  assert.deepEqual(parseCommand("add eggs to my shopping list"), { name: "note_add", args: { text: "eggs" } });
  assert.equal(name("show my notes"), "note_list");
  assert.equal(parseCommand("open youtube").args.url, "https://www.youtube.com");
  assert.equal(parseCommand("open example.org").args.url, "https://example.org");
  assert.equal(name("search best pizza near me"), "search");
  assert.deepEqual(parseCommand("define serendipity"), { name: "define", args: { word: "serendipity" } });
  assert.deepEqual(parseCommand("who is Ada Lovelace"), { name: "wiki", args: { query: "ada lovelace" } });
  assert.equal(name("dark mode"), "theme");
  assert.equal(name("hello"), "greet");
  assert.equal(name("write me a poem about autumn"), null);
});

test("math", () => {
  assert.equal(name("what is 12 * 7"), "calc");
  assert.equal(name("what is the capital of France"), "wiki");
  assert.equal(calculate("2 + 3 * 4"), 14);
  assert.equal(calculate("(2 + 3) * 4"), 20);
  assert.equal(calculate("2^10"), 1024);
  assert.equal(calculate("15% of 80"), 12);
  assert.equal(calculate("sqrt 144"), 12);
  assert.equal(calculate("5!"), 120);
  assert.equal(calculate("10 mod 3"), 1);
  assert.equal(calculate("10 % 3"), 1);
  assert.equal(calculate("50%"), 0.5);
  assert.equal(calculate("2pi"), 2 * Math.PI);
  assert.equal(calculate("7 times 6"), 42);
  assert.equal(calculate("1,000 / 8"), 125);
  assert.equal(calculate("-3^2"), -9);
  assert.throws(() => calculate("1/0"));
  assert.throws(() => calculate("alert(1)"));
  assert.equal(looksLikeMath("hello world"), false);
  assert.equal(looksLikeMath("3 + 4"), true);
});

test("instant commands", () => {
  assert.equal(isInstant(parseCommand("music")), true);
  assert.equal(isInstant(parseCommand("stop")), true);
  assert.equal(isInstant(parseCommand("play jazz")), false);
  assert.equal(isInstant(parseCommand("answer this")), false);
});

test("new commands: snip modes, stopwatch, focus, passwords, memory, conversions", () => {
  assert.deepEqual(parseCommand("answer this"), { name: "answer_screen", args: { mode: "answer" } });
  assert.equal(parseCommand("translate this").args.mode, "translate");
  assert.equal(parseCommand("explain this").args.mode, "explain");
  assert.equal(parseCommand("copy the text from my screen").args.mode, "text");
  assert.equal(name("copy that"), "copy_last");
  assert.deepEqual(parseCommand("start stopwatch"), { name: "stopwatch", args: { action: "start" } });
  assert.equal(parseCommand("stop the stopwatch").args.action, "stop");
  assert.deepEqual(parseCommand("pomodoro"), { name: "focus", args: { seconds: 1500 } });
  assert.equal(parseCommand("focus for 50 minutes").args.seconds, 3000);
  assert.equal(name("play focus music"), "music_play");
  assert.deepEqual(parseCommand("generate a password"), { name: "password", args: { length: 16, symbols: true } });
  assert.deepEqual(parseCommand("make a 24 character password without symbols"), { name: "password", args: { length: 24, symbols: false } });
  assert.equal(name("how do I make my password stronger"), null);
  assert.deepEqual(parseCommand("remember that my favorite color is green"), { name: "memory_add", args: { text: "my favorite color is green" } });
  assert.equal(name("what do you remember"), "memory_list");
  assert.equal(name("forget everything"), "memory_clear");
  assert.deepEqual(parseCommand("forget my favorite color"), { name: "memory_forget", args: { text: "my favorite color" } });
  assert.equal(name("note: call the dentist"), "note_add");
  const km = parseCommand("convert 10 km to miles");
  assert.equal(km.name, "convert");
  assert.ok(Math.abs(km.args.result - 6.21371) < 1e-4);
  assert.deepEqual(parseCommand("$50 to euros").args, { kind: "currency", amount: 50, from: "USD", to: "EUR" });
  assert.equal(parseCommand("what is 0 c in f").args.result, 32);
  for (const cmd of ["copy that", "start stopwatch", "pomodoro", "generate a password", "10 km to miles"]) {
    assert.equal(isInstant(parseCommand(cmd)), true, cmd);
  }
  assert.equal(isInstant(parseCommand("remember that I like tea")), false);
});

test("password generator", async () => {
  const { generatePassword } = await import("../public/js/extras.js");
  const pw = generatePassword({ length: 20 });
  assert.equal(pw.length, 20);
  assert.match(pw, /[a-z]/);
  assert.match(pw, /[A-Z]/);
  assert.match(pw, /[0-9]/);
  assert.match(pw, /[!@#$%^&*\-_=+?]/);
  assert.doesNotMatch(generatePassword({ length: 30, symbols: false }), /[^A-Za-z0-9]/);
  assert.notEqual(generatePassword(), generatePassword());
});

test("pet commands", () => {
  assert.deepEqual(parseCommand("switch to a dog"), { name: "pet", args: { kind: "dog" } });
  assert.deepEqual(parseCommand("change pet to penguin"), { name: "pet", args: { kind: "penguin" } });
  assert.deepEqual(parseCommand("be a frog"), { name: "pet", args: { kind: "frog" } });
  assert.deepEqual(parseCommand("turn into a rabbit"), { name: "pet", args: { kind: "bunny" } });
  assert.deepEqual(parseCommand("I want a kitten"), { name: "pet", args: { kind: "cat" } });
  assert.equal(name("change pet"), "pet_picker");
  assert.deepEqual(parseCommand("call yourself Pixel"), { name: "pet_name", args: { name: "Pixel" } });
  assert.deepEqual(parseCommand("rename my pet to Sir Hops"), { name: "pet_name", args: { name: "Sir Hops" } });
  assert.equal(isInstant(parseCommand("switch to a fox")), true);
  assert.equal(name("what does a fox say"), null);
});
