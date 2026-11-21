'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE_URL = 'https://novapixeltech.github.io/WeatherOrbit';
const OG_IMAGE = `${SITE_URL}/og-image-v2.png`;

function read(...segments) {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

function htmlFiles(dir = ROOT, found = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, found);
    else if (entry.name.endsWith('.html')) found.push(full);
  });
  return found;
}

const allHtml = htmlFiles();
const cityFiles = allHtml.filter((file) => path.basename(path.dirname(file)) === 'cities');
const cityDetailFiles = cityFiles.filter((file) => path.basename(file) !== 'index.html');
const generator = read('tools', 'build-city-pages.js');
const fetcher = read('tools', 'fetch-city-data.js');
const cityClimate = JSON.parse(read('data', 'city-climate.json'));

test('every page has a canonical URL and complete social preview metadata', () => {
  assert.ok(allHtml.length >= 100, `expected the full generated site, found ${allHtml.length} HTML files`);
  allHtml.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file);
    assert.match(html, /<link rel="canonical" href="https:\/\/novapixeltech\.github\.io\/WeatherOrbit\//, `${relative} is missing a canonical`);
    assert.ok(html.includes(`<meta property="og:image" content="${OG_IMAGE}" />`), `${relative} is missing og:image`);
    assert.ok(html.includes(`<meta name="twitter:image" content="${OG_IMAGE}" />`), `${relative} is missing twitter:image`);
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'), `${relative} is missing a Twitter card`);
  });
});

test('generated guides use the WeatherOrbit brand and valid asset paths', () => {
  allHtml.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file);
    assert.doesNotMatch(html, /WeatherScope/, `${relative} still shows the WeatherScope wordmark`);
    assert.doesNotMatch(html, /\/WeatherOrbit\/WeatherOrbit\//, `${relative} has a duplicated path segment`);
    assert.doesNotMatch(html, /og:locale:alternate/, `${relative} advertises locale variants that do not exist as crawlable URLs`);
  });
});

test('generated city guides carry crawlable breadcrumbs and entity markup', () => {
  cityDetailFiles.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file);
    assert.match(html, /class="city-breadcrumb"/, `${relative} is missing visible breadcrumbs`);
    assert.match(html, /"@type":"BreadcrumbList"/, `${relative} is missing BreadcrumbList JSON-LD`);
    assert.match(html, /"@type":"FAQPage"/, `${relative} is missing FAQPage JSON-LD`);
    assert.match(html, /"@type":"City"/, `${relative} is missing City JSON-LD`);
    assert.equal((html.match(/src="\.\.\/support\.js"/g) || []).length, 1, `${relative} must load support.js once`);
    assert.match(html, /href="\.\.\/blog\/how-to-read-a-climate-chart\.html"/, `${relative} should link to the climate-chart article`);
  });
});

test('city climate data is reported as annual averages, not ten-year totals', () => {
  cityClimate.forEach((city) => {
    const climate = city.climate;
    assert.ok(Number.isFinite(climate.annualPrecipMm), `${city.slug} has no annual precipitation`);
    assert.ok(climate.annualPrecipMm < 5000, `${city.slug} has implausible annual precipitation: ${climate.annualPrecipMm}`);
    const monthlySum = climate.monthly.reduce((sum, month) => sum + month.precipMm, 0);
    assert.ok(Math.abs(monthlySum - climate.annualPrecipMm) <= 1.2, `${city.slug} monthly precipitation does not match its annual total`);
  });
  const hongKong = cityClimate.find((city) => city.slug === 'hong-kong');
  assert.ok(hongKong && hongKong.country, 'Hong Kong must have a country label');
  assert.doesNotMatch(read('cities', 'hong-kong.html'), /Weather in Hong Kong, \s*-/);
});

test('the FAQ snow answer uses the coldest month, not the annual average low', () => {
  const tokyo = read('cities', 'tokyo.html');
  assert.doesNotMatch(tokyo, /11\.7°C, which is at or below freezing/);
  assert.match(tokyo, /coldest average nights drop to around -0\.3°C/);
});

test('privacy and blog pages have full metadata and structured data', () => {
  const privacy = read('privacy.html');
  assert.match(privacy, /<link rel="canonical" href="https:\/\/novapixeltech\.github\.io\/WeatherOrbit\/privacy\.html" \/>/);
  assert.match(privacy, /"@type": "WebPage"/);

  const blogIndex = read('blog', 'index.html');
  assert.match(blogIndex, /<meta name="twitter:title" content="WeatherOrbit Blog/);
  assert.match(blogIndex, /"@type": "Blog"/);
  assert.match(blogIndex, /href="\.\.\/cities\/index\.html"/);

  const article = read('blog', 'how-to-read-a-climate-chart.html');
  assert.match(article, /<meta name="twitter:image" content="https:\/\/novapixeltech\.github\.io\/WeatherOrbit\/og-image-v2\.png" \/>/);
  assert.match(article, /"mainEntityOfPage": "https:\/\/novapixeltech\.github\.io\/WeatherOrbit\/blog\/how-to-read-a-climate-chart\.html"/);
  assert.match(article, /href="\.\.\/cities\/tokyo\.html"/);
});

test('the homepage links to the blog and defers local script execution', () => {
  const html = read('index.html');
  assert.match(html, /<a href="blog\/index\.html">WeatherOrbit Blog<\/a>/);
  const localScripts = html.match(/<script src="[^"]+\.js"[^>]*>/g) || [];
  assert.ok(localScripts.length >= 12, 'expected the app script stack');
  localScripts.forEach((tag) => {
    assert.doesNotMatch(tag, /src="https:\/\//, 'external scripts are handled separately');
    assert.match(tag, /\sdefer(?:\s|>)/, `${tag} should be deferred for faster parsing`);
  });
});

test('robots and sitemap guide crawlers to the canonical project URLs', () => {
  const robots = read('robots.txt');
  assert.match(robots, /Disallow: \/WeatherOrbit\/tools\//);
  assert.match(robots, /Disallow: \/WeatherOrbit\/data\//);
  assert.match(robots, /Disallow: \/WeatherOrbit\/tests\//);
  assert.match(robots, /Sitemap: https:\/\/novapixeltech\.github\.io\/WeatherOrbit\/sitemap\.xml/);

  const sitemap = read('sitemap.xml');
  assert.equal((sitemap.match(/<loc>/g) || []).length, cityClimate.length + 5);
  assert.doesNotMatch(sitemap, /\/WeatherOrbit\/WeatherOrbit\//);
  assert.match(sitemap, /<changefreq>/);
  assert.match(sitemap, /<priority>/);
});

test('the generator keeps the SEO fixes on every rebuild', () => {
  assert.doesNotMatch(generator, /WeatherScope/);
  assert.doesNotMatch(generator, /\$\{SITE_URL\}\/WeatherOrbit\//);
  assert.doesNotMatch(generator, /og:locale:alternate/);
  assert.match(generator, /BreadcrumbList/);
  assert.match(generator, /buildSeasonHtml/);
  assert.match(fetcher, /rainSum \/ years/);
});
