#!/usr/bin/env node
/**
 * WeatherScope - city page builder
 * ==========================================================================
 * Turns `data/city-climate.json` (produced by `tools/fetch-city-data.js`) into
 * static, indexable pages under `cities/`, plus the city index and the sitemap.
 *
 *   node tools/build-city-pages.js
 *
 * The generated pages are plain HTML with unique titles, descriptions, headings,
 * climate tables and FAQ JSON-LD. They deep-link into the live app with the
 * shared `?city=...` forecast format so visitors land on real, current data.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://novapixeltech.github.io/WeatherScope';
const CITIES_DIR = path.join(__dirname, '..', 'cities');
const DATA_FILE = path.join(__dirname, '..', 'data', 'city-climate.json');
const SITEMAP_FILE = path.join(__dirname, '..', 'sitemap.xml');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isFinite(rounded) ? rounded : 0;
}

function monthName(month) {
  const index = (Number(month) - 1) % 12;
  return MONTH_NAMES[((index % 12) + 12) % 12];
}

function slugify(value) {
  const ascii = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function cityTitle(city) {
  return `Weather in ${city.name}, ${city.country} - Climate & Averages | WeatherScope`;
}

function cityDescription(city) {
  const high = num(city.climate ? city.climate.avgHighC : 0);
  const low = num(city.climate ? city.climate.avgLowC : 0);
  const precip = num(city.climate ? city.climate.annualPrecipMm : 0);
  const description = `Weather in ${city.name}: average high ${high}\u00b0C, low ${low}\u00b0C, ${precip} mm of precipitation per year. Read the climate averages and get the live forecast.`;
  return description;
}

function buildStats(city) {
  const climate = city.climate || {};
  const coldestLow = climate.monthly && climate.monthly[Number(climate.coldestMonth) - 1]
    ? climate.monthly[Number(climate.coldestMonth) - 1].avgLowC
    : climate.avgLowC;
  return { climate, coldestLow };
}

function buildFaq(city) {
  const { climate, coldestLow } = buildStats(city);
  const high = num(climate.avgHighC);
  const low = num(climate.avgLowC);
  const precip = num(climate.annualPrecipMm);
  const hotName = monthName(climate.hottestMonth);
  const coldName = monthName(climate.coldestMonth);
  const wetName = monthName(climate.wettestMonth);
  const dryName = monthName(climate.driestMonth);
  const snowPossible = coldestLow <= 0;
  return [
    {
      question: `What is the climate like in ${city.name}?`,
      answer: `Over the last ten years ${city.name} averaged a daytime high of ${high}\u00b0C and a nighttime low of ${low}\u00b0C, with about ${precip} mm of precipitation per year. The warmest month on average was ${hotName} and the coldest was ${coldName}.`,
    },
    {
      question: `When is the best time of year to visit ${city.name}?`,
      answer: `The driest month is ${dryName} and the wettest is ${wetName}. The hottest average high is ${hotName} at ${high}\u00b0C, and the coldest is ${coldName} at ${low}\u00b0C, which makes the milder months the most comfortable for outdoor plans.`,
    },
    {
      question: `Does it snow in ${city.name}?`,
      answer: snowPossible
        ? `Snowfall is part of ${city.name}'s climate: the coldest average nights drop to around ${low}\u00b0C, which is at or below freezing. In the coldest months of the year the city regularly sees snow.`
        : `Snow is rare in ${city.name}: the coldest average nights only drop to about ${low}\u00b0C, which is above freezing.`,
    },
  ];
}

function climateRows(city) {
  const rows = (city.climate.monthly || []).map((entry) => {
    const average = num((Number(entry.avgHighC) + Number(entry.avgLowC)) / 2);
    return [
      `          <tr>`,
      `            <td>${esc(monthName(entry.month))}</td>`,
      `            <td class="num">${num(entry.avgHighC)}\u00b0C</td>`,
      `            <td class="num">${num(entry.avgLowC)}\u00b0C</td>`,
      `            <td class="num">${average}\u00b0C</td>`,
      `            <td class="num">${num(entry.precipMm)} mm</td>`,
      `          </tr>`,
    ].join('\n');
  });
  if (!rows.length) {
    rows.push('          <tr><td colspan="5">Climate data is being refreshed for this city.</td></tr>');
  }
  return rows.join(',\n');
}

function buildCityHtml(city, faq, related) {
  const high = num(city.climate.avgHighC);
  const low = num(city.climate.avgLowC);
  const precip = num(city.climate.annualPrecipMm);
  const title = cityTitle(city);
  const description = cityDescription(city);
  const canonical = `${SITE_URL}/cities/${city.slug}.html`;
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
  const dash = String.fromCharCode(0x2014);
  const relatedItems = related.map((r) => `        <li><a href="${esc(r.slug)}.html">${esc(r.name)}</a> ${dash} climate averages</li>`).join('\n');
  const relatedHtml = related.length
    ? `<section class="city-section city-related">
      <h2>Related cities</h2>
      <h3>Cities in ${esc(city.country)}</h3>
      <ul>
${relatedItems}
      </ul>
    </section>`
    : '';
  const faqItems = faq.map((item) => {
    const question = esc(item.question);
    const answer = esc(item.answer);
    return `        <details>
          <summary>${question}</summary>
          <p>${answer}</p>
        </details>`;
  }).join('\n');
  const faqHtml = `<section class="city-section faq">
      <h2>Frequently asked questions</h2>
      <div class="faq">
${faqItems}
      </div>
    </section>`;
  const statsHtml = `
      <div class="city-stats">
        <div class="city-stat"><div class="value">${high}\u00b0C</div><div class="label">Avg high</div></div>
        <div class="city-stat"><div class="value">${low}\u00b0C</div><div class="label">Avg low</div></div>
        <div class="city-stat"><div class="value">${num(city.climate.annualMeanC)}\u00b0C</div><div class="label">Annual mean</div></div>
        <div class="city-stat"><div class="value">${precip} mm</div><div class="label">Annual precipitation</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.wettestMonth)}</div><div class="label">Wettest month</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.driestMonth)}</div><div class="label">Driest month</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.hottestMonth)}</div><div class="label">Hottest month</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.coldestMonth)}</div><div class="label">Coldest month</div></div>
      </div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="WeatherScope" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(`${SITE_URL}/WeatherScope/og-image.png`)}" />
  <meta name="theme-color" content="#0b1324" />
  <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="../apple-touch-icon.png" />
  <link rel="stylesheet" href="city-page.css" />
  <script>
    window.WEATHERSCOPE_STATIC_PAGE = { url: "/WeatherScope/cities/${esc(city.slug)}", title: ${JSON.stringify(title)} };
  </script>
  <script src="../analytics-config.js"></script>
  <script src="../analytics.js" defer></script>
  <script src="../support-config.js"></script>
  <script src="../support.js"></script>
  <script type="application/ld+json">
  ${JSON.stringify(faqJsonLd)}
  </script>
</head>
<body>
  <main class="city-shell">
    <div class="city-topbar">
      <a class="city-brand" href="../index.html">Weather<span>Scope</span></a>
      <a class="city-home" href="index.html">All cities</a>
    </div>

    <section class="city-hero">
      <h1>Weather in ${esc(city.name)}, ${esc(city.country)}</h1>
      <div class="country-line">Climate averages and long-term statistics</div>
      <p class="lede">${esc(
        `Over the last ten years ${city.name} averaged a high of ${high}\u00b0C and a low of ${low}\u00b0C, with about ${precip} mm of precipitation per year. Get the live forecast for ${city.name} inside WeatherScope, or browse the averages below.`
      )}</p>
      <a class="city-cta" href="../index.html?city=${encodeURIComponent(city.name)}&region=${encodeURIComponent(city.admin1 || city.country)}&country=${encodeURIComponent(city.countryCode)}&lat=${city.latitude}&lon=${city.longitude}&tz=${encodeURIComponent(city.timezone)}">Get the live forecast for ${esc(city.name)}</a>
    </section>

    <section class="city-section">
      <h2>Climate at a glance</h2>
      <div class="city-stats">
${statsHtml}
      </div>
    </section>

    <section class="city-section">
      <h2>Monthly climate averages</h2>
      <table class="city-climate">
        <thead>
          <tr><th>Month</th><th class="num">Avg high</th><th class="num">Avg low</th><th class="num">Avg</th><th class="num">Precipitation</th></tr>
        </thead>
        <tbody>
${climateRows(city)}
        </tbody>
      </table>
    </section>

${faqHtml}

${relatedHtml}
    <footer class="city-footer">
      <p>Data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo API</a>.</p>
      <p><a href="../index.html">Open WeatherScope</a> \u00b7 <a href="https://github.com/NovaPixelTech/WeatherScope/issues">Report an issue</a></p>
    </footer>
  </main>

  <script src="../support-config.js"></script>
  <script src="../support.js"></script>
</body>
</html>`;
}

function buildCityIndexHtml(cities) {
  const grouped = new Map();
  cities.forEach((city) => {
    const key = city.country || 'Unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(city);
  });
  const countries = [...grouped.entries()].sort((a, b) => {
    const pop = (list) => list.reduce((sum, c) => sum + (c.population || 0), 0);
    return pop(b[1]) - pop(a[1]);
  });
  const sections = countries.map(([country, list]) => {
    const entries = list
      .slice()
      .sort((a, b) => (b.population || 0) - (a.population || 0))
      .map((city) => `        <li><a href="${esc(city.slug)}.html">${esc(city.name)}</a>, ${esc(city.countryCode)}</li>`)
      .join('\n');
    return `    <h2>${esc(country)}</h2>
    <ul>
${entries}
    </ul>`;
  }).join('\n');
  const title = 'City Weather Guides - Climate Averages & Live Forecasts | WeatherScope';
  const description = 'Browse WeatherScope city weather guides with real climate averages, monthly statistics and a direct link to the live forecast for the city.';
  const canonical = `${SITE_URL}/cities/index.html`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'WeatherScope City Weather Guides',
    url: canonical,
    description,
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="WeatherScope" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(`${SITE_URL}/WeatherScope/og-image.png`)}" />
  <meta name="theme-color" content="#0b1324" />
  <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="../apple-touch-icon.png" />
  <link rel="stylesheet" href="../styles.css" />
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd)}
  </script>
</head>
<body>
  <main class="city-shell">
    <div class="city-topbar">
      <a class="city-brand" href="../index.html">Weather<span>Scope</span></a>
      <a class="city-home" href="../index.html">Open the app</a>
    </div>
    <section class="city-hero">
      <h1>Weather guides by city</h1>
      <div class="country-line">Real climate averages for the world's major cities</div>
      <p class="lede">Every guide combines long-term climate averages with a direct link into the live WeatherScope forecast for that city.</p>
    </section>
    <section class="city-section">
      <h2>Cities</h2>
      <p>Browse the guides by country:</p>
${sections}
    </section>
    <footer class="city-footer">
      <p><a href="../index.html">Open WeatherScope</a> \u00b7 <a href="https://github.com/NovaPixelTech/WeatherScope/issues">Report an issue</a></p>
    </footer>
  </main>
</body>
</html>`;
}

function buildSitemap(cities) {
  const locations = [
    `${SITE_URL}/`,
    `${SITE_URL}/privacy.html`,
    `${SITE_URL}/cities/index.html`,
    ...cities.map((city) => `${SITE_URL}/cities/${city.slug}.html`),
  ];
  const body = locations.map((loc) => `  <url>\n    <loc>${esc(loc)}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function main() {
  const cities = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const withClimate = cities.filter((city) => city && city.climate && city.slug);
  fs.mkdirSync(CITIES_DIR, { recursive: true });
  fs.writeFileSync(path.join(CITIES_DIR, 'index.html'), buildCityIndexHtml(withClimate));
  console.log(`wrote cities/index.html with ${withClimate.length} guides`);

  withClimate.forEach((city) => {
    const faq = buildFaq(city);
    const sameCountry = withClimate.filter((other) => other.country === city.country && other.slug !== city.slug);
    const related = sameCountry.slice(0, 5);
    fs.writeFileSync(path.join(CITIES_DIR, `${city.slug}.html`), buildCityHtml(city, faq, related));
  });
  console.log(`wrote ${withClimate.length} city pages`);

  fs.writeFileSync(SITEMAP_FILE, buildSitemap(withClimate));
  console.log(`wrote sitemap.xml with ${withClimate.length + 2} entries`);
}

main();
