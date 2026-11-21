'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I18n = require('../i18n.js');
I18n.translations.fr = require('../fr.js');

const ROOT = path.join(__dirname, '..');

function read(...segments) {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

const html = read('index.html');
const css = read('styles.css');
const supportSource = read('support.js');

function dict(lang) {
  return I18n.translations[lang] || I18n.translations.en;
}

test('the free banner sits above <main> and is reachable before the forecast', () => {
  const banner = html.indexOf('id="free-banner"');
  const main = html.indexOf('<main');
  assert.ok(banner !== -1, 'the free banner is missing');
  assert.ok(main !== -1, 'the main area is missing');
  assert.ok(banner < main, 'the banner must render above the main content');
  assert.match(html, /<section class="free-banner" id="free-banner" aria-labelledby="free-banner-title">/);
});

test('the banner is a labelled section with a real heading and a real button', () => {
  assert.match(html, /<h2 class="free-banner-title" id="free-banner-title" data-i18n="banner\.title">/);
  assert.match(html, /<button type="button" class="free-banner-cta" id="banner-support-btn">/);
  assert.match(html, /<span data-i18n="banner\.support">/);
  assert.match(html, /<span class="free-banner-note" data-i18n="banner\.note">/);
});

test('the decorative globe is hidden from assistive technology and from the tab order', () => {
  const artStart = html.indexOf('<div class="free-banner-art"');
  const artEnd = html.indexOf('</div>', artStart);
  assert.ok(artStart !== -1, 'the banner art wrapper is missing');
  const art = html.slice(artStart, artEnd);
  assert.match(art, /aria-hidden="true"/);
  assert.doesNotMatch(art, /<button|<a\s/);
  assert.doesNotMatch(art, /tabindex/);
});

test('the banner keeps its promise and never persists a dismissal', () => {
  const bannerStart = html.indexOf('id="free-banner"');
  const bannerEnd = html.indexOf('</section>', bannerStart);
  const banner = html.slice(bannerStart, bannerEnd);
  assert.doesNotMatch(banner, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(banner, /close|dismiss/i, 'no dismissal affordance should exist');
  assert.match(banner, /banner\.eyebrow/);
  assert.match(banner, /banner\.body/);
});

test('the banner CTA opens the existing support dialog and tags its source', () => {
  assert.match(supportSource, /element\('banner-support-btn'\)/);
  assert.match(
    supportSource,
    /bannerSupportBtn\.addEventListener\('click',[\s\S]*?trackEvent\('support_open', \{ source: 'banner' \}\)[\s\S]*?openDialog\('support-dialog'\)/
  );
});

test('the banner styles exist, are theme-token driven and animate only the art', () => {
  for (const selector of [
    '.free-banner',
    '.free-banner-art',
    '.free-banner-copy',
    '.free-banner-eyebrow',
    '.free-banner-title',
    '.free-banner-body',
    '.free-banner-cta',
    '.free-banner-note',
  ]) {
    assert.ok(css.includes(selector), `${selector} is not styled`);
  }
  assert.match(css, /@keyframes fb-orbit-dash/);
  assert.match(css, /@keyframes fb-pin-pulse/);
  // The art is authored before the copy so it can become a watermark on phones;
  // explicit placement keeps the copy in the wide leading column on desktop.
  assert.match(css, /\.free-banner-copy\s*\{[^}]*grid-column:\s*1/);
  assert.match(css, /\.free-banner-art\s*\{[^}]*grid-column:\s*2/);
  // The art has to fold into a watermark on phones instead of taking a row.
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.free-banner-art \{[\s\S]*?position: absolute/);
});

test('every banner string exists in all six languages', () => {
  const keys = ['banner.eyebrow', 'banner.title', 'banner.body', 'banner.support', 'banner.note'];
  for (const lang of ['en', 'el', 'de', 'it', 'es', 'fr']) {
    const translated = dict(lang);
    for (const key of keys) {
      assert.ok(
        typeof translated[key] === 'string' && translated[key].trim().length > 0,
        `${lang} is missing ${key}`
      );
    }
  }
});

test('the banner keeps its appeal in every language', () => {
  const english = dict('en');
  assert.match(english['banner.eyebrow'], /100% free/i);
  assert.match(english['banner.support'], /Keep WeatherOrbit free/i);
  // The supporting note must make optionality explicit so the ask never reads
  // as a paywall.
  assert.match(english['banner.note'], /optional/i);
  // No placeholders are used, so translations cannot drift out of sync.
  for (const lang of ['en', 'el', 'de', 'it', 'es', 'fr']) {
    assert.doesNotMatch(dict(lang)['banner.body'], /\{\w+\}/);
  }
});
