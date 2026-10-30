# Tu Tiên 2D — React shell for AI Studio

This project embeds the preserved legacy web client in a React 19 / Vite 6 shell. It is **not** a native React rewrite and **not** a verified complete offline game. Some gameplay features may require a backend.

## Install / run (internet access required on first install)

```bash
npm install --no-audit --no-fund
npm run check
npm run dev
```

Open port 3000. Production build: `npm run build`.

## Current verification

The ZIP archive and source files can be extracted. npm install could not complete in the packaging environment because registry.npmjs.org DNS resolution is unavailable. Consequently Vite build and browser gameplay have not been tested. `npm run check` checks HTML references and currently reports eight missing links to `terms.html`, `privacy.html`, and `support.html` (legal/support pages, not game scripts).

Do not delete `public/legacy/` or change relative paths without updating the HTML references.
