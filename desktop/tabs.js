// "close all my tabs" (Windows): asks every window of the web browsers that are open to
// close, like clicking its X, so all their tabs close with them. A browser can bring
// them back with Ctrl+Shift+T.
import { execFile } from "node:child_process";

// The browsers Nova knows: the word people use for them -> process name and label.
export const BROWSERS = {
  chrome: { process: "chrome", label: "Chrome" },
  edge: { process: "msedge", label: "Edge" },
  firefox: { process: "firefox", label: "Firefox" },
  brave: { process: "brave", label: "Brave" },
  opera: { process: "opera", label: "Opera" },
  vivaldi: { process: "vivaldi", label: "Vivaldi" },
  arc: { process: "arc", label: "Arc" },
};

/** The PowerShell script that asks every visible top-level window of these processes to close. */
export function windowsScript(processes) {
  return `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class NovaWindows {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr wparam, IntPtr lparam);
  public static List<IntPtr> TopWindows() {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => { if (IsWindowVisible(h) && GetWindow(h, 4) == IntPtr.Zero && GetWindowTextLength(h) > 0) found.Add(h); return true; }, IntPtr.Zero);
    return found;
  }
}
"@
if (-not ('NovaWindows' -as [type])) { Write-Output 'NOVA_ERROR'; exit 1 }
$owners = @{}
Get-Process -Name ${processes.map((p) => `'${p}'`).join(",")} | ForEach-Object { $owners[[uint32]$_.Id] = $_.ProcessName.ToLower() }
$closed = @{}
foreach ($hwnd in [NovaWindows]::TopWindows()) {
  $procId = [uint32]0
  [void][NovaWindows]::GetWindowThreadProcessId($hwnd, [ref]$procId)
  if ($owners.ContainsKey($procId)) {
    [void][NovaWindows]::PostMessage($hwnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    $name = $owners[$procId]
    $closed[$name] = 1 + [int]$closed[$name]
  }
}
$list = @($closed.Keys | ForEach-Object { @{ browser = $_; windows = $closed[$_] } })
ConvertTo-Json -InputObject $list -Compress
`;
}

/** Reads the script's output: [{ browser: process name, windows }] -> [{ browser: label, windows }]. */
export function parseClosed(stdout) {
  let list;
  try {
    list = JSON.parse(String(stdout).trim() || "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(list)) list = [list];
  const label = (name) => Object.values(BROWSERS).find((b) => b.process === String(name).toLowerCase())?.label || String(name);
  return list.filter((r) => r && r.windows > 0).map((r) => ({ browser: label(r.browser), windows: Number(r.windows) }));
}

/**
 * Closes every browser window (or one browser's, with `browser` from BROWSERS).
 * Resolves with { ok, closed: [{ browser, windows }], error? }.
 */
export function closeBrowserTabs({ browser = "" } = {}) {
  if (process.platform !== "win32") return Promise.resolve({ ok: false, error: "unsupported-platform" });
  const processes = (browser && BROWSERS[browser] ? [BROWSERS[browser]] : Object.values(BROWSERS)).map((b) => b.process);
  const encoded = Buffer.from(windowsScript(processes), "utf16le").toString("base64");
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { timeout: 60000, windowsHide: true },
      (error, stdout, stderr) => {
        const closed = parseClosed(stdout);
        resolve(closed ? { ok: true, closed } : { ok: false, error: `script: ${String(stderr || error?.message || "").trim()}` });
      },
    );
  });
}
