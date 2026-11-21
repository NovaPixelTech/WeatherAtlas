/**
 * WeatherOrbit visitor analytics - Umami Cloud loader
 * =========================================================================
 * Umami is loaded only when `analytics-config.js` contains a Website ID. The
 * loader deliberately does very little:
 *
 *   * no Website ID          -> no script, no request;
 *   * localhost / file://    -> not measured;
 *   * Do Not Track / GPC     -> not measured;
 *   * query strings and hash -> stripped by the tracker itself;
 *   * no `umami.identify()`  -> a visit is never linked to an account.
 *
 * The tracker sets no cookies. Umami's server derives an anonymous session
 * hash from the website ID, IP address, user agent and a monthly rotating
 * salt; the IP is not stored in the analytics record.
 *
 * WeatherOrbit is a single-page app: City Search, Compare, Climate Filter and
 * Live Cameras all live at the same URL. Umami's automatic pageview would
 * therefore fold every visit into one row. Instead, automatic pageviews are
 * turned off and each section switch is sent as a *virtual pageview* whose
 * URL is `/WeatherOrbit/<section>`. Umami treats it like any other page, so
 * its Pages report breaks views and visitors down by section and every filter
 * (country, device, referrer) still applies.
 *
 * Static pages (the generated city guides) declare their report label in
 * `window.WEATHERORBIT_STATIC_PAGE` before this script runs. They send one
 * virtual pageview of their own, so the same Pages report lists the app
 * sections and the city guides together.
 *
 * Loading the real script (instead of hard-coding a snippet) keeps the
 * Website ID in one file and lets a fork disable analytics completely.
 */
