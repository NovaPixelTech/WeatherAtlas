# 🌱 WeatherOrbit — Growth, donations and feedback playbook

This is the working document behind the organic-traffic push. It is deliberately
written for the owner, not for users: it explains what was built, why, and what
comes next.

---

## 1. The honest starting point

No website can buy "extremely high" traffic, and no code change can guarantee it.
What we can do is remove the structural ceiling that keeps a single-page weather
app from being found at all:

- Weather is the most competitive niche on the open web (weather.com, AccuWeather,
  BBC Weather, Met Office…). Head terms like "weather" or "weather in Tokyo" are
  effectively owned by giants with years of content, domain authority and news
  backlinks.
- **Long-tail city queries** ("weather in [small city]", "rain this week in
  [town]", "[city] climate averages") have far less competition and convert well.

The realistic plan: compound long-tail organic traffic over 3–6 months rather than
a viral spike.

---

## 2. What was built in this pass

### 2.1 SEO foundation (`index.html`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`)

- Canonical URL, Open Graph + Twitter card tags, `WebApplication` JSON-LD,
  `theme-color`, manifest link, font preconnects.
- `robots.txt` with a sitemap reference.
- `sitemap.xml` listing the landing page, the privacy page, the city index and all
  generated city guides.
- Web app manifest for installability / PWA-shaped behaviour.

### 2.2 Programmatic city guides (100 cities)

- `tools/city-seeds.json` — top ~100 cities by population with ISO country codes.
- `tools/fetch-city-data.js` — Open-Meteo geocoding (country-filtered) + 10-year
  archive climate normals → `data/city-climate.json`.
- `tools/build-city-pages.js` — writes `cities/<slug>.html`, `cities/index.html`
  and `sitemap.xml`.
- `tools/city-page.css` — standalone stylesheet for the guides.

Each guide has a unique title, description, H1, climate statistics, a 12-month
climate table, FAQ JSON-LD and a deep link into the live app
(`../index.html?city=…&region=…&country=…&lat=…&lon=…&tz=…`).

### 2.3 Sharing & analytics on the new pages

- Static pages announce themselves via `window.WEATHERORBIT_STATIC_PAGE`, so the
  Umami **Pages** report shows real rows per city guide.
- Umami custom events: `donate_click` and `helpful_vote` are sent from the support
  and feedback surfaces (see below).

### 2.4 Donations

- `support-config.js` — Ko-fi / PayPal.Me / GitHub Sponsors URLs. **Empty by
  default, so nothing shows until you paste your Ko-fi URL.**
- `support.js` + `#support-dialog` — donation actions + bug/feature links.

### 2.5 Feedback

- `#feedback-dialog` — "Was this helpful?" Yes/No (tracked as `helpful_vote`) plus
  prefilled GitHub issue links (`bug` / `enhancement` labels).
- Helpful-vote buttons on generated city pages (`data-helpful-vote`) funnel into
  the same event.
- `.github/ISSUE_TEMPLATE/` — bug report and feature request forms
  (`config.yml` disables blank issues).

### 2.6 Documentation

- `README.md` — per-section analytics, setup, privacy, testing.
- `GROWTH.md` — this document.

---

## 3. The growth roadmap

### Phase 1 — Foundation (done)

- [x] SEO tags + sitemap + robots + manifest.
- [x] 100 city guides generated from real climate data.
- [x] Per-section analytics + city page analytics + events.
- [x] Donations scaffold + feedback scaffold + issue templates.

### Phase 2 — First indexing & quick wins (next 2 weeks)

- Submit the sitemap in Google Search Console and Bing Webmaster Tools.
- Add the site to Google News / Discover ambitions later; keep it clean.
- Share the app on relevant communities where allowed (no spam).
- Ask the handful of early users to file one real bug + one real feature (they will
  come from the feedback path).

### Phase 3 — Content scale (months 2–6)

- Re-run `tools/build-city-pages.js` with a bigger seed list (300+ cities) or add
  curated "climate guides" for countries/regions (e.g. "Climate of Japan").
- Add a "weather in <city> this week" freshness? Not on a static host — skip;
  instead the guides are evergreen.
- Add internal links: from each guide to related cities in the same country, and
  from the landing page to the city index.

### Phase 4 — Authority

- Earn long-tail backlinks: local weather blogs, travel writers, personal blogs
  that mention "WeatherOrbit weather in <city>".
- Consider a guest post / resource page ("Weather comparison data for <country>").

### Phase 5 — Monetisation beyond donations (later)

- Ko-fi (or PayPal) confirmed → donations live.
- Later: optional paid tier for unlimited saved cities / alerts (only after the
  free product is proven), or a lightweight subscription gate. Keep it optional
  and never promise refunds incorrectly.

---

## 4. Metrics that matter

| Metric | Where | Why |
| --- | --- | --- |
| Section pageviews | Umami Pages | product engagement |
| City guide pageviews | Umami Pages | organic SEO signal |
| `donate_click` events | Umami Events | fundraising conversion |
| `helpful_vote` yes rate | Umami Events | product-market fit signal |
| GitHub issues created | GitHub | bug/feature demand |
| Referral / country split | Umami | where traffic comes from |

---

## 5. How to paste the Ko-fi URL

1. Create the Ko-fi page (or use PayPal.Me).
2. Put it in `support-config.js`:
   - `koFiUrl: 'https://ko-fi.com/yourname'`
   - `payPalMeUrl: 'https://paypal.me/yourname'` (optional)
3. Commit. The support dialog appears immediately; donation clicks are tracked
   as `donate_click` events.

---

## 6. Keeping this document honest

- Traffic promises: none. This file says "compound long-tail", not "viral".
- If a phase is not done, it is not done — do not claim progress in commits.
