// The music player: genre radio (SomaFM), any artist or song (30-second iTunes previews),
// a worldwide radio directory (radio-browser.info) and offline generated music as the last resort.
import { Synth, SYNTH_STYLES } from "./synth.js";
import { getJson, storage } from "./util.js";
import { setIcon } from "./icons.js";

const somaUrls = (id) => [1, 2].map((n) => `https://ice${n}.somafm.com/${id}-128-mp3`);

// Listener-supported SomaFM channels: https://somafm.com
export const STATIONS = {
  groovesalad: ["Groove Salad", "Ambient and downtempo grooves"],
  dronezone: ["Drone Zone", "Atmospheric ambient for sleep and focus"],
  spacestation: ["Space Station Soma", "Spaced-out ambient and mid-tempo electronica"],
  deepspaceone: ["Deep Space One", "Deep ambient electronic"],
  lush: ["Lush", "Mellow vocals with an electronic touch"],
  fluid: ["Fluid", "Instrumental hip-hop and lo-fi beats"],
  sonicuniverse: ["Sonic Universe", "Transcending jazz"],
  bossa: ["Bossa Beyond", "Bossa nova and samba"],
  secretagent: ["Secret Agent", "Lounge and spy soundtracks"],
  beatblender: ["Beat Blender", "Deep house and downtempo"],
  defcon: ["DEF CON Radio", "Electronic music for coding"],
  dubstep: ["Dub Step Beyond", "Dubstep and bass music"],
  poptron: ["PopTron", "Electropop and indie dance"],
  indiepop: ["Indie Pop Rocks!", "Indie pop and new favorites"],
  bagel: ["BAGeL Radio", "Alternative rock"],
  seventies: ["Left Coast 70s", "Mellow album rock from the 70s"],
  u80s: ["Underground 80s", "Synth-pop and new wave"],
  bootliquor: ["Boot Liquor", "Americana and country roots"],
  folkfwd: ["Folk Forward", "Indie folk and acoustic"],
  metal: ["Metal Detector", "Heavy metal"],
  "7soul": ["Seven Inch Soul", "Vintage soul and funk"],
  reggae: ["Heavyweight Reggae", "Reggae, ska and dub"],
  thistle: ["ThistleRadio", "Celtic music"],
  suburbsofgoa: ["Suburbs of Goa", "Desi-influenced world beats"],
  christmas: ["Christmas Lounge", "Chilled holiday music"],
  vaporwaves: ["Vaporwaves", "Vaporwave"],
  darkzone: ["The Dark Zone", "Dark ambient"],
  cliqhop: ["cliqhop idm", "Intelligent dance music"],
  covers: ["Covers", "Songs you know by artists you don't"],
};

