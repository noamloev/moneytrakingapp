# BuyBye

BuyBye is a mobile-first, offline-first personal finance PWA. It is designed for Safari on modern iPhones, while remaining responsive on Android, tablets, and desktop browsers.

## Local development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

## Production build and free hosting

`next.config.mjs` uses `output: 'export'`, so the production build is a static site:

```bash
npm run build
```

Deploy the generated `out/` directory to any HTTPS static host such as GitHub Pages, Cloudflare Pages, Netlify, or Vercel static hosting. Configure the host to serve `index.html` for the root route. HTTPS is required for service workers and installability.

### Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in, and choose `Add New Project`.
3. Import the repository.
4. Set `Framework Preset` to `Other` because this project is a static export.
5. Set `Build Command` to `npm run build`.
6. Set `Output Directory` to `out`.
7. Leave the Install Command as the detected `npm install`.
8. Choose the free Hobby plan and click `Deploy`.
9. Open the provided HTTPS URL and send it to the tester.

Vercel will automatically redeploy when new commits are pushed. The app does not require environment variables, a database, or paid services.

For Netlify or Cloudflare Pages, use the same repository, set the build command to `npm run build`, and publish the `out` directory.

If a browser was used before the demo data was removed, open `Profile → Clear all local data`. This resets that browser’s IndexedDB to the empty first-launch state. Each browser and device has its own local database.

## Data and privacy

All core records are stored locally in IndexedDB through Dexie.js. No account or backend is required. The Profile tab supports plain JSON backup, password-encrypted backup using Web Crypto, import, CSV export, and Excel-compatible export.

Local browser data can still be cleared, evicted, or lost when changing devices. The app intentionally reminds users to back up important data.

## PWA and notifications

The manifest, service worker, safe-area spacing, standalone display mode, and iOS Add to Home Screen instructions are included. The service worker caches the app shell and updates its cache version when `CACHE_NAME` changes.

Cooldowns use persisted timestamps and are evaluated when the app opens again. iOS Safari does not guarantee that ordinary JavaScript timers or local notifications run while Safari is closed. Reliable Web Push requires an HTTPS push service, permission, a service worker, and external infrastructure; BuyBye therefore provides an offline in-app decision history and reminders rather than claiming background delivery.

## Tests

```bash
npm run typecheck
npm run build
npm run test:e2e
```

The Playwright suite covers the iPhone viewport, primary navigation, manifest, offline shell, and horizontal overflow. Desktop WebKit or Chromium testing does not replace testing on physical iPhone Safari.
