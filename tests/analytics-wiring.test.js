'use strict';
/**
 * WeatherScope visitor analytics - Umami wiring tests
 * =========================================================================
 * The repo no longer runs its own collector. It loads Umami Cloud only when
 * `analytics-config.js` contains a Website ID, and it loads it with the
 * privacy switches that keep query strings, hashes and DNT visitors out of
 * the report.
 *
 * These tests cover the glue that decides whether the tracker runs at all:
 *
 *   * index.html loads the config before the deferred loader;
 *   * an empty Website ID means no script and no request;
 *   * localhost, file://, DNT and GPC are not measured;
 *   * the injected tag carries the Website ID and the privacy attributes;
 *   * the loader sets no cookie and never calls umami.identify();
 *   * the privacy notice and README describe Umami accurately.
 *
 *     node --test tests/analytics-wiring.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

const html = read('index.html');
const client = read('analytics.js');
const config = read('analytics-config.js');
const privacyHtml = read('privacy.html');
const readme = read('README.md');
const app = read('app.js');

// Privacy claims are allowed to be stated in comments; this is the code that
// actually runs, with comments stripped.
const clientCode = client
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const WEBSITE_ID = '94db1cb1-74f4-4a40-ad6c-962362670409';

// ==========================================================================
// Static wiring
// ==========================================================================

test('index.html loads the public config before the deferred loader', () => {
  const configAt = html.indexOf('src="analytics-config.js"');
  const clientAt = html.indexOf('src="analytics.js"');
  assert.notEqual(configAt, -1, 'analytics-config.js is not loaded');
  assert.notEqual(clientAt, -1, 'analytics.js is not loaded');
  assert.ok(configAt < clientAt, 'the config must run before the loader');
  assert.match(html.slice(clientAt - 80, clientAt + 40), /defer/);
});

test('the shipped config names a real Umami site and keeps the privacy defaults', () => {
  assert.match(config, /provider:\s*'umami'/);
  // A Website ID is a public UUID; anything malformed would silently collect
  // nothing, so the shape is pinned here.
  assert.match(
    config,
    /websiteId:\s*'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/i
  );
  assert.match(config, /excludeSearch:\s*true/);
  assert.match(config, /excludeHash:\s*true/);
  assert.match(config, /respectDoNotTrack:\s*true/);
  // The empty-string escape hatch stays documented for forks that clone this repo.
  assert.match(config, /Leave `websiteId` empty/);
  assert.doesNotMatch(config, /ADMIN_TOKEN|Bearer|VISITOR_SALT/i);
});

test('the loader sets no cookie, storage key or user identity', () => {
  assert.doesNotMatch(clientCode, /document\.cookie/);
  assert.doesNotMatch(clientCode, /localStorage/);
  assert.doesNotMatch(clientCode, /sessionStorage/);
  assert.doesNotMatch(clientCode, /fingerprint|canvas|WebGL/i);
  assert.doesNotMatch(clientCode, /identify\s*\(/);
});

test('the privacy notice names Umami and explains its session hash', () => {
  assert.match(privacyHtml, /Umami Cloud/);
  assert.match(privacyHtml, /no cookies/i);
  assert.match(privacyHtml, /monthly/i);
  assert.match(privacyHtml, /IP address/i);
  assert.match(privacyHtml, /six months/i);
  assert.match(privacyHtml, /Global Privacy Control/);
  assert.match(privacyHtml, /query string/i);
  assert.doesNotMatch(privacyHtml, /Cloudflare Worker|ADMIN_TOKEN/i);
  assert.doesNotMatch(privacyHtml, /analytics\.html/);
});

test('the public app links to the privacy notice in every language', () => {
  assert.match(html, /href="privacy\.html"/);
  assert.match(html, /data-i18n="footer\.privacy"/);
  assert.match(read('fr.js'), /"footer\.privacy"/);
  assert.match(read('i18n.js'), /'footer\.privacy': 'Privacy & analytics'/);
});

test('the README documents the Umami setup and its free limits', () => {
  assert.match(readme, /Umami/i);
  assert.match(readme, /cloud\.umami\.is/);
  assert.match(readme, /Website ID/i);
  assert.match(readme, /analytics-config\.js/);
  assert.match(readme, /100,000|100k/i);
  assert.match(readme, /cities/i);
});

test('the docs explain the per-section report', () => {
  assert.match(readme, /Per-section statistics/);
  assert.match(readme, /city-search/);
  assert.match(readme, /live-cameras/);
  assert.match(privacyHtml, /City Search/);
  assert.match(privacyHtml, /virtual paths/i);
});

test('setMode reports the active mode as a section', () => {
  const start = app.indexOf('function setMode(mode)');
  assert.notEqual(start, -1, 'setMode is missing');
  const body = app.slice(start, start + 800);
  assert.match(body, /weatherscopeAnalytics[\s\S]*trackSection\(mode\)/);
});

// ==========================================================================
// Loader behaviour, against a small hand-written browser
// ==========================================================================

function runLoader(options = {}) {
  const appended = [];
  const document = {
    head: { appendChild: (node) => appended.push(node) },
    body: { appendChild: (node) => appended.push(node) },
    documentElement: { appendChild: (node) => appended.push(node) },
    createElement() {
      return {
        attrs: {},
        listeners: {},
        setAttribute(name, value) {
          this.attrs[name] = value;
        },
        addEventListener(name, handler) {
          this.listeners[name] = handler;
        },
      };
    },
  };
  const location = {
    protocol: options.protocol || 'https:',
    hostname: options.hostname || 'novapixeltech.github.io',
    pathname: options.pathname || '/WeatherScope/',
  };
  const navigator = {
    doNotTrack: options.doNotTrack || null,
    globalPrivacyControl: Boolean(options.globalPrivacyControl),
  };
  const window = {
    WEATHERSCOPE_ANALYTICS: Object.prototype.hasOwnProperty.call(options, 'config')
      ? options.config
      : {
          provider: 'umami',
          scriptUrl: 'https://cloud.umami.is/script.js',
          websiteId: WEBSITE_ID,
          excludeSearch: true,
          excludeHash: true,
          respectDoNotTrack: true,
          enabled: true,
        },
    navigator,
  };
  const sandbox = { window, location, navigator, document, console };
  window.document = document;
  window.location = location;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(client, sandbox);

  return { appended, sandbox, window };
}

test('a configured site injects the Umami tracker with the privacy switches', () => {
  const { appended } = runLoader();
  assert.equal(appended.length, 1);

  const script = appended[0];
  assert.equal(script.src, 'https://cloud.umami.is/script.js');
  assert.equal(script.async, true);
  assert.equal(script.attrs['data-website-id'], WEBSITE_ID);
  assert.equal(script.attrs['data-exclude-search'], 'true');
  assert.equal(script.attrs['data-exclude-hash'], 'true');
  assert.equal(script.attrs['data-do-not-track'], 'true');
  assert.equal(script.attrs['data-domains'], undefined);
});

// Feed the loader a fake umami.track and collect what it would send. The
// callback form must receive the default payload, so one is supplied here.
function captureUmami(result) {
  const sent = [];
  result.window.umami = {
    track(arg) {
      sent.push(
        typeof arg === 'function'
          ? arg({ website: WEBSITE_ID, url: 'https://example.test/', title: 'Landing' })
          : arg
      );
    },
  };
  return sent;
}

test('the automatic pageview is off, because sections are sent by hand', () => {
  const { appended } = runLoader();
  assert.equal(appended[0].attrs['data-auto-pageview'], 'false');
});

test('each app mode reports its own virtual page path', () => {
  const result = runLoader();
  const sent = captureUmami(result);
  result.window.weatherscopeAnalytics.trackSection('city');
  result.window.weatherscopeAnalytics.trackSection('compare');
  result.window.weatherscopeAnalytics.trackSection('climate');
  result.window.weatherscopeAnalytics.trackSection('cameras');

  assert.deepEqual(
    sent.map((payload) => [payload.url, payload.title]),
    [
      ['/WeatherScope/city-search', 'WeatherScope - City Search'],
      ['/WeatherScope/compare', 'WeatherScope - Compare Locations'],
      ['/WeatherScope/climate-filter', 'WeatherScope - Climate Filter'],
      ['/WeatherScope/live-cameras', 'WeatherScope - Live Cameras'],
    ]
  );
  // Default properties (the website id) survive the URL override.
  assert.equal(sent[0].website, WEBSITE_ID);
});

test('repeating a section, or naming an unknown one, is not a pageview', () => {
  const result = runLoader();
  const sent = captureUmami(result);
  result.window.weatherscopeAnalytics.trackSection('city');
  result.window.weatherscopeAnalytics.trackSection('city');
  result.window.weatherscopeAnalytics.trackSection('nope');
  assert.equal(sent.length, 1);
});

test('a section chosen before the tracker loads is sent when it does', () => {
  const result = runLoader();
  result.window.weatherscopeAnalytics.trackSection('climate');
  assert.equal(result.appended.length, 1);

  const sent = captureUmami(result);
  result.appended[0].listeners.load();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/WeatherScope/climate-filter');
});

test('an opted-out or unconfigured page exposes a no-op section API', () => {
  const result = runLoader({ config: { provider: 'umami', websiteId: '' } });
  assert.equal(typeof result.window.weatherscopeAnalytics.trackSection, 'function');
  const sent = captureUmami(result);
  result.window.weatherscopeAnalytics.trackSection('compare');
  assert.equal(sent.length, 0);
});

test('an empty Website ID, a disabled config or another provider loads nothing', () => {
  assert.equal(runLoader({ config: { provider: 'umami', websiteId: '' } }).appended.length, 0);
  assert.equal(runLoader({ config: { provider: 'umami', websiteId: '   ' } }).appended.length, 0);
  assert.equal(
    runLoader({ config: { provider: 'umami', websiteId: WEBSITE_ID, enabled: false } }).appended.length,
    0
  );
  assert.equal(runLoader({ config: { provider: 'ga4', websiteId: WEBSITE_ID } }).appended.length, 0);
  assert.equal(runLoader({ config: null }).appended.length, 0);
});

test('a non-http script URL is refused', () => {
  const { appended } = runLoader({
    config: { provider: 'umami', websiteId: WEBSITE_ID, scriptUrl: 'javascript:alert(1)' },
  });
  assert.equal(appended.length, 0);
});

test('local development and file:// are never measured', () => {
  assert.equal(runLoader({ hostname: 'localhost' }).appended.length, 0);
  assert.equal(runLoader({ hostname: '127.0.0.1' }).appended.length, 0);
  assert.equal(runLoader({ hostname: 'weatherscope.local' }).appended.length, 0);
  assert.equal(runLoader({ protocol: 'file:' }).appended.length, 0);
});

test('Do Not Track and Global Privacy Control prevent the tracker from loading', () => {
  assert.equal(runLoader({ doNotTrack: '1' }).appended.length, 0);
  assert.equal(runLoader({ doNotTrack: 'yes' }).appended.length, 0);
  assert.equal(runLoader({ globalPrivacyControl: true }).appended.length, 0);
});

test('loading the loader twice cannot inject the tracker twice', () => {
  const { appended, sandbox } = runLoader();
  assert.equal(appended.length, 1);
  vm.runInContext(client, sandbox);
  assert.equal(appended.length, 1);
});

test('optional attributes are honoured only when configured', () => {
  const off = runLoader({
    config: {
      provider: 'umami',
      scriptUrl: 'https://cloud.umami.is/script.js',
      websiteId: WEBSITE_ID,
      excludeSearch: false,
      excludeHash: false,
      respectDoNotTrack: false,
    },
  });
  const script = off.appended[0];
  assert.equal(script.attrs['data-exclude-search'], undefined);
  assert.equal(script.attrs['data-exclude-hash'], undefined);
  assert.equal(script.attrs['data-do-not-track'], undefined);

  const scoped = runLoader({
    config: {
      provider: 'umami',
      websiteId: WEBSITE_ID,
      domains: 'novapixeltech.github.io',
    },
  });
  assert.equal(scoped.appended[0].attrs['data-domains'], 'novapixeltech.github.io');
});

test('a missing scriptUrl falls back to Umami Cloud', () => {
  const { appended } = runLoader({
    config: { provider: 'umami', websiteId: WEBSITE_ID },
  });
  assert.equal(appended[0].src, 'https://cloud.umami.is/script.js');
});
