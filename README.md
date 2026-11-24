# Nova: your AI assistant

Nova is an AI assistant that runs in your browser. Type or say what you want and it does it:

| You say | Nova does |
|---|---|
| **music** | Starts playing music right away |
| **play some jazz**, **lofi**, **play Taylor Swift**, **BBC radio** | Plays a genre station, song previews, or a radio station |
| **answer this** | Snips your screen, reads the question and answers it |
| **timer 10 minutes**, **remind me in 20 min to stretch**, **alarm at 7:30 am** | Sets timers and alarms, with a sound and a notification |
| **weather**, **weather in Tokyo** | Shows the current weather and a 4-day forecast |
| **open YouTube**, **cat videos on YouTube**, **search pizza near me** | Opens sites and searches |
| **note buy milk**, **show my notes** | Keeps a notes and to-do list |
| **what's 15% of 80**, **define serendipity**, **who is Ada Lovelace** | Calculates and looks things up |
| *anything else* | Answers it with Claude, searching the web when needed |

It also has voice control (including a hands-free mode with the wake word **“Nova”**), read-aloud answers, light and dark themes, and a layout that works on phones.

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

## Privacy

- Your API key stays on your computer, in `.env`. It's never sent to the browser.
- Messages and screenshots go to Anthropic only when the AI answers you. Built-in commands never leave your computer, apart from the free services they use (weather from Open-Meteo, Wikipedia, dictionaryapi.dev, iTunes Search and radio-browser.info).
- Notes, timers and settings are stored in your browser.
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
public/js/music.js   Music player; synth.js generates offline music
public/js/screen.js  The snipping tool
public/js/voice.js   Speech recognition, wake word and read-aloud
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
