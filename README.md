# Nova: your AI assistant

Nova is an AI assistant for your browser or desktop. Type or say what you want and it does it:

| You say | Nova does |
|---|---|
| **music** | Starts playing music right away |
| **play some jazz**, **lofi**, **play Taylor Swift**, **BBC radio** | Plays a genre station, song previews, or a radio station |
| **answer this** | Snips your screen, reads the question and answers it |
| **timer 10 minutes**, **remind me in 20 min to stretch**, **alarm at 7:30 am** | Sets timers and alarms, with a sound and a notification |
| **weather**, **weather in Tokyo** | Shows the current weather and a 4-day forecast |
| **open YouTube**, **cat videos on YouTube**, **search pizza near me** | Opens sites and searches |
| **copy the text from my screen**, **translate this**, **explain this** | Snips your screen and copies, translates or explains what's there |
| **summarize my clipboard**, **fix the grammar in what I copied**, **copy that** | Works with your clipboard |
| **remember that my name is Sam**, **what do you remember**, **forget my name** | Remembers things about you across chats |
| **10 km to miles**, **350 f to c**, **$50 to euros**, **how many ounces in a pound** | Converts units and currencies (live exchange rates) |
| **pomodoro**, **focus for 50 minutes**, **start stopwatch** | Focus sessions with music, and a stopwatch |
| **generate a password**, **make a 24 character password** | Makes a secure password that never leaves your computer |
| **open Spotify**, **open calculator** (desktop app) | Opens apps installed on your computer |
| **note buy milk**, **show my notes** | Keeps a notes and to-do list |
| **what's 15% of 80**, **define serendipity**, **who is Ada Lovelace** | Calculates and looks things up |
| *anything else* | Answers it with Claude, searching the web when needed |

**Your pixel pet answers everything.** A little pixel-art pet sits next to the typing bar and answers your questions in pixel speech bubbles. It blinks, talks while it answers, thinks while it waits, bobs along to music and dozes off when you're away. Click it to pick another animal (18 to choose from: cat, dog, bunny, fox, frog, penguin, panda, owl, hamster, duck, axolotl, dragon, unicorn, pig, koala, turtle, octopus or raccoon) and give it a name, or just say “be a dragon” or “call yourself Pixel”.

**Auto-correct.** Typos are fixed as you type, like on a phone: “teh” becomes “the” when you press space, and “dont” becomes “don't”. A little chip shows what changed; click it or press Backspace right away to undo, and Nova won't change that word again. Names, links, ALL CAPS and your pet's name are left alone. Turn it off in Settings › Personal.

**Typos don't trip Nova up.** Even when a typo slips through, Nova works out what you meant: “plya jazz”, “tiemr 5 minutes”, “wether in Paris” and “stpo” all work, and it tells you how it read them (“I took that as …”). Real words and names are never changed, and the AI reads past typos too.

It also has voice control (including a hands-free mode with the wake word **“Nova”**), read-aloud answers, light and dark themes, and a layout that works on phones.

There are two ways to run it:

