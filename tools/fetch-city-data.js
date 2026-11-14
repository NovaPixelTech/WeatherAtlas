#!/usr/bin/env node
/**
 * WeatherScope - city data fetcher
 * ==========================================================================
 * Turns `tools/city-seeds.json` into a static dataset in `data/city-climate.json`.
 *
 * For every seed city:
 *   1. resolves its coordinates with the Open-Meteo geocoding API
 *      (country-coded, so "Sao Paulo" in Brazil is not confused with the US city);
 *   2. reads the last ten years of daily archive data from Open-Meteo;
 *   3. derives long-term monthly climate statistics.
 *
 * The derived numbers are what the generated city pages render: real, evergreen
 * averages instead of thin placeholder copies of the landing page text.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SEEDS = path.join(__dirname, 'city-seeds.json');
const OUT = path.join(__dirname, '..', 'data', 'city-climate.json');
const PROGRESS = 'C:\\Users\\giong\\AppData\\Local\\Temp\\opencode\\cityfetch-progress.log';
const ARCHIVE_START = '2015-01-01';
const ARCHIVE_END = '2024-12-31';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

function log(line) {
  fs.appendFileSync(PROGRESS, `${new Date().toISOString()} ${line}\n`);
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) return response.json();
    lastError = new Error(`${url} -> HTTP ${response.status}`);
    const waitMs = [15000, 30000, 60000][attempt] || 15000;
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    break;
  }
  throw lastError;
}

async function geocode(name, countryCode) {
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=5&countrycode=${encodeURIComponent(
    countryCode
  )}&language=en&format=json`;
  const json = await fetchJson(url);
  const results = Array.isArray(json.results) ? json.results : [];
  const matching = results.filter((r) => (r.country_code || '').toUpperCase() === countryCode.toUpperCase());
  const best = (matching.length ? matching : results)
    .filter((r) => r.latitude != null && r.longitude != null)
    .sort((a, b) => (b.population || 0) - (a.population || 0))[0];
  if (!best) throw new Error(`no geocoding result for ${name} (${countryCode})`);
  return {
    name: best.name || name,
    country: best.country || '',
    admin1: best.admin1 || '',
    countryCode: best.country_code || countryCode,
    latitude: best.latitude,
    longitude: best.longitude,
    timezone: best.timezone || '',
    population: best.population || 0,
  };
}

async function readArchive(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: ARCHIVE_START,
    end_date: ARCHIVE_END,
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
  });
  const json = await fetchJson(`${ARCHIVE_URL}?${params.toString()}`);
  const daily = json.daily || {};
  const times = Array.isArray(daily.time) ? daily.time : [];
  const maxes = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const mins = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const rains = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [];
  if (times.length !== maxes.length || times.length !== mins.length || times.length !== rains.length) {
    throw new Error('archive arrays are misaligned');
  }
  return { times, maxes, mins, rains };
}

function monthKey(time) {
  const date = new Date(`${time}T00:00:00Z`);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function round1(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isFinite(rounded) ? rounded : 0;
}

function computeClimate(times, maxes, mins, rains) {
  const monthly = [];
  for (let month = 1; month <= 12; month += 1) {
    const days = [];
    for (let i = 0; i < times.length; i += 1) {
      if (monthKey(times[i]).endsWith(`-${pad2(month)}`)) days.push(i);
    }
    if (days.length === 0) throw new Error('archive has no days for a month');
    const highs = days.map((i) => maxes[i]).filter((v) => Number.isFinite(v));
    const lows = days.map((i) => mins[i]).filter((v) => Number.isFinite(v));
    const rainSum = days.reduce((sum, i) => sum + (Number.isFinite(rains[i]) ? rains[i] : 0), 0);
    const high = highs.reduce((a, b) => a + b, 0) / highs.length;
    const low = lows.reduce((a, b) => a + b, 0) / lows.length;
    monthly.push({
      month,
      avgHighC: round1(high),
      avgLowC: round1(low),
      avgTempC: round1((high + low) / 2),
      precipMm: round1(rainSum),
      days: days.length,
    });
  }
  const annualMeanHighC = round1(maxes.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / maxes.length);
  const annualMeanLowC = round1(mins.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / mins.length);
  const annualMeanC = round1(
    (annualMeanHighC + annualMeanLowC) / 2
  );
  const annualPrecipMm = round1(rains.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));
  let hottestMonth = 1;
  let coldestMonth = 1;
  monthly.forEach((entry) => {
    if (entry.avgHighC > monthly[hottestMonth - 1].avgHighC) hottestMonth = entry.month;
    if (entry.avgHighC < monthly[coldestMonth - 1].avgHighC) coldestMonth = entry.month;
  });
  let wettestMonth = 1;
  let driestMonth = 1;
  monthly.forEach((entry) => {
    if (entry.precipMm > monthly[wettestMonth - 1].precipMm) wettestMonth = entry.month;
    if (entry.precipMm < monthly[driestMonth - 1].precipMm) driestMonth = entry.month;
  });
  return {
    avgHighC: annualMeanHighC,
    avgLowC: annualMeanLowC,
    annualMeanC,
    annualPrecipMm,
    hottestMonth,
    coldestMonth,
    wettestMonth,
    driestMonth,
    monthly,
  };
}

function slugify(value) {
  const ascii = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  const seeds = JSON.parse(fs.readFileSync(SEEDS, 'utf8'));
  // Resume support: keep cities already fetched in a previous run.
  let cities = [];
  if (fs.existsSync(OUT)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      if (Array.isArray(parsed)) cities = parsed;
    } catch (e) {
      cities = [];
    }
  }
  const existingSlugs = new Set(cities.map((c) => c.slug));
  const existingNames = new Set(cities.map((c) => String(c.name || '').toLowerCase()));
  for (const seed of seeds) {
    if (existingSlugs.has(slugify(seed.name)) || existingNames.has(seed.name.toLowerCase())) {
      log(`skip-existing ${seed.name}`);
      continue;
    }
    log(`start ${seed.name}`);
    try {
      const geo = await geocode(seed.name, seed.countryCode);
      log(`ok ${geo.name} ${geo.latitude.toFixed(3)},${geo.longitude.toFixed(3)}`);
      const archive = await readArchive(geo.latitude, geo.longitude);
      const climate = computeClimate(archive.times, archive.maxes, archive.mins, archive.rains);
      const slug = slugify(geo.name || seed.name);
      cities.push({ ...geo, slug, climate });
      existingSlugs.add(slug);
      existingNames.add(String(geo.name || seed.name).toLowerCase());
      // Persist after every success so a crash never loses progress.
      fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
      fs.writeFileSync(OUT, `${JSON.stringify(cities, null, 2)}\n`);
      log(`done ${seed.name} (total ${cities.length})`);
    } catch (error) {
      log(`skip ${seed.name}: ${error.message}`);
    }
    // Be polite to Open-Meteo to avoid rate limits.
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  console.log(`wrote ${cities.length} cities to data/city-climate.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
