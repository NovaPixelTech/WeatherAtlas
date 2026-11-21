'use strict';
/**
 * WeatherOrbit visitor analytics - Umami wiring tests
 * =========================================================================
 * Every HTML page ships Umami's standard deferred snippet with the public
 * Website ID. `analytics.js` reuses that tag - it never injects a second copy -
 * and adds the section/event analytics on top.
 *
 * These tests cover that contract:
 *
 *   * every HTML page contains the exact snippet, with the configured ID;
 *   * index.html loads the config and loader before the snippet so the tag can
 *     be decorated before it executes;
 *   * an existing tag is reused, decorated, and never duplicated;
 *   * a page with no snippet still gets the fallback injected tracker;
 *   * the bridge sets no cookie and never calls umami.identify();
 *   * the privacy notice and README describe the plain-tag behaviour.
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

function allHtmlFiles(dir = ROOT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return allHtmlFiles(full);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.html') ? [full] : [];
  });
}

// Privacy claims are allowed to be stated in comments; this is the code that
// actually runs, with comments stripped.
const clientCode = client
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const WEBSITE_ID = 'e7e8c629-41e0-4a24-b143-cca79313c5cf';
const UMAMI_SNIPPET = `<script defer src="https://cloud.umami.is/script.js" data-website-id="${WEBSITE_ID}"></script>`;

// ==========================================================================
// Static wiring
// ==========================================================================

test('index.html loads the config and loader before the deferred snippet', () => {
  const configAt = html.indexOf('src="analytics-config.js"');
  const clientAt = html.indexOf('src="analytics.js"');
  const snippetAt = html.indexOf(UMAMI_SNIPPET);
  assert.notEqual(configAt, -1, 'analytics-config.js is not loaded');
  assert.notEqual(clientAt, -1, 'analytics.js is not loaded');
  assert.notEqual(snippetAt, -1, 'the Umami snippet is missing');
  assert.ok(configAt < clientAt, 'the config must run before the loader');
  assert.ok(clientAt < snippetAt, 'the loader must decorate the snippet before it executes');
  assert.match(html.slice(clientAt - 80, clientAt + 40), /defer/);
});

test('every HTML page ships the exact Umami snippet once', () => {
  const files = allHtmlFiles();
  assert.ok(files.length >= 100, `expected the generated site, found ${files.length} HTML files`);
  files.forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const occurrences = text.split(UMAMI_SNIPPET).length - 1;
    assert.equal(occurrences, 1, `${path.relative(ROOT, file)} must contain the snippet exactly once`);
  });

  // Regenerating the city guides must not drop it from either template.
  const generator = read('tools/build-city-pages.js');
  assert.equal(generator.split(UMAMI_SNIPPET).length - 1, 2);
});

test('the shipped config uses the Website ID from the snippet', () => {
  assert.match(config, /provider:\s*'umami'/);
  assert.match(config, new RegExp(`websiteId:\\s*'${WEBSITE_ID}'`));
  assert.match(config, /excludeSearch:\s*true/);
  assert.match(config, /excludeHash:\s*true/);
  assert.match(config, /respectDoNotTrack:\s*true/);
  // A fork must be told that emptying the ID does not stop the plain snippet.
  assert.match(config, /snippet\s+still\s+sends\s+its\s+basic\s+pageview/);
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
  assert.match(body, /WeatherOrbitAnalytics[\s\S]*trackSection\(mode\)/);
});

// ==========================================================================
// Loader behaviour, against a small hand-written browser
// ==========================================================================

// Stand-in for the standard deferred tag already present in the HTML.
function makeShippedTag() {
  return {
    attrs: {
      src: 'https://cloud.umami.is/script.js',
      'data-website-id': WEBSITE_ID,
    },
    listeners: {},
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    },
  };
}

function runLoader(options = {}) {
  const appended = [];
  const document = {
    head: { appendChild: (node) => appended.push(node) },
    body: { appendChild: (node) => appended.push(node) },
    documentElement: { appendChild: (node) => appended.push(node) },
    getElementsByTagName() {
      return options.existingScript ? [options.existingScript] : [];
    },
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
    pathname: options.pathname || '/WeatherOrbit/',
  };
  const navigator = {
    doNotTrack: options.doNotTrack || null,
    globalPrivacyControl: Boolean(options.globalPrivacyControl),
  };
  const window = {
    WeatherOrbit_ANALYTICS: Object.prototype.hasOwnProperty.call(options, 'config')
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
  if (options.staticPage) window.WEATHERORBIT_STATIC_PAGE = options.staticPage;
  const sandbox = { window, location, navigator, document, console, URL };
  window.document = document;
  window.location = location;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(client, sandbox);

  return { appended, sandbox, window };
}

test('a page with no snippet still gets the fallback injected tracker', () => {
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

test('an existing snippet is reused, decorated, and never injected twice', () => {
  const shipped = makeShippedTag();
  const result = runLoader({ existingScript: shipped });

  assert.equal(result.appended.length, 0, 'no second tracker may be injected');
  assert.equal(shipped.attrs['data-website-id'], WEBSITE_ID);
  assert.equal(shipped.attrs['data-exclude-search'], 'true');
  assert.equal(shipped.attrs['data-exclude-hash'], 'true');
  assert.equal(shipped.attrs['data-auto-pageview'], 'false');
  assert.equal(shipped.attrs['data-do-not-track'], undefined, 'the plain snippet must stay plain');
  assert.ok(shipped.listeners.load, 'the loader listens for the shipped tag');

  const sent = captureUmami(result);
  result.window.WeatherOrbitAnalytics.trackSection('compare');
  shipped.listeners.load();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/WeatherOrbit/compare');
});

test('the automatic pageview is off, because sections are sent by hand', () => {
  const { appended } = runLoader();
  assert.equal(appended[0].attrs['data-auto-pageview'], 'false');
});

test('each app mode reports its own virtual page path', () => {
  const result = runLoader();
  const sent = captureUmami(result);
  result.window.WeatherOrbitAnalytics.trackSection('city');
  result.window.WeatherOrbitAnalytics.trackSection('compare');
  result.window.WeatherOrbitAnalytics.trackSection('climate');
  result.window.WeatherOrbitAnalytics.trackSection('cameras');

  assert.deepEqual(
    sent.map((payload) => [payload.url, payload.title]),
    [
      ['/WeatherOrbit/city-search', 'WeatherOrbit - City Search'],
      ['/WeatherOrbit/compare', 'WeatherOrbit - Compare Locations'],
      ['/WeatherOrbit/climate-filter', 'WeatherOrbit - Climate Filter'],
      ['/WeatherOrbit/live-cameras', 'WeatherOrbit - Live Cameras'],
    ]
  );
  // Default properties (the website id) survive the URL override.
  assert.equal(sent[0].website, WEBSITE_ID);
});

test('repeating a section, or naming an unknown one, is not a pageview', () => {
  const result = runLoader();
  const sent = captureUmami(result);
  result.window.WeatherOrbitAnalytics.trackSection('city');
  result.window.WeatherOrbitAnalytics.trackSection('city');
  result.window.WeatherOrbitAnalytics.trackSection('nope');
  assert.equal(sent.length, 1);
});

test('a section chosen before the tracker loads is sent when it does', () => {
  const result = runLoader();
  result.window.WeatherOrbitAnalytics.trackSection('climate');
  assert.equal(result.appended.length, 1);

  const sent = captureUmami(result);
  result.appended[0].listeners.load();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/WeatherOrbit/climate-filter');
});

test('an opted-out or unconfigured page exposes a no-op section API', () => {
  const result = runLoader({ config: { provider: 'umami', websiteId: '' } });
  assert.equal(typeof result.window.WeatherOrbitAnalytics.trackSection, 'function');
  const sent = captureUmami(result);
  result.window.WeatherOrbitAnalytics.trackSection('compare');
  assert.equal(sent.length, 0);
});

// Umami's event form is track(name, data), so both arguments matter.
function captureUmamiCalls(result) {
  const calls = [];
  result.window.umami = {
    track(...args) {
      calls.push(
        args.map((arg) =>
          typeof arg === 'function'
            ? arg({ website: WEBSITE_ID, url: 'https://example.test/', title: 'Landing' })
            : arg
        )
      );
    },
  };
  return calls;
}

test('a static city page reports its own path instead of a section', () => {
  const result = runLoader({
    staticPage: {
      url: '/WeatherOrbit/cities/tokyo',
      title: 'Weather in Tokyo, Japan - Climate & Monthly Averages',
    },
  });
  const sent = captureUmami(result);
  result.appended[0].listeners.load();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/WeatherOrbit/cities/tokyo');
  assert.equal(sent[0].title, 'Weather in Tokyo, Japan - Climate & Monthly Averages');
});

test('trackPage normalises an absolute URL and refuses an empty one', () => {
  const result = runLoader();
  const sent = captureUmami(result);
  result.window.WeatherOrbitAnalytics.trackPage(
    'https://novapixeltech.github.io/WeatherOrbit/cities/paris',
    'Paris'
  );
  result.window.WeatherOrbitAnalytics.trackPage('   ', 'Nowhere');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/WeatherOrbit/cities/paris');
});

test('an interaction is sent as a named event with primitive properties', () => {
  const result = runLoader();
  const calls = captureUmamiCalls(result);
  result.window.WeatherOrbitAnalytics.trackEvent('donate_click', {
    provider: 'kofi',
    page: '/WeatherOrbit/cities/tokyo',
    amount: 3,
    recurring: false,
    ignored: { nested: true },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'donate_click');
  const clean = calls[0][1];
  assert.equal(clean.provider, 'kofi');
  assert.equal(clean.page, '/WeatherOrbit/cities/tokyo');
  assert.equal(clean.amount, 3);
  assert.equal(clean.recurring, false);
});
test('event names are capped at Umami\'s 50-character limit', () => {
  const result = runLoader();
  const calls = captureUmamiCalls(result);
  result.window.WeatherOrbitAnalytics.trackEvent('x'.repeat(80), { page: 'test' });
  assert.equal(calls[0][0].length, 50);
});

test('an opted-out page silently ignores pageviews and events', () => {
  const result = runLoader({ config: { provider: 'umami', websiteId: '' } });
  const calls = captureUmamiCalls(result);
  result.window.WeatherOrbitAnalytics.trackPage('/WeatherOrbit/cities/paris', 'Paris');
  result.window.WeatherOrbitAnalytics.trackEvent('helpful_vote', { value: 'yes' });
  assert.equal(calls.length, 0);
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
  assert.equal(runLoader({ hostname: 'WeatherOrbit.local' }).appended.length, 0);
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
