/**
 * WeatherScope visitor analytics - Umami Cloud loader
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
 * Loading the real script (instead of hard-coding a snippet) keeps the
 * Website ID in one file and lets a fork disable analytics completely.
 */
(function () {
  'use strict';

  var config = window.WEATHERSCOPE_ANALYTICS;
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
  if (window.__weatherscopeUmamiLoaded) return;
  window.__weatherscopeUmamiLoaded = true;

  var script = document.createElement('script');
  script.async = true;
  script.src = scriptUrl;
  script.setAttribute('data-website-id', websiteId);

  // These are Umami's own privacy switches. Query strings can carry a shared
  // city and hashes can carry app state, so neither belongs in the report.
  if (config.excludeSearch !== false) script.setAttribute('data-exclude-search', 'true');
  if (config.excludeHash !== false) script.setAttribute('data-exclude-hash', 'true');
  if (config.respectDoNotTrack !== false) script.setAttribute('data-do-not-track', 'true');

  var domains = typeof config.domains === 'string' ? config.domains.trim() : '';
  if (domains) script.setAttribute('data-domains', domains);

  (document.head || document.body || document.documentElement).appendChild(script);

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
