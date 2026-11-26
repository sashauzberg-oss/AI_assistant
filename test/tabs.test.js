// "close all my tabs": the command, the reply, and the Windows script's set-up (no browser needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand, isInstant } from "../public/js/commands.js";
import { describeClosedTabs } from "../public/js/extras.js";
import { windowsScript, parseClosed, BROWSERS } from "../desktop/tabs.js";

const words = ["close", "this", "tab", "the", "window", "all", "my", "apps"];
const parse = (text) => parseCommand(text, { isWord: (w) => words.includes(w) });

test("'close all my tabs' and friends", () => {
  for (const text of ["close all my tabs", "Close all my tabs!", "close all tabs", "close my tabs", "close every tab", "shut down all my tabs", "close all my browser tabs"]) {
    assert.deepEqual(parse(text), { name: "close_tabs", args: { browser: "" } }, text);
  }
  assert.ok(isInstant(parse("close all my tabs")), "no AI needed");
});

test("just one browser's tabs", () => {
  assert.equal(parse("close all my chrome tabs").args.browser, "chrome");
  assert.equal(parse("close all the tabs in google chrome").args.browser, "chrome");
  assert.equal(parse("close all tabs in microsoft edge").args.browser, "edge");
  assert.equal(parse("close every firefox tab").args.browser, "firefox");
  for (const text of ["close all my chrome tabs", "close all tabs in edge", "close every firefox tab"]) {
    assert.ok(BROWSERS[parse(text).args.browser], `${text}: a browser the desktop app knows`);
  }
});

test("a typo still works, but is marked as a guess (so Nova asks first)", () => {
  const command = parse("clsoe all my tabs");
  assert.equal(command.name, "close_tabs");
  assert.equal(command.understood, "close all my tabs");
});

test("nothing else closes tabs", () => {
  for (const text of ["close this tab", "close the window", "close tab", "close all my apps"]) assert.equal(parse(text), null, text);
});

test("the reply says what closed and how to get it back", () => {
  const two = describeClosedTabs({ ok: true, closed: [{ browser: "Chrome", windows: 2 }] });
  assert.match(two, /\*\*2 Chrome windows\*\*/);
  assert.match(two, /Ctrl\+Shift\+T/);
  assert.match(describeClosedTabs({ ok: true, closed: [{ browser: "Chrome", windows: 1 }, { browser: "Edge", windows: 2 }] }), /3 Chrome and Edge windows/);
  assert.match(describeClosedTabs({ ok: true, closed: [] }), /don't have any browser windows open/);
  assert.match(describeClosedTabs({ ok: false, error: "unsupported-platform" }), /Windows/);
  assert.match(describeClosedTabs({ ok: false, error: "script: oops" }), /couldn't/);
});

test("the Windows script asks only the browsers' windows to close", () => {
  const script = windowsScript(["chrome", "msedge"]);
  assert.match(script, /Get-Process -Name 'chrome','msedge'/);
  assert.match(script, /PostMessage\(\$hwnd, 0x0010/, "WM_CLOSE, like clicking the X");
  assert.match(script, /^"@$/m, "the C# block ends on its own line");
  assert.doesNotMatch(script.split('Add-Type')[1].split('"@')[0], /\$/, "nothing in the C# block that PowerShell would try to fill in");
  assert.ok(!/\$pid\b/i.test(script), "doesn't use PowerShell's read-only $PID");
  for (const b of Object.values(BROWSERS)) assert.match(b.process, /^[a-z]+$/, "process names are plain words");
});

test("the script's answer is read safely", () => {
  assert.deepEqual(parseClosed('[{"windows":2,"browser":"chrome"},{"browser":"msedge","windows":1}]'), [
    { browser: "Chrome", windows: 2 },
    { browser: "Edge", windows: 1 },
  ]);
  assert.deepEqual(parseClosed('{"browser":"firefox","windows":1}'), [{ browser: "Firefox", windows: 1 }]);
  assert.deepEqual(parseClosed(""), []);
  assert.equal(parseClosed("Add-Type : error"), null);
});
