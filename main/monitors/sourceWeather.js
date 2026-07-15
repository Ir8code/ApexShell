// Apex — weather monitor source (base-install tracker, 2026-07-15). Keyless
// end to end: Open-Meteo for forecast + geocoding (free, no account); for
// zero-config location a CHAIN of free IP-geo providers with a once-per-
// machine disk cache — the first cut leaned on ipapi.co alone and its free
// tier 429'd after a few restarts, which read as "weather is broken" (the operator).
// Set source.city for real accuracy; IP location is ISP-region grade.
// All provider shapes live-probed (2026-07-14/15), never guessed.
//
// source: { type:'weather', city?, lat?, lon?, units? ('imperial'|'metric') }
// Emits (the three tiers, the operator's spec):
//   bar chip  → status led + `now` ("☀ 85°" — first stat is the chip value)
//   quarter   → today's tile: now/cond/today/feels/wind/hum/place stats
//   full      → adds `days`, the week list (compact grids drop list widgets)
'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');

const LOC_CACHE = path.join(__dirname, '..', '..', 'state', 'weather-loc.json');

// WMO weather codes → words + glyphs (Open-Meteo's documented table)
const WMO = {
  0: ['Clear', '☀'], 1: ['Mostly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁'],
  45: ['Fog', '🌫'], 48: ['Icy fog', '🌫'],
  51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'],
  56: ['Freezing drizzle', '🌧'], 57: ['Freezing drizzle', '🌧'],
  61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'],
  66: ['Freezing rain', '🌧'], 67: ['Freezing rain', '🌧'],
  71: ['Light snow', '🌨'], 73: ['Snow', '🌨'], 75: ['Heavy snow', '🌨'], 77: ['Snow grains', '🌨'],
  80: ['Showers', '🌦'], 81: ['Showers', '🌧'], 82: ['Heavy showers', '🌧'],
  85: ['Snow showers', '🌨'], 86: ['Snow showers', '🌨'],
  95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm w/ hail', '⛈'], 99: ['Thunderstorm w/ hail', '⛈'],
};
const cond = (code) => (WMO[code] || ['code ' + code, ''])[0];
const icon = (code) => (WMO[code] || ['', '·'])[1];

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// zero-config IP location — provider CHAIN (each free tier is stingy alone;
// shapes probed live: ipwho.is numbers, ipapi.co numbers, geojs STRINGS)
async function ipLocate() {
  const tries = [
    ['https://ipwho.is/', (j) => j.success !== false && j.latitude != null &&
      { lat: j.latitude, lon: j.longitude, city: j.city }],
    ['https://ipapi.co/json/', (j) => j.latitude != null &&
      { lat: j.latitude, lon: j.longitude, city: j.city }],
    ['https://get.geojs.io/v1/ip/geo.json', (j) => j.latitude != null &&
      { lat: Number(j.latitude), lon: Number(j.longitude), city: j.city }],
  ];
  let lastErr = 'no provider answered';
  for (const [url, map] of tries) {
    try {
      const hit = map(await getJson(url));
      if (hit) return hit;
      lastErr = url + ' gave no coordinates';
    } catch (e) { lastErr = url + ' — ' + e.message; }
  }
  throw new Error(lastErr);
}

async function locate(src, log) {
  const sig = JSON.stringify({ z: src.zip || null, c: src.city || null,
                               la: src.lat ?? null, lo: src.lon ?? null });
  // config wins; the disk cache makes zero-config a ONCE-per-machine lookup
  try {
    const c = JSON.parse(fs.readFileSync(LOC_CACHE, 'utf8'));
    if (c.sig === sig && c.lat != null) return c;
  } catch { /* no cache yet */ }
  let out;
  if (src.zip) {
    out = await zipLocate(src.zip);
  } else if (src.lat != null && src.lon != null) {
    out = { lat: src.lat, lon: src.lon, place: src.place || src.city || 'configured' };
  } else if (src.city) {
    const g = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' +
      encodeURIComponent(src.city));
    const hit = g.results && g.results[0];
    if (!hit) throw new Error('city not found: ' + src.city);
    out = { lat: hit.latitude, lon: hit.longitude, place: hit.name };
  } else {
    const ip = await ipLocate();
    out = { lat: ip.lat, lon: ip.lon, place: (ip.city || '?') + ' (IP guess)' };
    log('located via IP: ' + out.place + ' — type your city in the Location field for accuracy');
  }
  out.sig = sig;
  try {
    fs.mkdirSync(path.dirname(LOC_CACHE), { recursive: true });
    fs.writeFileSync(LOC_CACHE, JSON.stringify(out));
  } catch { /* cache is a bonus, not a requirement */ }
  return out;
}

// live instances — the Location field's action needs to reach the running
// closure (re-locate + refire without a restart)
const INSTANCES = new Map();   // pane.id -> applyCity(city)

// panes.json is UI-written here (the standing operator rule: panels write
// config, hands don't) — the typed location persists across restarts
function persistLoc(paneId, key, value) {
  const p = path.join(__dirname, 'panes.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
    const pane = (cfg.panes || []).find((x) => x.id === paneId);
    if (!pane) return false;
    pane.source = pane.source || {};
    for (const k of ['zip', 'city', 'lat', 'lon']) delete pane.source[k];
    pane.source[key] = value;
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    return true;
  } catch { return false; }
}