// Genre and mood words -> station, optional directory search to try first, offline style.
// Specific genres come before moods, so "relaxing jazz" plays jazz.
const GENRES = [
  { re: /\b(christmas|xmas|holiday|festive|santa)\b/, station: "christmas", synth: "piano" },
  { re: /\b(lo-?fi|chillhop|beats to study( to)?|instrumental hip ?hop)\b/, station: "fluid", synth: "lofi" },
  { re: /\b(jazz|jazzy|saxophone)\b/, station: "sonicuniverse", synth: "piano" },
  { re: /\b(bossa( nova)?|samba|brazil\w*)\b/, station: "bossa", synth: "piano" },
  { re: /\b(lounge|spy|cocktail|secret agent|retro|exotica)\b/, station: "secretagent", synth: "lofi" },
  { re: /\b(deep house|house|dance|party|club|edm|disco)\b/, station: "beatblender", synth: "upbeat" },
  { re: /\b(techno|electronic\w*|hacking|coding|programming|cyberpunk|synthwave|trance)\b/, station: "defcon", synth: "upbeat" },
  { re: /\b(dubstep|bass music|drum and bass|dnb)\b/, station: "dubstep", synth: "upbeat" },
  { re: /\b(pop|top hits|top 40|charts?)\b/, search: "pop", station: "poptron", synth: "upbeat" },
  { re: /\b(indie)\b/, station: "indiepop", synth: "upbeat" },
  { re: /\b(alternative|alt rock|grunge|punk)\b/, station: "bagel", synth: "upbeat" },
  { re: /\b(80s|eighties|synth-?pop|new wave)\b/, station: "u80s", synth: "upbeat" },
  { re: /\b(70s|seventies)\b/, station: "seventies", synth: "lofi" },
  { re: /\b(classic rock|rock|guitar)\b/, search: "classic rock", station: "seventies", synth: "upbeat" },
  { re: /\b(country|americana|bluegrass|western)\b/, station: "bootliquor", synth: "piano" },
  { re: /\b(folk|acoustic|singer.songwriter)\b/, station: "folkfwd", synth: "piano" },
  { re: /\b(heavy metal|metal|hard rock|headbang\w*)\b/, station: "metal", synth: "upbeat" },
  { re: /\b(soul|funk|funky|motown|r&b|rnb)\b/, station: "7soul", synth: "lofi" },
  { re: /\b(reggae|ska|dub)\b/, station: "reggae", synth: "lofi" },
  { re: /\b(celtic|irish|scottish)\b/, station: "thistle", synth: "piano" },
  { re: /\b(world|indian|desi|bollywood)\b/, search: "bollywood", station: "suburbsofgoa", synth: "lofi" },
  { re: /\b(vaporwave)\b/, station: "vaporwaves", synth: "lofi" },
  { re: /\b(dark|spooky|halloween|horror|creepy|scary)\b/, station: "darkzone", synth: "ambient" },
  { re: /\b(idm|glitch)\b/, station: "cliqhop", synth: "upbeat" },
  { re: /\b(covers)\b/, station: "covers", synth: "lofi" },
  { re: /\b(hip ?hop|rap|trap|drill)\b/, search: "hip hop", station: "fluid", synth: "lofi" },
  { re: /\b(classical|orchestra\w*|symphon\w*|mozart|beethoven|bach|chopin|opera|baroque|piano)\b/, search: "classical", synth: "piano" },
  { re: /\b(k-?pop|j-?pop|anime|latin|reggaeton|salsa|gospel|christian|worship|blues|kids|children'?s|afrobeats?|oldies|50s|60s|90s|2000s)\b/, searchFromMatch: true, synth: "upbeat" },
  { re: /\b(sleep\w*|meditat\w*|ambient|drone|spa|yoga|zen|calming|white noise|rain sounds|nature sounds)\b/, station: "dronezone", synth: "ambient" },
  { re: /\b(space|cosmic|sci-?fi|galaxy)\b/, station: "spacestation", synth: "ambient" },
  { re: /\b(workout|gym|running|exercise|pump( up)?|cardio)\b/, search: "workout", station: "poptron", synth: "upbeat" },
  { re: /\b(happy|upbeat|energetic|energy|good vibes|feel good|summer|fun)\b/, station: "poptron", synth: "upbeat" },
  { re: /\b(sad|melancholy|rainy|heartbreak|romantic|love|date night|sensual)\b/, station: "lush", synth: "ambient" },
  { re: /\b(chill\w*|relax\w*|calm|study\w*|focus\w*|homework|concentrat\w*|working|work|background|downtempo|coffee|cafe|reading|easy listening)\b/, station: "groovesalad", synth: "lofi" },
];

// Words that can sit next to a genre without making it a song or artist name.
const FILLER = new Set(
  "some music good nice great best cool soft smooth classic old new slow fast light instrumental modern live beautiful mellow quiet loud little of and with vibes while to for in the my a radio station fm songs hits".split(" "),
);
const GENERIC = /^(radio|station|something|anything|good|nice|great|cool|random|whatever|you like|your choice)?$/;

/** A genre entry if the query is only genre/mood words ("relaxing jazz"), else null ("Pop Smoke"). */
function matchGenre(q) {
  const genre = GENRES.find((g) => g.re.test(q));
  if (!genre) return null;
  let rest = q;
  for (const g of GENRES) rest = rest.replace(new RegExp(g.re.source, "g"), " ");
  const leftovers = rest.split(/\s+/).filter((w) => w && !FILLER.has(w));
  return leftovers.length ? null : genre;
}

function cleanQuery(query) {
  return String(query)
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .replace(/^(me|us)\s+/, "")
    .replace(/^(some|a little|a bit of|any|the|a|an)\s+/, "")
    .replace(/\b(music|songs?|tunes|playlist|mix|please|for me|right now|now|instead|kind of|type of|genre)\b/g, " ")
    .replace(/^\s*(something|anything)\s*/, "")
    .replace(/^\s*by\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const youtubeSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

function stationItem(id) {
  const [title, subtitle] = STATIONS[id];
  return { kind: "stream", id, title, subtitle, urls: somaUrls(id), badge: "Radio", link: `https://somafm.com/${id}/` };
}

function synthItem(style = "lofi") {
  const s = SYNTH_STYLES[style] ? style : "lofi";
  return { kind: "synth", style: s, title: SYNTH_STYLES[s].name, subtitle: "Nova's built-in music, works offline", badge: "Offline" };
}

async function searchSongs(q) {
  const { tracks } = await getJson(`/api/music/songs?q=${encodeURIComponent(q.replace(/\bby\b/g, " "))}`);
  return tracks.map((t) => ({
    kind: "preview",
    title: t.title,
    subtitle: t.artist,
    urls: [t.preview],
    art: t.artwork,
    badge: "Preview",
    link: youtubeSearch(`${t.artist} ${t.title}`),
  }));
}

async function searchRadio(q) {
  const { stations } = await getJson(`/api/music/radio?q=${encodeURIComponent(q)}`);
  const httpsOnly = location.protocol === "https:";
  return stations
    .filter((s) => !httpsOnly || s.url.startsWith("https:"))
    .map((s) => ({
      kind: "stream",
      title: s.name,
      subtitle: [s.tags, s.country].filter(Boolean).join(" · ") || "Internet radio",
      urls: [s.url],
      art: s.favicon,
      badge: "Radio",
      link: s.homepage,
    }));
}

export class MusicPlayer extends EventTarget {
  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = "none";
    this.synth = new Synth();
    this.queue = [];
    this.index = -1;
    this.current = null;
    this.status = "idle"; // idle | loading | playing | paused | blocked
    this.token = 0;
    this.volume = storage.get("volume", 0.7);
    this.audio.volume = this.volume;
    this.synth.setVolume(this.volume);
    this.lastQuery = "";

    this.audio.addEventListener("ended", () => {
      if (this.status !== "playing") return;
      // A live stream that drops gets one reconnect; if it keeps ending, move on.
      const recentlyRetried = Date.now() - (this.lastReconnect || 0) < 15000;
      if (this.current?.kind === "stream" && !recentlyRetried) {
        this.lastReconnect = Date.now();
        this.recover(true);
      } else {
        this.next();
      }
    });
    this.audio.addEventListener("error", () => {
      // A stream that drops after it started: move on instead of going silent.
      if (this.status === "playing" && !this.starting && this.current?.kind !== "synth") this.recover();
    });
  }

  setStatus(status) {
    this.status = status;
    this.dispatchEvent(new Event("change"));
  }

  describe() {
    const item = this.current;
    if (!item || this.status === "idle") return "Nothing is playing.";
    const state = this.status === "paused" ? "Paused" : this.status === "blocked" ? "Ready (the user must press play)" : "Now playing";
    if (item.kind === "preview") {
      return `${state}: "${item.title}" by ${item.subtitle} (30-second preview, track ${this.index + 1} of ${this.queue.length} in the queue).`;
    }
    if (item.kind === "synth") return `${state}: ${item.title}, Nova's built-in generated music.`;
    return `${state}: ${item.title} radio (${item.subtitle}).`;
  }

  /** Resolve a free-form request ("jazz", "taylor swift", "") into something playable and start it. */
  async play(query = "") {
    const token = ++this.token;
    this.lastQuery = query;
    const raw = String(query).trim();
    let q = cleanQuery(raw);
    if (GENERIC.test(q)) q = "";
    const wantsRadio = !!q && /\b(radio|station|fm)\b/i.test(raw);
    const genre = q ? matchGenre(q) : null;

    this.stopOutputs();
    this.current = { kind: "loading", title: "Finding music…", subtitle: raw || "Something good", badge: "" };
    this.setStatus("loading");

    const candidates = [];
    if (!q) {
      candidates.push(() => [stationItem("groovesalad")]);
    } else if (/\b(built.?in|offline|generat\w*|synth)\b/.test(q)) {
      // handled by the final synth fallback
    } else if (genre) {
      const search = genre.search || (genre.searchFromMatch ? q.match(genre.re)[0] : null);
      if (search) candidates.push(() => searchRadio(search));
      if (genre.station) candidates.push(() => [stationItem(genre.station)]);
      if (search) candidates.push(() => searchSongs(search));
    } else if (wantsRadio) {
      const name = raw.replace(/^(some|the)\s+/i, "");
      candidates.push(() => searchRadio(name));
      candidates.push(() => searchRadio(q.replace(/\b(radio|station|fm)\b/g, " ").trim() || q));
    } else {
      candidates.push(() => searchSongs(q));
      candidates.push(() => searchRadio(q));
    }
    const synthStyle = genre?.synth || (q.includes("ambient") ? "ambient" : "lofi");
    candidates.push(() => [synthItem(synthStyle)]);

    let note = "";
    for (const build of candidates) {
      if (token !== this.token) return { ok: false, message: "Cancelled by a newer request." };
      let items;
      try {
        items = await build();
      } catch {
        items = null;
      }
      if (!items?.length) continue;
      this.queue = items;
      for (let i = 0; i < Math.min(items.length, 3); i++) {
        const result = await this.playIndex(i, token);
        if (token !== this.token) return { ok: false, message: "Cancelled by a newer request." };
        if (result.ok) {
          if (items[i].kind === "synth" && candidates.length > 1) {
            note = " The online sources didn't respond, so Nova is playing its own offline music instead.";
          }
          return { ok: true, blocked: result.blocked, message: this.describe() + note, item: this.current };
        }
      }
    }
    this.current = null;
    this.setStatus("idle");
    return { ok: false, message: "Couldn't play anything. Audio may be blocked in this browser." };
  }

  async playIndex(index, token = ++this.token) {
    const item = this.queue[index];
    if (!item) return { ok: false };
    this.index = index;
    this.stopOutputs();
    this.current = item;
    this.setStatus("loading");

    if (item.kind === "synth") {
      try {
        await this.synth.start(item.style);
        this.synth.setVolume(this.volume);
        if (this.synth.ctx.state !== "running") {
          this.setStatus("blocked");
          return { ok: true, blocked: true };
        }
        this.setStatus("playing");
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }

    for (const url of item.urls) {
      if (token !== this.token) return { ok: false };
      try {
        await this.playUrl(url);
        if (token !== this.token) return { ok: false };
        this.setStatus("playing");
        return { ok: true };
      } catch (err) {
        if (err.name === "NotAllowedError") {
          this.setStatus("blocked");
          return { ok: true, blocked: true };
        }
      }
    }
    return { ok: false };
  }

  playUrl(url) {
    const audio = this.audio;
    this.starting = true;
    audio.src = url;
    audio.volume = this.volume;
    return new Promise((resolve, reject) => {
      const finish = (fn, value) => {
        clearTimeout(timer);
        audio.removeEventListener("playing", onPlaying);
        audio.removeEventListener("error", onError);
        this.starting = false;
        fn(value);
      };
      const onPlaying = () => finish(resolve);
      const onError = () => finish(reject, new Error("The stream couldn't be loaded"));
      const timer = setTimeout(() => finish(reject, new Error("The stream took too long to start")), 8000);
      audio.addEventListener("playing", onPlaying);
      audio.addEventListener("error", onError);
      audio.play().catch((err) => {
        if (err.name === "NotAllowedError" || err.name === "NotSupportedError") finish(reject, err);
      });
    });
  }

  async recover(retryCurrent = false) {
    const token = ++this.token;
    for (let i = retryCurrent ? this.index : this.index + 1; i < this.queue.length; i++) {
      if ((await this.playIndex(i, token)).ok) return;
    }
    if (token !== this.token) return;
    this.queue = [synthItem("lofi")];
    await this.playIndex(0, token);
  }

  stopOutputs() {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.synth.stop();
    if (this.synth.ctx?.state === "suspended") this.synth.ctx.resume();
  }

  async pause() {
    if (this.status !== "playing") return this.describe();
    if (this.current?.kind === "synth") await this.synth.ctx.suspend();
    else this.audio.pause();
    this.setStatus("paused");
    return this.describe();
  }

  async resume() {
    if (this.status === "paused") {
      if (this.current?.kind === "synth") await this.synth.ctx.resume();
      else await this.audio.play().catch(() => {});
      this.setStatus("playing");
      return { ok: true, message: this.describe() };
    }
    if (this.status === "blocked") {
      const result = await this.playIndex(this.index);
      return { ok: result.ok, message: this.describe() };
    }
    if (this.status === "idle") return this.play(this.lastQuery);
    return { ok: true, message: this.describe() };
  }

  async next() {
    if (this.status === "idle") return this.play("");
    const token = ++this.token;
    if (this.index + 1 < this.queue.length) {
      for (let i = this.index + 1; i < this.queue.length; i++) {
        if ((await this.playIndex(i, token)).ok) return { ok: true, message: this.describe() };
        if (token !== this.token) return { ok: false, message: "Cancelled." };
      }
    }
    if (this.current?.kind === "synth") {
      const styles = Object.keys(SYNTH_STYLES).filter((s) => s !== this.current.style);
      this.queue = [synthItem(styles[Math.floor(Math.random() * styles.length)])];
    } else if (this.current?.kind === "preview" && this.queue.length > 1) {
      // End of the preview queue: loop back to the first track (queue stays as it is).
    } else {
      const ids = Object.keys(STATIONS).filter((id) => id !== this.current?.id && id !== "christmas");
      this.queue = [stationItem(ids[Math.floor(Math.random() * ids.length)])];
    }
    const result = await this.playIndex(0, token);
    if (!result.ok && token === this.token) {
      this.queue = [synthItem("lofi")];
      await this.playIndex(0, token);
    }
    return { ok: true, message: this.describe() };
  }

  stop() {
    ++this.token;
    this.stopOutputs();
    this.current = null;
    this.queue = [];
    this.setStatus("idle");
    return "Music stopped.";
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.audio.volume = this.volume;
    this.synth.setVolume(this.volume);
    storage.set("volume", this.volume);
    this.dispatchEvent(new Event("change"));
  }
}

/** Binds a MusicPlayer to the player bar in the page. */
export class PlayerView {
  constructor(player, root) {
    this.player = player;
    this.root = root;
    this.el = {
      art: root.querySelector("#player-art"),
      title: root.querySelector("#player-title"),
      sub: root.querySelector("#player-sub"),
      badge: root.querySelector("#player-badge"),
      toggle: root.querySelector("#player-toggle"),
      next: root.querySelector("#player-next"),
      stop: root.querySelector("#player-stop"),
      link: root.querySelector("#player-link"),
      volume: root.querySelector("#player-volume"),
      viz: root.querySelector("#player-viz"),
    };
    this.bars = new Array(24).fill(0);
    this.el.toggle.addEventListener("click", () => {
      if (player.status === "playing") player.pause();
      else player.resume();
    });
    this.el.next.addEventListener("click", () => player.next());
    this.el.stop.addEventListener("click", () => player.stop());
    this.el.volume.addEventListener("input", () => player.setVolume(Number(this.el.volume.value) / 100));
    player.addEventListener("change", () => this.render());
    this.render();
  }

  render() {
    const { player, el } = this;
    const item = player.current;
    this.root.hidden = player.status === "idle" || !item;
    if (this.root.hidden) {
      this.stopViz();
      return;
    }
    el.title.textContent = item.title;
    el.sub.textContent = item.subtitle || "";
    el.badge.hidden = !item.badge;
    el.badge.textContent = item.badge || "";
    if (item.art) {
      if (el.art.dataset.src !== item.art) {
        el.art.dataset.src = item.art;
        el.art.replaceChildren();
        const img = new Image();
        img.alt = "";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => {
          el.art.dataset.src = "";
          setIcon(el.art, "music");
        };
        img.src = item.art;
        el.art.append(img);
      }
    } else if (el.art.dataset.src !== "") {
      el.art.dataset.src = "";
      setIcon(el.art, "music");
    }
    el.link.hidden = !item.link;
    if (item.link) {
      el.link.href = item.link;
      el.link.title = item.kind === "preview" ? "Listen to the full song on YouTube" : "Open the station's website";
    }
    const playing = player.status === "playing" || player.status === "loading";
    setIcon(el.toggle, playing ? "pause" : "play");
    el.toggle.title = player.status === "blocked" ? "Press to start the music" : playing ? "Pause" : "Play";
    this.root.classList.toggle("blocked", player.status === "blocked");
    el.volume.value = String(Math.round(player.volume * 100));
    if (player.status === "playing") this.startViz();
    else this.stopViz(true);
  }

  startViz() {
    if (this.raf) return;
    const draw = () => {
      this.raf = requestAnimationFrame(draw);
      this.drawViz();
    };
    draw();
  }

  stopViz(keepFrame = false) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (!keepFrame) return;
    this.bars.fill(0.06);
    this.drawViz(true);
  }

  drawViz(still = false) {
    const canvas = this.el.viz;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const n = this.bars.length;
    const analyser = this.player.current?.kind === "synth" ? this.player.synth.analyser : null;
    let data = null;
    if (analyser && !still) {
      data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
    }
    const t = performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      let target;
      if (still) target = 0.06;
      else if (data) target = data[Math.floor((i / n) * data.length * 0.7)] / 255;
      else target = 0.25 + 0.55 * Math.abs(Math.sin(t * (1.3 + (i % 5) * 0.37) + i * 0.9)) * (0.6 + 0.4 * Math.sin(t * 0.7 + i));
      this.bars[i] += (target - this.bars[i]) * 0.25;
    }
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#8b5cf6");
    gradient.addColorStop(1, "#22d3ee");
    ctx.fillStyle = gradient;
    const gap = 2;
    const w = (width - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const h = Math.max(2, this.bars[i] * height);
      ctx.fillRect(i * (w + gap), (height - h) / 2, w, h);
    }
  }
}
