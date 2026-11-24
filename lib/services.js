// Free, key-less web services the assistant uses (weather, Wikipedia, dictionary, music search).
// The browser calls these through our server so it never hits CORS problems.

const HEADERS = { "User-Agent": "NovaAssistant/1.0 (local personal assistant app)", Accept: "application/json" };

async function getJson(url, { timeout = 8000 } = {}) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeout) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.json();
}

// ---------- Weather (Open-Meteo) ----------

const WEATHER_CODES = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Violent rain showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Thunderstorm with hail", "⛈️"],
};

function describeCode(code) {
  const [text, icon] = WEATHER_CODES[code] || ["Unknown", "🌡️"];
  return { text, icon };
}

async function geocode(query) {
  const [name, ...rest] = query.split(",").map((s) => s.trim()).filter(Boolean);
  if (!name) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=${encodeURIComponent(name)}`;
  const data = await getJson(url);
  const results = data?.results || [];
  if (!results.length) return null;
  const hint = rest.join(" ").toLowerCase();
  const match =
    (hint &&
      results.find((r) =>
        [r.country, r.admin1, r.country_code].some((v) => v && (v.toLowerCase().includes(hint) || hint.includes(v.toLowerCase()))),
      )) ||
    results[0];
  return {
    latitude: match.latitude,
    longitude: match.longitude,
    label: [match.name, match.admin1, match.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", "),
  };
}

export async function weather({ q, lat, lon, units }) {
  let place;
  if (q) {
    place = await geocode(q);
    if (!place) return { error: `I couldn't find a place called "${q}".` };
  } else if (Number.isFinite(lat) && Number.isFinite(lon)) {
    place = { latitude: lat, longitude: lon, label: "Your location" };
  } else {
    return { error: "No location given." };
  }
  const imperial = units === "imperial";
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "4",
    temperature_unit: imperial ? "fahrenheit" : "celsius",
    wind_speed_unit: imperial ? "mph" : "kmh",
  });
  const data = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!data?.current) return { error: "The weather service didn't return data." };
  const c = data.current;
  const d = data.daily || {};
  return {
    location: place.label,
    units: imperial ? "imperial" : "metric",
    tempUnit: imperial ? "°F" : "°C",
    windUnit: imperial ? "mph" : "km/h",
    current: {
      temperature: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      wind: Math.round(c.wind_speed_10m),
      isDay: !!c.is_day,
      ...describeCode(c.weather_code),
    },
    daily: (d.time || []).map((date, i) => ({
      date,
      high: Math.round(d.temperature_2m_max[i]),
      low: Math.round(d.temperature_2m_min[i]),
      rainChance: d.precipitation_probability_max?.[i] ?? null,
      ...describeCode(d.weather_code[i]),
    })),
  };
}

// ---------- Wikipedia ----------

export async function wiki(q) {
  const search = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(q)}`,
  );
  const title = search?.query?.search?.[0]?.title;
  if (!title) return { error: `Wikipedia has nothing on "${q}".` };
  const page = await getJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  );
  if (!page) return { error: `Wikipedia has nothing on "${q}".` };
  return {
    title: page.title,
    description: page.description || "",
    extract: page.extract || "",
    url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    thumbnail: page.thumbnail?.source || null,
  };
}

// ---------- Dictionary ----------

export async function define(word) {
  const data = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!Array.isArray(data) || !data.length) return { error: `I couldn't find a definition for "${word}".` };
  const entry = data[0];
  return {
    word: entry.word,
    phonetic: entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "",
    meanings: (entry.meanings || []).slice(0, 3).map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions || []).slice(0, 2).map((d) => ({ definition: d.definition, example: d.example || "" })),
    })),
  };
}

// ---------- Music: song previews (iTunes Search) ----------

export async function songs(q) {
  const data = await getJson(
    `https://itunes.apple.com/search?media=music&entity=song&limit=20&term=${encodeURIComponent(q)}`,
  );
  const tracks = (data?.results || [])
    .filter((t) => t.previewUrl)
    .map((t) => ({
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName || "",
      preview: t.previewUrl,
      artwork: t.artworkUrl100 ? t.artworkUrl100.replace("100x100", "300x300") : null,
      link: t.trackViewUrl || null,
    }));
  return { tracks };
}

// ---------- Music: internet radio (radio-browser.info community directory) ----------

const RADIO_MIRRORS = ["de1", "nl1", "at1"];
const PLAYABLE_CODECS = /^(mp3|aac|aac\+|ogg|opus)$/i;

async function radioQuery(params) {
  let lastError;
  for (const mirror of RADIO_MIRRORS) {
    try {
      const url = `https://${mirror}.api.radio-browser.info/json/stations/search?${new URLSearchParams({
        limit: "30",
        order: "clickcount",
        reverse: "true",
        hidebroken: "true",
        ...params,
      })}`;
      return (await getJson(url, { timeout: 6000 })) || [];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function radio(q) {
  let list = await radioQuery({ tag: q });
  if (!list.length) list = await radioQuery({ name: q });
  const seen = new Set();
  const stations = list
    .filter((s) => s.url_resolved && s.hls !== 1 && PLAYABLE_CODECS.test(s.codec || "") && s.lastcheckok !== 0)
    .filter((s) => (seen.has(s.name) ? false : seen.add(s.name)))
    .slice(0, 12)
    .map((s) => ({
      name: (s.name || "Radio station").trim(),
      url: s.url_resolved,
      favicon: s.favicon || null,
      tags: (s.tags || "").split(",").slice(0, 4).join(", "),
      country: s.country || "",
      homepage: s.homepage || null,
    }));
  return { stations };
}