(function () {
  'use strict';

  // Section ids are the `mode` values in app.js. A slug becomes the reported
  // path; the title is what the dashboard shows next to it.
  var SECTIONS = {
    city: { slug: 'city-search', title: 'City Search' },
    compare: { slug: 'compare', title: 'Compare Locations' },
    climate: { slug: 'climate-filter', title: 'Climate Filter' },
    cameras: { slug: 'live-cameras', title: 'Live Cameras' },
  };

  var MAX_EVENT_NAME = 50;
  var MAX_EVENT_FIELDS = 12;
  var MAX_FIELD_LENGTH = 200;

  var queue = [];
  var currentSection = '';
  var tracking = false;

  // The app and the static pages call these helpers. They are defined before
  // the guards so a call site never has to care whether analytics is configured
  // or allowed; an unconfigured or opted-out page simply keeps `tracking` false.
  window.WeatherOrbitAnalytics = {
    trackSection: trackSection,
    trackPage: trackPage,
    trackEvent: trackEvent,
  };

  var config = window.WeatherOrbit_ANALYTICS;
  if (!config || config.enabled === false) return;
  if (config.provider !== 'umami') return;

  var websiteId = typeof config.websiteId === 'string' ? config.websiteId.trim() : '';
  if (!websiteId) return;

  var scriptUrl = typeof config.scriptUrl === 'string' && config.scriptUrl.trim()
    ? config.scriptUrl.trim()
    : 'https://cloud.umami.is/script.js';
  if (!/^https?:\/\//i.test(scriptUrl)) return;

  // A page opened from disk or a local server is not production traffic.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (isLocalHost(location.hostname)) return;
  if (privacySignal()) return;

  // A second copy of this script must not load the tracker twice.
  if (window.__WeatherOrbitUmamiLoaded) return;
  window.__WeatherOrbitUmamiLoaded = true;
  tracking = true;

  var script = document.createElement('script');
  script.async = true;
  script.src = scriptUrl;
  script.setAttribute('data-website-id', websiteId);

  // These are Umami's own privacy switches. Query strings can carry a shared
  // city and hashes can carry app state, so neither belongs in the report.
  if (config.excludeSearch !== false) script.setAttribute('data-exclude-search', 'true');
  if (config.excludeHash !== false) script.setAttribute('data-exclude-hash', 'true');
  if (config.respectDoNotTrack !== false) script.setAttribute('data-do-not-track', 'true');

  // The app sends one virtual pageview per section, and a static page sends
  // one for itself. Turning off the automatic pageview avoids a duplicate.
  script.setAttribute('data-auto-pageview', 'false');

  var domains = typeof config.domains === 'string' ? config.domains.trim() : '';
  if (domains) script.setAttribute('data-domains', domains);

  script.addEventListener('load', flush);
  script.addEventListener('error', function () {
    // The tracker never arrived (blocked, offline). Drop anything queued so a
    // later switch cannot replay a section the visitor has already left.
    queue.length = 0;
  });

  (document.head || document.body || document.documentElement).appendChild(script);

  // Generated pages (cities/*.html) announce their own report label. They do
  // not use app.js, so without this they would be invisible in the dashboard.
  var staticPage = window.WEATHERORBIT_STATIC_PAGE;
  if (staticPage && typeof staticPage === 'object') {
    trackPage(staticPage.url, staticPage.title);
  }

  /**
   * Record a visit to one app section. Repeating the active section - a
   * language change calls setMode again, for example - is not a new visit.
   */
  function trackSection(id) {
    if (!tracking) return;
    var section = SECTIONS[id];
    if (!section) return;
    if (id === currentSection) return;
    currentSection = id;
    trackPage(sectionUrl(section), 'WeatherOrbit - ' + section.title);
  }

  /**
   * Record a page visit under an explicit report path. Static city pages use
   * this with the path they want to appear in the Pages report.
   */
  function trackPage(url, title) {
    if (!tracking) return;
    var path = reportPath(url);
    if (!path) return;
    queue.push({
      kind: 'page',
      url: path,
      title: cleanText(title) || 'WeatherOrbit',
    });
    flush();
  }

  /**
   * Record a named interaction (donation click, feedback vote, ...). Umami
   * keeps events in their own report, so they do not distort page views.
   */
  function trackEvent(name, data) {
    if (!tracking) return;
    var eventName = cleanText(name);
    if (!eventName) return;
    queue.push({
      kind: 'event',
      name: eventName.slice(0, MAX_EVENT_NAME),
      data: cleanData(data),
    });
    flush();
  }

  function flush() {
    var umami = window.umami;
    if (!umami || typeof umami.track !== 'function') return;
    var pending = queue.splice(0, queue.length);
    pending.forEach(function (item) {
      if (item.kind === 'event') {
        umami.track(item.name, item.data);
        return;
      }
      umami.track(function (props) {
        var next = {};
        for (var key in props) {
          if (Object.prototype.hasOwnProperty.call(props, key)) next[key] = props[key];
        }
        next.url = item.url;
        next.title = item.title;
        return next;
      });
    });
  }

  // Keep the project path when the site is not served from the domain root,
  // so the report reads /WeatherOrbit/compare rather than /compare.
  function sectionUrl(section) {
    var base = String(location.pathname || '/')
      .replace(/index\.html?$/i, '')
      .replace(/\/+$/, '');
    return base + '/' + section.slug;
  }

  // Accept the relative paths the app generates, an absolute URL, or a bare
  // path, and always report a leading slash without the domain.
  function reportPath(value) {
    var text = cleanText(value);
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) {
      try {
        var parsed = new URL(text);
        text = parsed.pathname + parsed.search;
      } catch (error) {
        return '';
      }
    }
    return text.charAt(0) === '/' ? text : '/' + text;
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  // Umami accepts a small property bag per event. Keep it to primitives so a
  // bug elsewhere cannot accidentally send a whole object or a huge string.
  function cleanData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
    var clean = {};
    var fields = 0;
    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (fields >= MAX_EVENT_FIELDS) break;
      var value = data[key];
      if (typeof value === 'string') {
        clean[key] = value.slice(0, MAX_FIELD_LENGTH);
        fields += 1;
      } else if (typeof value === 'number' && isFinite(value)) {
        clean[key] = value;
        fields += 1;
      } else if (typeof value === 'boolean') {
        clean[key] = value;
        fields += 1;
      }
    }
    return fields ? clean : undefined;
  }

  function isLocalHost(hostname) {
    var host = String(hostname || '').toLowerCase();
    if (!host) return true;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
    return false;
  }

  function privacySignal() {
    var nav = window.navigator || {};
    if (nav.doNotTrack === '1' || nav.doNotTrack === 'yes') return true;
    if (window.doNotTrack === '1') return true;
    if (nav.globalPrivacyControl === true || nav.globalPrivacyControl === '1') return true;
    return false;
  }
})();