- **Web version** (`npm start`): open it in Chrome or Edge, on your computer or phone. Has voice control.
- **Desktop app** (`npm run desktop`, or [download an installer](https://github.com/sashauzberg-oss/AI_assistant/releases/latest)): a floating typing bar you open with **Alt+Space**, plus **Ctrl+Shift+Space** in any app to snip a question and get the answer right next to it. [Details below](#desktop-app).

## Quick start

1. Install [Node.js](https://nodejs.org) 20.12 or newer.
2. In this folder, run:

   ```bash
   npm install
   ```

   ```bash
   npm start
   ```

3. Open **http://localhost:3000** in Chrome or Edge.
4. Click the **sliders icon** (Settings) and paste your Anthropic API key ([get one here](https://console.anthropic.com/settings/keys)). Nova saves it in a local `.env` file. You can also copy `.env.example` to `.env` and put the key there yourself.

Without a key, Nova still works in **offline mode**: music, timers, weather, notes, calculator, jokes and the other built-in commands all run without AI. The key unlocks answering *anything* and reading your screen.

## “Answer this”: questions from your screen

There are three ways to show Nova a question:

- **Type or say “answer this”.** Your browser asks which window or tab to share. Pick the one with the question, then drag a box around it (or press Enter to send the whole thing). Nova answers it.
- **Link a screen once** (the monitor icon at the top). After that, “answer this” grabs the screen instantly with no picker. This is what makes it work by voice: turn on hands-free, look at your question and say “Nova, answer this”.
- **Use the Windows Snipping Tool**: press **Win+Shift+S**, snip the question, then press **Ctrl+V** in Nova and hit Enter. You can also drag in or attach any image (paperclip icon).

Shortcut: **Ctrl+Shift+S** opens Nova's snipper.

## Desktop app

Download it from the [latest release](https://github.com/sashauzberg-oss/AI_assistant/releases/latest): `Nova-Setup.exe` (Windows), `Nova-Mac.dmg` (Mac) or `Nova-Linux.AppImage` (Linux).

**The typing bar.** Press **Alt+Space** (⌥Space on a Mac) anywhere and a slim typing bar appears near the top of the screen, with your pet sitting next to it. Type and press Enter: your pet's answer scrolls by in a one-line pixel ticker just under the bar (hover to pause it, scroll it with the mouse wheel, click ⤢ to open the whole answer, or ✕ to hide it), next to compact music controls and timers. Nothing takes more than about 25px below the bar, and the pet picker swaps in for the typing row so it adds no height at all. Press **Esc** or click somewhere else to put it away. The 📌 button keeps it open, and you can drag the bar by its dotted handle.

**Snip anything.** Press **Ctrl+Shift+Space** (⌘⇧Space on a Mac) in any app: a game, a PDF, a quiz, your code editor.

1. The screen freezes and dims. Pick what to do in the toolbar at the top: **Answer** (1), **Copy text** (2), **Translate** (3) or **Explain** (4).
2. Drag a box around it (or press **Enter** for the whole screen, **Esc** to cancel).
3. A small bubble appears next to your selection and fills in as Nova answers. With **Copy text**, the text lands on your clipboard, so you can paste text from images, videos or PDFs that won't let you select it.

Other things to know:

- Nova keeps running in the system tray, so both shortcuts always work. Quit from the tray icon.
- Typing “answer this” or pressing ✂️ in the bar uses the same snipper (the bar hides itself while you snip).
- Nova can open apps on your computer: “open Spotify”, “open calculator”, “launch Discord”.
- When the bar is put away while Nova is still answering, you get a notification when the answer is ready.
- Change the shortcuts, or turn on **Start Nova when I sign in** (Windows and Mac), in **Settings › Desktop**.

### Run it from source

```bash
npm install
```

```bash
npm run desktop
```

Paste your API key in Settings the first time. The desktop app keeps it in its own data folder (`%APPDATA%\Nova` on Windows, `~/Library/Application Support/Nova` on Mac, `~/.config/Nova` on Linux). When run from source it also reads the project's `.env`.

### Build an installer

```bash
npm run dist
```

This creates an installer in `dist/` for the system you run it on: a setup `.exe` on Windows, a `.dmg` on Mac, or an `.AppImage` on Linux. Build on Windows to get the Windows installer, and on a Mac to get the Mac one.

The installers aren't code-signed, so the first time you open Nova, Windows may show a “Windows protected your PC” screen (click **More info › Run anyway**) and macOS may refuse to open it (right-click the app and choose **Open**).

### Desktop notes

- **Mac**: the first snip asks for **Screen Recording** permission. Turn Nova on in System Settings › Privacy & Security › Screen Recording, then restart Nova.
- **Voice input isn't available in the desktop app**, because Electron (which the app is built on) has no speech-recognition service. Read-aloud answers still work. For voice commands, use the web version in Chrome or Edge.
- **Linux**: the hotkey works on X11. On Wayland, many desktops block global shortcuts for apps; use the tray menu's **Snip & answer** instead.
- “weather” without a city can't find your location in the desktop app. Set your **home city** in Settings › Personal, or name a city (“weather in Paris”).

## Voice

- **Microphone button**: say one thing.
- **Hands-free** (the radio-waves icon): Nova keeps listening for “Nova”, as in “Nova, play some jazz” or “Nova, set a timer for 5 minutes”. Say just “Nova”, wait for the chime, then say your command.
- **Read aloud** (the speaker icon): Nova speaks its answers. By default it always answers out loud when you talk to it.

Voice input uses the browser's speech recognition, which works best in Chrome and Edge.

## Where the music comes from

- **Genres and moods** (jazz, chill, focus, lofi, rock, 80s, Christmas…): listener-supported [SomaFM](https://somafm.com) radio.
- **Artists and songs**: 30-second previews from the iTunes catalog, queued like a playlist, each with a link to the full song on YouTube.
- **Anything else** (k-pop, classical, a station name): the community [radio-browser.info](https://www.radio-browser.info) directory.
- **No internet?** Nova generates its own lo-fi, ambient, piano or upbeat music live in the browser, so “music” always plays something.

## Settings

Put these in `.env` (see `.env.example`):

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | | Your Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | The Claude model. `claude-sonnet-5-5` or `claude-haiku-5-5` cost less |
| `AI_EFFORT` | `medium` | How hard Claude thinks: `low`, `medium`, `high`, `xhigh`, `max` |
| `PORT` | `3000` | Port for the web server |
| `HOST` | `127.0.0.1` | Set to `0.0.0.0` to open Nova from your phone on the same Wi-Fi (`http://<your-computer-ip>:3000`). Browsers only allow the microphone and screen capture on `localhost` or HTTPS, so those two features work only on the computer itself. |

The desktop app always listens on `127.0.0.1:47823`, and reads `ANTHROPIC_MODEL` and `AI_EFFORT` from the `.env` in its data folder.

## Privacy

- Your API key stays on your computer, in `.env`. It's never sent to the browser.
- Messages and screenshots go to Anthropic only when the AI answers you. Built-in commands never leave your computer, apart from the free services they use (weather from Open-Meteo, Wikipedia, dictionaryapi.dev, iTunes Search, radio-browser.info, and exchange rates from Frankfurter).
- Things you ask Nova to remember, and your home city, are sent along with each AI request so it can use them. Clear them anytime in Settings › Personal.
- Nova reads your clipboard only when you ask it to (“summarize my clipboard”). Generated passwords are never sent to the AI.
- Notes, memories, timers and settings are stored in your browser (or in the desktop app).
- The server listens only on `localhost` unless you change `HOST`.

## How it works

```
server.js            Express server: serves the app, proxies the free web services, streams /api/chat
lib/assistant.js     Claude setup: system prompt, tool definitions, streaming, retries, refusal fallbacks
lib/services.js      Weather, Wikipedia, dictionary, song previews and radio search
public/index.html    The page
public/js/app.js     Chat UI and wiring
public/js/ai.js      Streams Claude's answers and runs its tool calls in the browser
public/js/tools.js   Everything Nova can do (music, screen capture, timers, weather, notes, links…)
public/js/commands.js  Understands built-in commands without AI (offline mode, instant controls)
public/js/extras.js  Unit and currency conversion parsing, password generator
public/js/pets.js    The pixel pets: 16×16 sprites drawn in code, animation, and the pet picker
public/js/autocorrect.js  Auto-correct: dictionary lookup, closest-word suggestions, undo
public/data/words.txt  The auto-correct dictionary (about 63,000 words from SCOWL; see WORDS-LICENSE.txt)
public/fonts/        Pixelify Sans and Press Start 2P pixel fonts (SIL Open Font License)
public/js/music.js   Music player; synth.js generates offline music
public/js/screen.js  The snipping tool
public/js/voice.js   Speech recognition, wake word and read-aloud
desktop/main.js      Desktop app: the floating bar, tray, global hotkeys, native screen capture, answer bubble
desktop/apps.js      Opens installed apps by name (Start menu on Windows, `open -a` on Mac, .desktop files on Linux)
desktop/ui/          The snip overlay and the answer bubble
desktop/*.cjs        Bridges that give each desktop window only the functions it needs
```

Claude decides what to do and calls tools such as `play_music`, `capture_screen`, `set_timer` or `get_weather`. Those tools run in your browser, where the speakers, screen and microphone are, and their results go back to Claude. Claude can also search and read the web on its own. The model's server-side refusal fallback is turned on, so if a request is declined, the API retries it on a fallback model automatically.

## Tests

```bash
npm test
```

This runs the command-parser and calculator tests and an end-to-end test of the server against a fake Claude API.

## Troubleshooting

- **No sound after asking for music**: some browsers block autoplay until you've clicked the page. Press ▶ in the player bar.
- **“answer this” captured the wrong thing**: pick the specific window or tab with the question instead of the entire screen, since your whole screen will mostly show Nova itself.
- **The microphone doesn't work**: allow microphone access in the address bar, and use Chrome or Edge.
- **The radio doesn't start**: some networks block streaming. Nova falls back to its built-in music automatically.
- **The desktop hotkey does nothing**: another app may already use it. Nova tells you at startup; pick a different shortcut in Settings › Desktop.
