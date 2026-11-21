/**
 * WeatherOrbit visitor analytics - Umami Cloud configuration
 * =========================================================================
 * Umami is a free, cookieless analytics service with its own dashboard. You
 * create the account, add this site, and paste its Website ID below. Nothing
 * here is a secret: the Website ID is public and is sent by the browser.
 *
 * Every HTML page also ships Umami's standard snippet:
 *
 *   <script defer src="https://cloud.umami.is/script.js" data-website-id="e7e8c629-41e0-4a24-b143-cca79313c5cf"></script>
 *
 * `analytics.js` reads this file to find that tag, adds its report-only
 * attributes before the deferred snippet runs, and sends section/event
 * analytics from the same Umami instance. It never injects a second tracker
 * when the snippet is present.
 *
 * The Website ID therefore lives in two places and must stay in sync: here
 * and in the snippet on every HTML page (including tools/build-city-pages.js,
 * which regenerates the city guides).
 *
 * Leaving `websiteId` empty disables the section/event tracker only. The plain
 * snippet still sends its basic pageview; remove the snippet from the pages or
 * block `cloud.umami.is` to disable collection completely.
 *
 * Options:
 *
 *   scriptUrl          Umami Cloud's tracker. Used to recognise the shipped
 *                      tag and by the fallback injector for forked pages that
 *                      have no snippet. Change only for self-hosting.
 *   excludeSearch      Strip `?query` from the recorded URL (report default).
 *   excludeHash        Strip `#hash` from the recorded URL (report default).
 *   respectDoNotTrack  Governs the loader's own guards and the fallback tag.
 *                      The plain shipped snippet does not check DNT/GPC.
 *   domains            Optional comma-separated hostnames Umami may record,
 *                      e.g. 'novapixeltech.github.io'. Empty means no filter.
 *   enabled            Set false to disable the section/event tracker without
 *                      removing the ID. The snippet still sends a pageview.
 *
 * Section tracking is always on when the loader runs. WeatherOrbit is a
 * single-page app, so each mode switch is sent as a virtual pageview
 * (`/WeatherOrbit/city-search`, `/compare`, `/climate-filter`,
 * `/live-cameras`) and the automatic pageview on those pages is turned off.
 *
 * The loader also skips section/event tracking on localhost, file:// pages,
 * and when Do Not Track or Global Privacy Control is enabled. Because the
 * shipped snippet is a plain tag, those visitors still produce a basic
 * pageview. WeatherOrbit never calls umami.identify(), so a visit is never
 * linked to an account or a saved city.
 */
window.WeatherOrbit_ANALYTICS = {
  provider: 'umami',
  scriptUrl: 'https://cloud.umami.is/script.js',
  websiteId: 'e7e8c629-41e0-4a24-b143-cca79313c5cf',
  excludeSearch: true,
  excludeHash: true,
  respectDoNotTrack: true,
  domains: '',
  enabled: true,
};
