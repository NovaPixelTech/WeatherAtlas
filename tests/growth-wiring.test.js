'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const I18n = require('../i18n.js');
I18n.translations.fr = require('../fr.js');

const ROOT = path.join(__dirname, '..');

function read(...segments) {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

const html = read('index.html');
const supportConfig = read('support-config.js');
const supportSource = read('support.js');
const robots = read('robots.txt');
const manifest = read('manifest.webmanifest');
const growth = read('GROWTH.md');
const analyticsSource = read('analytics.js');
const i18nSource = read('i18n.js');
const frSource = read('fr.js');
const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
const climateDataPath = path.join(ROOT, 'data', 'city-climate.json');
const climateData = fs.existsSync(climateDataPath) ? JSON.parse(fs.readFileSync(climateDataPath, 'utf8')) : null;

const BASE_URL = 'https://novapixeltech.github.io/WeatherScope';

function dict(lang) {
  const found = I18n.translations[lang] || I18n.translations.en;
  return found;
}

function placeholders(value) {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

test('the landing page carries the full SEO + social metadata foundation', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/novapixeltech\.github\.io\/WeatherScope\/" \/>/);
  assert.match(html, /<meta property="og:type" content="website" \/>/);
  assert.match(html, /<meta property="og:site_name" content="WeatherScope" \/>/);
  assert.match(html, /<meta property="og:title" content="WeatherScope - Climate & City Forecasts" \/>/);
  assert.match(html, /<meta property="og:description" content="Search real-time weather conditions by city name or discover cities worldwide meeting your preferred climate conditions\." \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/novapixeltech\.github\.io\/WeatherScope\/" \/>/);
  assert.match(html, /<meta property="og:locale" content="en_US" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/novapixeltech\.github\.io\/WeatherScope\/og-image\.png" \/>/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.match(html, /<script type="application\/ld\+json">\s*\{[\s\S]*"@type": "WebApplication"/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" \/>/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>/);
});

test('robots.txt and the sitemap expose the site to crawlers', { skip: !sitemap }, () => {
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, new RegExp(`Sitemap: ${BASE_URL}/sitemap\.xml`));
  assert.ok(sitemap.startsWith('<?xml'));
  assert.match(sitemap, /<urlset/);
  assert.match(sitemap, new RegExp(`<loc>${BASE_URL}/</loc>`));
  assert.match(sitemap, /cities\/index\.html/);
});

test('the web app manifest exists and points at the WeatherScope icons', () => {
  assert.match(manifest, /"name": "WeatherScope"/);
  assert.match(manifest, /"short_name": "WeatherScope"/);
  assert.match(manifest, /"start_url": "\/WeatherScope\/"/);
  assert.match(manifest, /"display": "standalone"/);
});

test('the support configuration exposes fundraising and issue destinations', () => {
  assert.match(supportConfig, /koFiUrl/);
  assert.match(supportConfig, /payPalMeUrl/);
  assert.match(supportConfig, /githubSponsorUrl/);
  assert.match(supportConfig, /githubRepo/);
  assert.match(supportConfig, /bugIssueUrl/);
  assert.match(supportConfig, /featureIssueUrl/);
});

test('the support surface wires the dialog, the helpful vote and the analytics events', () => {
  assert.match(supportSource, /support-dialog/);
  assert.match(supportSource, /feedback-dialog/);
  assert.match(supportSource, /support-donations/);
  assert.match(supportSource, /donate_click/);
  assert.match(supportSource, /helpful_vote/);
  assert.match(supportSource, /feedback-thanks/);
  assert.match(supportSource, /data-helpful-vote/);
});

test('the footer links to the city guides, the support surface and feedback', () => {
  assert.match(html, /href="cities\/index\.html" data-i18n="footer\.cities"/);
  assert.match(html, /id="footer-support-link" data-i18n="footer\.support"/);
  assert.match(html, /id="footer-feedback-link" data-i18n="footer\.feedback"/);
});

test('the new UI strings exist in every language with the same placeholders', () => {
  const english = dict('en');
  const keys = [
    'footer.cities',
    'footer.support',
    'footer.feedback',
    'support.title',
    'support.intro',
    'support.donate',
    'support.paypal',
    'support.sponsor',
    'support.bug',
    'support.feature',
    'support.close',
    'feedback.title',
    'feedback.intro',
    'feedback.helpful',
    'feedback.yes',
    'feedback.no',
    'feedback.thanks',
    'feedback.bug',
    'feedback.feature',
    'feedback.close',
  ];
  keys.forEach((key) => {
    assert.ok(english[key], `English is missing ${key}`);
    ['it', 'es', 'fr'].forEach((lang) => {
      const translated = dict(lang);
      assert.ok(translated[key], `${lang} is missing ${key}`);
      assert.deepEqual(placeholders(translated[key]), placeholders(english[key]), `${lang}.${key} must keep the English placeholders`);
    });
  });
});

test('the event names used by support and feedback fit the tracker limit', () => {
  for (const name of ['donate_click', 'helpful_vote', 'support_open', 'feedback_open']) {
    assert.ok(name.length <= 50, `${name} exceeds the 50 character Umami event limit`);
  }
});

test('the GitHub issue templates and config are in place', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml')));
  assert.ok(fs.existsSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'feature_request.yml')));
  assert.ok(fs.existsSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'config.yml')));
  assert.match(read('.github', 'ISSUE_TEMPLATE', 'bug_report.yml'), /name: Bug report/);
  assert.match(read('.github', 'ISSUE_TEMPLATE', 'feature_request.yml'), /name: Feature request/);
  assert.match(read('.github', 'ISSUE_TEMPLATE', 'config.yml'), /blank_issues_enabled: false/);
});

test('the growth playbook is documented and points at the city guide commands', () => {
  assert.match(growth, /GROWTH\.md/);
  assert.match(growth, /city-seeds\.json/);
  assert.match(growth, /fetch-city-data\.js/);
  assert.match(growth, /build-city-pages\.js/);
});

test('the generated city guides exist for every city with climate data', { skip: !climateData }, () => {
  const withClimate = climateData.filter((city) => city && city.climate && city.slug);
  assert.ok(withClimate.length > 0, 'no climate data has been fetched yet');
  withClimate.forEach((city) => {
    assert.ok(fs.existsSync(path.join(ROOT, 'cities', `${city.slug}.html`)), `missing guide for ${city.slug}`);
  });
});

test('the generated city guides deep-link into the live app forecast', () => {
  if (!climateData) return;
  const withClimate = climateData.filter((city) => city && city.climate && city.slug);
  const sample = withClimate[0];
  if (!sample) return;
  const guide = fs.readFileSync(path.join(ROOT, 'cities', `${sample.slug}.html`), 'utf8');
  assert.match(guide, /Get the live forecast/);
  assert.match(guide, new RegExp(`index\\.html\\?city=${encodeURIComponent(sample.name)}`));
});

test('the analytics loader supports static pages and events', () => {
  assert.match(analyticsSource, /WEATHERSCOPE_STATIC_PAGE/);
  assert.match(analyticsSource, /trackEvent/);
  assert.match(analyticsSource, /trackPage/);
});
