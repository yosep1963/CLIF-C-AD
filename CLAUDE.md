# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLIF-C AD Score Calculator — a medical PWA that predicts mortality in hospitalised patients with acute decompensation (AD) of cirrhosis **without ACLF** (Jalan R, et al. J Hepatol 2015;62:831-40). Static vanilla JS, no framework, no dependencies. Korean-language UI targeting clinicians. `CLIF-C AD.txt` is the original requirements document (CP949-encoded).

## Commands

```bash
npm run build   # node scripts/build.js → dist/ (the deploy folder)
npm test        # node --test — tests/*.test.mjs, no dependencies
npm run serve   # serve dist/ locally (npx serve)
```

Run `npm test` after any change to `src/calculator.js`, `public/index.html`, `public/service-worker.js`, or `scripts/build.js`.

## Structure

- `src/calculator.js` — all medical logic as pure functions on the global `ClifCAd` (no DOM): input ranges and validation, score, risk group, predicted mortality, ACLF-criteria check, history recalculation, share text. Tests load it in a vm context (`tests/load-scripts.mjs`)
- `src/app.js` — DOM wiring, history (localStorage `clif-c-ad-history`, max 5), share/copy, install banner, service worker registration
- `public/` — `index.html`, `manifest.json`, `service-worker.js`, `sw.js` (legacy shim), `_headers`, `_redirects`, `icons/`
- `scripts/build.js` — copies `public/` → `dist/` and `src/` → `dist/src/` (skips dotfiles) and stamps `__APP_VERSION__` (package.json version) and `__BUILD_ID__` (hash of the version and all source files) into `index.html` and `service-worker.js`

## Medical Logic (`src/calculator.js`)

- CLIF-C AD = 10 × [0.03 × Age + 0.66 × ln(Cr) + 1.71 × ln(INR) + 0.88 × ln(WBC/1000) − 0.05 × Na + 8]; WBC is entered in cells/µL; score rounded to 1 decimal
- Risk groups (Jalan 2015): ≤45 low, >45 and <60 moderate (key `'moderate'` kept for stored records), ≥60 high
- Predicted mortality `P = 1 − exp(−ci × exp(beta × score))` with the EF CLIF calculator coefficients: 90-day (0.00056, 0.1007), 1-year (0.00879, 0.0698) — the same as the CLIF-C OF app's follow-up score, so both apps give identical results
- ACLF check from the entered values (CANONIC): Cr ≥2.0 (kidney failure), or INR ≥2.5 with Cr 1.5–1.9 → ACLF criteria met → `applicable: false`, no risk group or mortality shown (use CLIF-C ACLF). INR ≥2.5 with Cr <1.5 → caution only (ACLF-1 if HE grade 1–2); results still shown
- Input ranges follow `CLIF-C AD.txt`: age 18–100, Cr 0.1–10, INR 0.1–8, WBC 100–50,000, Na 100–160
- History records are stored as saved (`score`, `risk`, `riskText`, `values`, `timestamp`) and displayed through `ClifCAd.recalculate`, which re-runs them with current rules and flags `isChanged` ("기준 변경"); stored records are never rewritten

Medical accuracy is critical — do not change thresholds or coefficients without checking the source literature.

## Deployment & PWA

- Deploy folder: `dist/` (built, git-ignored). Netlify drag & drop: upload `dist/`. Git deploys use `netlify.toml` (`node scripts/build.js`, publish `dist`)
- Headers and the SPA redirect live in `public/_headers` / `public/_redirects` so they ship inside `dist/`; no long-term caching because file names are not hashed
- `service-worker.js`: cache-first; cache name `clif-c-ad-v{VERSION}-{BUILD_ID}`; precaches `/`, `/index.html`, the manifest, icons, and the `?v={BUILD_ID}` script/style URLs with `cache: 'reload'`; activate deletes other `clif-c-ad-` caches. Any source change gives a new build ID, so users get updates even without a version bump
- `sw.js` only runs `importScripts('service-worker.js')`: v1.0.0 (the old single-file `deploy/` build) registered `/sw.js`, so this lets existing installs update — keep it
- `tests/build.test.mjs` builds into a temp folder and fails if `index.html` requests anything that is not precached, a precached file is missing, a placeholder is left, or `sw.js` stops loading the service worker
- Release: bump `version` in `package.json` (shown in the footer) → `npm test` → `npm run build` → upload `dist/`
- Icons: `icon-192/512` (any), `icon-maskable-192/512`, `icon-180` (apple-touch, full-bleed — iOS shows transparent corners as black), `icon-16/32` favicons
