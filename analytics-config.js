/**
 * WeatherOrbit visitor analytics - Umami Cloud configuration
 * =========================================================================
 * Umami is a free, cookieless analytics service with its own dashboard. You
 * create the account, add this site, and paste its Website ID below. Nothing
 * here is a secret: the Website ID is public and is sent by the browser.
 *
 * Setup (about two minutes):
 *
 *   1. Create a free account at https://cloud.umami.is
 *   2. Add a website. Use `novapixeltech.github.io` as the domain.
 *   3. Copy the Website ID (a UUID such as
 *      94db1cb1-74f4-4a40-ad6c-962362670409).
 *   4. Paste it into `websiteId` below and commit this file.
 *
 * Leave `websiteId` empty to disable collection completely. The loader then
 * adds no script and sends no request, which is the safe default for a fork.
 *
 * Options:
 *
 *   scriptUrl          Umami Cloud's tracker. Change only for self-hosting.
 *   excludeSearch      Strip `?query` from the recorded URL (privacy default).
 *   excludeHash        Strip `#hash` from the recorded URL (privacy default).
 *   respectDoNotTrack  Do not load the tracker when the browser sends DNT.
 *   domains            Optional comma-separated hostnames Umami may record,
 *                      e.g. 'novapixeltech.github.io'. Empty means no filter.
 *   enabled            Set false to disable analytics without removing the ID.
 *
 * Section tracking is always on. WeatherOrbit is a single-page app, so each
 * mode switch is sent as a virtual pageview (`/WeatherOrbit/city-search`,
 * `/compare`, `/climate-filter`, `/live-cameras`) and Umami's automatic
 * pageview is disabled, keeping the landing count at one.
 *
 * The loader also refuses to run on localhost, file:// pages, or when Global
 * Privacy Control is enabled. WeatherOrbit never calls umami.identify(), so a
 * visit is never linked to an account or a saved city.
 */
window.WeatherOrbit_ANALYTICS = {
  provider: 'umami',
  scriptUrl: 'https://cloud.umami.is/script.js',
  websiteId: '08575bb4-58b8-4e70-a596-2c494787c382',
  excludeSearch: true,
  excludeHash: true,
  respectDoNotTrack: true,
  domains: '',
  enabled: true,
};
