#!/usr/bin/env node
/**
 * WeatherOrbit - city page builder
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

const SITE_URL = 'https://novapixeltech.github.io/WeatherOrbit';
const OG_IMAGE = `${SITE_URL}/og-image-v2.png`;
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

function placeLabel(city) {
  const country = String(city.country || city.countryCode || '').trim();
  if (!country || country.toLowerCase() === String(city.name).toLowerCase()) return city.name;
  return `${city.name}, ${country}`;
}

function titlePlace(city) {
  const full = `${city.name}, ${city.country || city.countryCode || ''}`.replace(/,\s*$/, '').trim();
  if (full.length <= 13) return full;
  return city.name;
}

function cityTitle(city) {
  const place = titlePlace(city);
  const prefix = place.length > 12 ? `${place} Weather: ` : `Weather in ${place}: `;
  return `${prefix}Climate & Best Time | WeatherOrbit`;
}

function cityDescription(city) {
  const high = num(city.climate ? city.climate.avgHighC : 0);
  const low = num(city.climate ? city.climate.avgLowC : 0);
  const precip = num(city.climate ? city.climate.annualPrecipMm : 0);
  return `Weather in ${placeLabel(city)}: ${high}\u00b0C average high, ${low}\u00b0C average low and ${precip} mm of rain per year. Explore 10-year monthly climate averages, the best time to visit and the live forecast.`;
}

function buildStats(city) {
  const climate = city.climate || {};
  const coldest = climate.monthly && climate.monthly[Number(climate.coldestMonth) - 1];
  const hottest = climate.monthly && climate.monthly[Number(climate.hottestMonth) - 1];
  return {
    climate,
    coldestLow: coldest ? coldest.avgLowC : climate.avgLowC,
    coldestHigh: coldest ? coldest.avgHighC : climate.avgHighC,
    hottestHigh: hottest ? hottest.avgHighC : climate.avgHighC,
  };
}

function breadcrumbItems(city) {
  return [
    { name: 'Home', url: `${SITE_URL}/` },
    { name: 'City guides', url: `${SITE_URL}/cities/index.html` },
    { name: placeLabel(city), url: `${SITE_URL}/cities/${city.slug}.html` },
  ];
}

function buildFaq(city) {
  const { climate, coldestLow, coldestHigh, hottestHigh } = buildStats(city);
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
      answer: `The driest month is ${dryName} and the wettest is ${wetName}. The hottest average high is ${hotName} at ${num(hottestHigh)}\u00b0C, and the coolest is ${coldName} at ${num(coldestHigh)}\u00b0C, so the milder months are usually the most comfortable for outdoor plans.`,
    },
    {
      question: `Does it snow in ${city.name}?`,
      answer: snowPossible
        ? `Snow is possible in ${city.name}: the coldest average nights drop to around ${num(coldestLow)}\u00b0C, which is at or below freezing. Frost and occasional snow can occur in the coldest months.`
        : `Snow is rare in ${city.name}: even the coldest average nights stay around ${num(coldestLow)}\u00b0C, above freezing.`,
    },
  ];
}

function buildCityJsonLd(city, faq) {
  const canonical = `${SITE_URL}/cities/${city.slug}.html`;
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: cityTitle(city),
      description: cityDescription(city),
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'WeatherOrbit', url: SITE_URL },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
      mainEntity: { '@id': `${canonical}#faq` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: breadcrumbItems(city).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
  const latitude = Number(city.latitude);
  const longitude = Number(city.longitude);
  const geo = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { '@type': 'GeoCoordinates', latitude, longitude }
    : undefined;
  graph.push({
    '@type': 'City',
    '@id': `${canonical}#city`,
    name: city.name,
    url: canonical,
    address: {
      '@type': 'PostalAddress',
      addressCountry: city.countryCode || city.country || undefined,
      addressRegion: city.admin1 || undefined,
    },
    ...(geo ? { geo } : {}),
  });
  return { '@context': 'https://schema.org', '@graph': graph };
}

function buildSeasonHtml(city) {
  const monthly = (city.climate && city.climate.monthly) || [];
  if (!monthly.length) return '';
  const warmest = monthly.reduce((a, b) => (Number(b.avgHighC) > Number(a.avgHighC) ? b : a));
  const coolest = monthly.reduce((a, b) => (Number(b.avgHighC) < Number(a.avgHighC) ? b : a));
  const wettest = monthly.reduce((a, b) => (Number(b.precipMm) > Number(a.precipMm) ? b : a));
  const driest = monthly.reduce((a, b) => (Number(b.precipMm) < Number(a.precipMm) ? b : a));
  const comfortable = monthly.filter((m) => Number(m.avgHighC) >= 18 && Number(m.avgHighC) <= 28 && Number(m.precipMm) <= 150);
  const comfortText = comfortable.length
    ? `${comfortable.map((m) => monthName(m.month)).join(', ')} offer the closest match to the typical 18\u201328\u00b0C comfort range with moderate rain.`
    : 'No month perfectly matches the typical 18\u201328\u00b0C comfort range with moderate rain, so the driest month is the safest default for outdoor plans.';
  return `<section class="city-section">
      <h2>Seasons in ${esc(city.name)}</h2>
      <p>${esc(city.name)} is warmest in ${monthName(warmest.month)}, when average highs reach ${num(warmest.avgHighC)}\u00b0C, and coolest in ${monthName(coolest.month)} at ${num(coolest.avgHighC)}\u00b0C. Rainfall peaks in ${monthName(wettest.month)} (${num(wettest.precipMm)} mm) and is lowest in ${monthName(driest.month)} (${num(driest.precipMm)} mm).</p>
      <p>${comfortText} These figures are ten-year monthly averages from Open-Meteo, so individual years can differ.</p>
    </section>`;
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
  return rows.join('\n');
}

function buildCityHtml(city, faq, related, relatedHeading) {
  const high = num(city.climate.avgHighC);
  const low = num(city.climate.avgLowC);
  const precip = num(city.climate.annualPrecipMm);
  const title = cityTitle(city);
  const description = cityDescription(city);
  const canonical = `${SITE_URL}/cities/${city.slug}.html`;
  const jsonLd = buildCityJsonLd(city, faq);
  const countryLabel = city.country || city.countryCode || 'this region';
  const dash = String.fromCharCode(0x2014);
  const relatedItems = related.map((r) => `        <li><a href="${esc(r.slug)}.html">${esc(r.name)}</a> ${dash} climate averages</li>`).join('\n');
  const relatedHtml = related.length
    ? `<section class="city-section city-related">
      <h2>${esc(relatedHeading || 'Related city guides')}</h2>
      <h3>Similar climate profile</h3>
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
      <div class="city-stat"><div class="value">${high}\u00b0C</div><div class="label">Avg high</div></div>
        <div class="city-stat"><div class="value">${low}\u00b0C</div><div class="label">Avg low</div></div>
        <div class="city-stat"><div class="value">${num(city.climate.annualMeanC)}\u00b0C</div><div class="label">Annual mean</div></div>
        <div class="city-stat"><div class="value">${precip} mm</div><div class="label">Annual precipitation</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.wettestMonth)}</div><div class="label">Wettest month</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.driestMonth)}</div><div class="label">Driest month</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.hottestMonth)}</div><div class="label">Hottest month</div></div>
        <div class="city-stat"><div class="value">${monthName(city.climate.coldestMonth)}</div><div class="label">Coldest month</div></div>`;
  const monthly = city.climate.monthly || [];
  const comfyMonths = monthly.filter((m) => m.avgHighC >= 18 && m.avgHighC <= 28);
  const candidatePool = comfyMonths.length ? comfyMonths : monthly;
  const bestVisitMonth = candidatePool.reduce((a, b) => (b.precipMm < a.precipMm ? b : a), candidatePool[0] || monthly[0]);
  const bestTimeHtml = `<section class="city-section">
      <h2>Best time to visit ${esc(city.name)}</h2>
      <p>Based on long-term averages, <strong>${monthName(bestVisitMonth.month)}</strong> is usually the most comfortable month, with an average high of ${num(bestVisitMonth.avgHighC)}\u00b0C and about ${num(bestVisitMonth.precipMm)} mm of precipitation. The hottest month is ${monthName(city.climate.hottestMonth)} and the coolest is ${monthName(city.climate.coldestMonth)}; the driest month is ${monthName(city.climate.driestMonth)} and the wettest is ${monthName(city.climate.wettestMonth)}.</p>
    </section>`;
  const mean = num(city.climate.annualMeanC);
  const tempProfile = mean >= 24 ? 'consistently warm' : mean >= 18 ? 'generally mild to warm' : mean >= 12 ? 'moderate' : 'noticeably cool';
  const rainProfile = precip >= 1800 ? 'a very wet' : precip >= 1000 ? 'a fairly wet' : precip >= 500 ? 'a moderately rainy' : 'a dry';
  const comparisonHtml = `<section class="city-section">
      <h2>How ${esc(city.name)} compares</h2>
      <p>With an annual mean of ${mean}\u00b0C and about ${precip} mm of rain, ${esc(city.name)} has ${tempProfile} climate and ${rainProfile} yearly rainfall profile. Travellers who prefer warm, dry weather should focus on ${monthName(bestVisitMonth.month)}, while those who do not mind rain can visit in ${monthName(city.climate.wettestMonth)}.</p>
    </section>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="WeatherOrbit" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(OG_IMAGE)}" />
  <meta property="og:image:alt" content="WeatherOrbit climate guide" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(OG_IMAGE)}" />
  <meta name="theme-color" content="#0b1324" />
  <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="../apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="city-page.css" />
  <script>
    window.WEATHERORBIT_STATIC_PAGE = { url: "/WeatherOrbit/cities/${esc(city.slug)}", title: ${JSON.stringify(title)} };
  </script>
  <script src="../analytics-config.js"></script>
  <script src="../analytics.js" defer></script>
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd)}
  </script>
</head>
<body>
  <main class="city-shell">
    <div class="city-topbar">
      <a class="city-brand" href="../index.html">Weather<span>Orbit</span></a>
      <a class="city-home" href="index.html">All cities</a>
    </div>
    <nav class="city-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="../index.html">Home</a></li>
        <li><a href="index.html">City guides</a></li>
        <li aria-current="page">${esc(placeLabel(city))}</li>
      </ol>
    </nav>

    <section class="city-hero">
      <h1>Weather in ${esc(placeLabel(city))}</h1>
      <div class="country-line">Climate averages and long-term statistics</div>
      <p class="lede">${esc(
        `Over the last ten years ${city.name} averaged a high of ${high}\u00b0C and a low of ${low}\u00b0C, with about ${precip} mm of precipitation per year. Get the live forecast for ${city.name} inside WeatherOrbit, or browse the averages below.`
      )}</p>
      <a class="city-cta" href="../index.html?city=${encodeURIComponent(city.name)}&region=${encodeURIComponent(city.admin1 || city.country)}&country=${encodeURIComponent(city.countryCode)}&lat=${city.latitude}&lon=${city.longitude}&tz=${encodeURIComponent(city.timezone)}">Get the live forecast for ${esc(city.name)}</a>
    </section>

    <section class="city-section">
      <h2>Climate at a glance</h2>
${statsHtml}
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

${buildSeasonHtml(city)}

${bestTimeHtml}

${comparisonHtml}

${faqHtml}

${relatedHtml}
    <footer class="city-footer">
      <p>Data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo API</a>.</p>
      <p><a href="index.html">All city guides</a> \u00b7 <a href="../blog/how-to-read-a-climate-chart.html">How to read a climate chart</a> \u00b7 <a href="../index.html">Open WeatherOrbit</a> \u00b7 <a id="feedback-form-link" data-i18n="feedback.form" href="" target="_blank" rel="noopener noreferrer" hidden>Send feedback</a></p>
    </footer>
  </main>

  <script src="../support-config.js"></script>
  <script src="../support.js"></script>
  <script defer src="https://cloud.umami.is/script.js" data-website-id="e7e8c629-41e0-4a24-b143-cca79313c5cf"></script>
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
    const sorted = list.slice().sort((a, b) => (b.population || 0) - (a.population || 0));
    const cards = sorted.map((city) => `      <a class="city-card" href="${esc(city.slug)}.html" data-city="${esc(city.name).toLowerCase()}" data-country="${esc(country).toLowerCase()}">
        <span class="city-card-name">${esc(city.name)}</span>
        <span class="city-card-meta">${esc(city.countryCode)} \u00b7 ${esc(country)}</span>
        <span class="city-card-arrow" aria-hidden="true">\u2192</span>
      </a>`).join('\n');
    return `    <section class="city-country">
      <h2 class="city-country-title">${esc(country)}<span class="city-country-count">${sorted.length}</span></h2>
      <div class="city-grid">
${cards}
      </div>
    </section>`;
  }).join('\n');
  const title = `${cities.length} City Weather Guides - Climate Averages | WeatherOrbit`;
  const description = `Browse ${cities.length} WeatherOrbit city weather guides with ten-year monthly climate averages, the best time to visit and a direct link to each city's live forecast.`;
  const canonical = `${SITE_URL}/cities/index.html`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'WeatherOrbit', url: SITE_URL },
        mainEntity: { '@id': `${canonical}#cities` },
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#cities`,
        name: 'WeatherOrbit city guides',
        numberOfItems: cities.length,
        itemListElement: cities.map((city, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: placeLabel(city),
          url: `${SITE_URL}/cities/${city.slug}.html`,
        })),
      },
    ],
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
  <meta property="og:site_name" content="WeatherOrbit" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(OG_IMAGE)}" />
  <meta property="og:image:alt" content="WeatherOrbit city climate guides" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(OG_IMAGE)}" />
  <meta name="theme-color" content="#0b1324" />
  <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="../apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="city-page.css" />
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd)}
  </script>
</head>
<body>
  <main class="city-shell">
    <div class="city-topbar">
      <a class="city-brand" href="../index.html">Weather<span>Orbit</span></a>
      <a class="city-home" href="../index.html">Open the app</a>
    </div>
    <section class="city-hero">
      <h1>Weather guides by city</h1>
      <div class="country-line">Real climate averages for the world's major cities</div>
      <p class="lede">Every guide combines long-term climate averages with a direct link into the live WeatherOrbit forecast for that city.</p>
      <div class="city-search">
        <input type="search" id="city-search" placeholder="Search a city or country\u2026" autocomplete="off" />
        <span class="city-search-count" id="city-search-count"></span>
      </div>
    </section>
${sections}
    <footer class="city-footer">
      <p><a href="../index.html">Open WeatherOrbit</a> \u00b7 <a href="../blog/index.html">WeatherOrbit Blog</a> \u00b7 <a id="feedback-form-link" data-i18n="feedback.form" href="" target="_blank" rel="noopener noreferrer" hidden>Send feedback</a></p>
    </footer>
  </main>
  <script>
    (function () {
      var input = document.getElementById('city-search');
      var count = document.getElementById('city-search-count');
      var cards = document.querySelectorAll('.city-card');
      var countries = document.querySelectorAll('.city-country');
      function update() {
        var q = (input.value || '').trim().toLowerCase();
        var visible = 0;
        cards.forEach(function (card) {
          var hay = (card.getAttribute('data-city') + ' ' + card.getAttribute('data-country')).toLowerCase();
          var show = !q || hay.indexOf(q) !== -1;
          card.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        countries.forEach(function (sec) {
          var any = false;
          sec.querySelectorAll('.city-card').forEach(function (c) { if (c.style.display !== 'none') any = true; });
          sec.style.display = any ? '' : 'none';
        });
        if (count) count.textContent = q ? (visible + ' of ' + cards.length + ' cities') : (cards.length + ' cities');
      }
      if (input) { input.addEventListener('input', update); update(); }
    })();
  </script>
  <script defer src="https://cloud.umami.is/script.js" data-website-id="e7e8c629-41e0-4a24-b143-cca79313c5cf"></script>
</body>
</html>`;
}

function buildSitemap(cities) {
  const today = new Date().toISOString().slice(0, 10);
  const dataModified = fs.existsSync(DATA_FILE)
    ? fs.statSync(DATA_FILE).mtime.toISOString().slice(0, 10)
    : today;
  const locations = [
    { loc: `${SITE_URL}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' },
    { loc: `${SITE_URL}/privacy.html`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
    { loc: `${SITE_URL}/cities/index.html`, lastmod: dataModified, changefreq: 'monthly', priority: '0.9' },
    { loc: `${SITE_URL}/blog/index.html`, lastmod: today, changefreq: 'monthly', priority: '0.7' },
    { loc: `${SITE_URL}/blog/how-to-read-a-climate-chart.html`, lastmod: today, changefreq: 'yearly', priority: '0.6' },
    ...cities.map((city) => ({
      loc: `${SITE_URL}/cities/${city.slug}.html`,
      lastmod: dataModified,
      changefreq: 'monthly',
      priority: '0.8',
    })),
  ];
  const body = locations.map((entry) => [
    '  <url>',
    `    <loc>${esc(entry.loc)}</loc>`,
    `    <lastmod>${entry.lastmod}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
  const cities = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const withClimate = cities.filter((city) => city && city.climate && city.slug);
  fs.mkdirSync(CITIES_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'city-page.css'), path.join(CITIES_DIR, 'city-page.css'));
  fs.writeFileSync(path.join(CITIES_DIR, 'index.html'), buildCityIndexHtml(withClimate));
  console.log(`wrote cities/index.html with ${withClimate.length} guides`);

  function climateDistance(a, b) {
    const tempGap = Math.abs(Number(a.climate.annualMeanC) - Number(b.climate.annualMeanC));
    const rainGap = Math.abs(Number(a.climate.annualPrecipMm) - Number(b.climate.annualPrecipMm)) / 100;
    return tempGap + rainGap;
  }

  withClimate.forEach((city) => {
    const faq = buildFaq(city);
    const sameCountry = withClimate.filter((other) => other.country === city.country && other.slug !== city.slug);
    const pool = sameCountry.length
      ? sameCountry
      : withClimate.filter((other) => other.slug !== city.slug);
    const related = pool.slice().sort((a, b) => climateDistance(city, a) - climateDistance(city, b)).slice(0, 5);
    const relatedHeading = sameCountry.length
      ? `More guides in ${city.country || city.countryCode}`
      : 'Cities with a similar climate';
    fs.writeFileSync(path.join(CITIES_DIR, `${city.slug}.html`), buildCityHtml(city, faq, related, relatedHeading));
  });
  console.log(`wrote ${withClimate.length} city pages`);

  fs.writeFileSync(SITEMAP_FILE, buildSitemap(withClimate));
  console.log(`wrote sitemap.xml with ${withClimate.length + 5} entries`);

  // Best-effort IndexNow ping (Bing/Yandex instant indexing). Never fails the build.
  if (process.env.INDEXNOW !== '0') {
    try {
      const key = '9168f9f1b623e8f128bcd82260ffc41c';
      const host = 'novapixeltech.github.io';
      const urlList = [
        `${SITE_URL}/`,
        `${SITE_URL}/privacy.html`,
        `${SITE_URL}/cities/index.html`,
        `${SITE_URL}/blog/index.html`,
        `${SITE_URL}/blog/how-to-read-a-climate-chart.html`,
        ...withClimate.map((c) => `${SITE_URL}/cities/${c.slug}.html`),
      ];
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, key, keyLocation: `https://${host}/WeatherOrbit/${key}.txt`, urlList }),
      });
      console.log(`indexnow ping: HTTP ${res.status} for ${urlList.length} urls`);
    } catch (err) {
      console.log(`indexnow ping skipped: ${err.message}`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