// US ZIP → coordinates + "Town, ST" (zippopotam.us, keyless; shape probed
// 2026-07-15 — coords come back as STRINGS)
async function zipLocate(zip) {
  const j = await getJson('https://api.zippopotam.us/us/' + encodeURIComponent(zip));
  const pl = (j.places || [])[0];
  if (!pl) throw new Error('ZIP not found: ' + zip);
  return { lat: Number(pl.latitude), lon: Number(pl.longitude),
           place: pl['place name'] + ', ' + (pl['state abbreviation'] || '') };
}

function start(pane, ctx) {
  const src = pane.source || {};
  const metric = src.units === 'metric';
  let loc = null;
  let lastGood = 0;

  const fire = async () => {
    try {
      if (!loc) loc = await locate(src, ctx.log);
    } catch (e) {
      ctx.log('weather location failed: ' + e.message);
      ctx.emit({ status: 'warning', now: '—',
                 place: 'location unknown — set source.city in panes.json' });
      return;
    }
    try {
      const f = await getJson('https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + loc.lat + '&longitude=' + loc.lon +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
        '&temperature_unit=' + (metric ? 'celsius' : 'fahrenheit') +
        '&wind_speed_unit=' + (metric ? 'kmh' : 'mph') +
        '&timezone=auto&forecast_days=7');
      const c = f.current || {};
      const d = f.daily || {};
      const day = (i) => Math.round((d.temperature_2m_max || [])[i]) + '° / ' +
        Math.round((d.temperature_2m_min || [])[i]) + '°' +
        ((d.precipitation_probability_max || [])[i] != null
          ? ' · rain ' + d.precipitation_probability_max[i] + '%' : '');
      // the week as STRUCTURED day-tiles (the 'tiles' widget's shape)
      const week = (d.time || []).map((iso, i) => ({
        name: i === 0 ? 'Today'
          : new Date(iso + 'T12:00').toLocaleDateString([], { weekday: 'short' }),
        icon: icon((d.weather_code || [])[i]),
        cond: cond((d.weather_code || [])[i]),
        hi: Math.round((d.temperature_2m_max || [])[i]) + '°',
        lo: Math.round((d.temperature_2m_min || [])[i]) + '°',
        rain: (d.precipitation_probability_max || [])[i] != null
          ? d.precipitation_probability_max[i] + '%' : '',
      }));
      lastGood = Date.now();
      ctx.emit({
        status: 'good',
        now: icon(c.weather_code) + ' ' + Math.round(c.temperature_2m) + '°',
        cond: cond(c.weather_code),
        today: day(0),
        feels: Math.round(c.apparent_temperature) + '°',
        wind: Math.round(c.wind_speed_10m) + (metric ? ' km/h' : ' mph'),
        hum: c.relative_humidity_2m + '%',
        place: loc.place,
        week,
      });
    } catch (e) {
      ctx.log('weather: ' + e.message);
      // stale > 1h = the tile stops pretending; values keep their last paint
      if (Date.now() - lastGood > 3600e3) ctx.emit({ status: 'warning' });
    }
  };

  // the ZIP field lands here: validate, apply LIVE, persist to panes.json,
  // refetch — no restart. 5 digits = US ZIP (zippopotam, precise "Town, ST");
  // anything else falls back to the city geocoder as a courtesy.
  INSTANCES.set(pane.id, async (text) => {
    const isZip = /^\d{5}$/.test(text);
    let hit, key, value;
    if (isZip) {
      hit = await zipLocate(text);            // throws "ZIP not found" → catch below
      key = 'zip'; value = text;
    } else {
      const g = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' +
        encodeURIComponent(text));
      const r = g.results && g.results[0];
      if (!r) { ctx.log('weather: no such place — "' + text + '"'); return; }
      hit = { lat: r.latitude, lon: r.longitude, place: r.name };
      key = 'city'; value = text;
    }
    for (const k of ['zip', 'city', 'lat', 'lon']) delete src[k];
    src[key] = value;
    loc = { lat: hit.lat, lon: hit.lon, place: hit.place,
            sig: JSON.stringify({ z: src.zip || null, c: src.city || null, la: null, lo: null }) };
    try { fs.writeFileSync(LOC_CACHE, JSON.stringify(loc)); } catch { /* bonus */ }
    ctx.log('weather location → ' + hit.place +
      (persistLoc(pane.id, key, value) ? ' (saved to panes.json)' : ' (LIVE only — panes.json not writable)'));
    fire();
  });

  fire();
  // a forecast doesn't move fast — floor the poll at 10 min regardless of config
  const t = setInterval(fire, Math.max(600, pane.refreshSecs || 900) * 1000);
  return () => { clearInterval(t); INSTANCES.delete(pane.id); };
}

function action(pane, actionId, ctx) {
  if (actionId.startsWith('cfg:loc:')) {
    const text = actionId.slice('cfg:loc:'.length).trim();
    const apply = INSTANCES.get(pane.id);
    if (!text || !apply) return;
    ctx.busy(true);
    Promise.resolve(apply(text))
      .catch((e) => ctx.log('weather: location change failed — ' + e.message))
      .finally(() => ctx.busy(false));
    return;
  }
  ctx.log('weather source has no other actions — it only reads the public forecast');
}

module.exports = { start, action };
