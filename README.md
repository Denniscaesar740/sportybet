# SportyBet Local Clone

This project has been transformed into a fully local, self-contained web application with all external links, trackers, and remote CDN dependencies removed.

---

## What Was Done

1. **Remote Asset Localization**:
   - Downloaded and organized over 460 assets locally into `global/main/`, `common/`, `cms/`, and `sportygames/assets/`.
   - Included core JavaScript bundles, webpack runtime chunks, stylesheets, icons, and banners.
   - Downloaded Google Roboto fonts locally into `global/main/fonts/` with local `@font-face` definitions.

2. **External Link & Tracker Removal**:
   - **Google Tag Manager & Google Analytics**: Stripped tracking snippets and noscript iframes.
   - **External Telemetry & SDKs**: Neutralized Faro telemetry, Firebase auth/DB, AWS WAF verification scripts, Legitimuz identity SDK, and WhoYou.
   - **CDNs**: Replaced `//s.sporty.net/` and `//s.football.com/` references across HTML and JavaScript configs with local relative paths (`/global/main/`, `/common/`, `/cms/`).
   - **Social & Third-Party Links**: Redirected external links (Facebook, Twitter/X, Instagram, SportRadar, YouTube, Telegram) safely to `#`.

3. **Local Backend & Mock APIs**:
   - Built [`server.js`](server.js) to serve all static assets with proper MIME types.
   - Serves CMS endpoints:
     - `/gh/m/cms/pages/getPages` (localization and UI dictionaries)
     - `/gh/m/cms/pages/export/:name` (promotions, banners, and game lists)
   - Serves API responses:
     - Integrates pre-saved responses in `api/gh/...`
     - Provides mock fixture & odds data for sports events via `factsCenter` endpoints
     - Implements graceful fallback for all other API calls (`bizCode: 10000`)

---

## How to Run Locally

Start the local server:
```bash
npm start
```
*(or run `node server.js`)*

Open your browser to any of the following URLs:
- **Main Sports Page**: [http://localhost:3000/](http://localhost:3000/), [http://localhost:3000/index.html](http://localhost:3000/index.html) or [http://localhost:3000/gh/m/sport](http://localhost:3000/gh/m/sport)
- **Instant Virtuals**: [http://localhost:3000/gh/m/instant-virtuals](http://localhost:3000/gh/m/instant-virtuals)
- **Virtuals Lobby**: [http://localhost:3000/gh/m/virtuals-lobby](http://localhost:3000/gh/m/virtuals-lobby)
- **SportyGames Lobby**: [http://localhost:3000/gh/sportygames/lobby](http://localhost:3000/gh/sportygames/lobby)
