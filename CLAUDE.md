# CLAUDE.md

## Project overview

Interactive map of PyJogja (Python Yogyakarta) community meetups since 2016. Built with OpenLayers and Vite, deployed to GitHub Pages.

## Tech stack

- **Map**: OpenLayers 10 (`ol`)
- **Slider**: noUiSlider
- **Plus Code decoding**: `open-location-code`
- **Build**: Vite 6, base path `/kopdar-pyjogja/`
- **Deploy**: GitHub Actions → GitHub Pages on every push to `main`

## Common commands

```bash
npm run dev      # dev server
npm run build    # production build → dist/
npm run preview  # preview the dist build
```

## Data source

Kopdar data is fetched live at page load from the PyJogja Google Sheet via the `gviz/tq?tqx=out:csv` endpoint (no API key needed, sheet must be "Anyone with the link can view").

Sheet columns: `No`, `Date`, `Format`, `Plus Code`, `Location`, `Announcement`, `Documentation`, `Notes`

The fetch + parse logic lives in `src/main.js` (`fetchSheetFeatures`). It:
1. Fetches CSV from Google Sheets
2. Parses it with a hand-rolled CSV parser
3. Decodes Plus Codes (short codes recovered relative to Jogja center) to lat/lng
4. Maps `Format` strings to internal `type` keys via `FORMAT_TO_TYPE`

## Key files

| File | Purpose |
|---|---|
| `src/main.js` | All app logic — data fetch, map setup, filters, popups, list |
| `src/style.css` | All styles — panel, pills, popup, list, responsive breakpoints |
| `index.html` | HTML shell — panel markup, type filter pills, about modal |
| `vite.config.js` | Vite config (base path only) |
| `.github/workflows/deploy.yml` | CI/CD: build + deploy to GitHub Pages |

## Architecture notes

- Map fills full viewport; floating panel overlays top-left on desktop, bottom sheet on mobile (breakpoint: 640px)
- `allFeatures` is a module-level `let []` populated asynchronously after fetch; slider and filter UI initialize only after data loads
- Type filter pills are rendered in HTML; counts and zero-count removal happen in JS after data loads
- `activeTypes` set drives both map layer and list filtering via `applyFilters()`
