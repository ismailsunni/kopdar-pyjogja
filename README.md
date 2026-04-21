# Kopdar PyJogja Map

Interactive map of [PyJogja](https://www.meetup.com/Python-ID/) (Python Yogyakarta) community meetups since 2016.

**Live:** https://ismailsunni.github.io/kopdar-pyjogja/

## Features

- Interactive map of all kopdar locations, clustered by proximity
- Filter by event type (Talks, Lightning Talk, Workshop, Syawalan, etc.)
- Time range slider to explore meetups across years
- Click a marker to see event details, links to announcements and docs
- List of kopdar visible in the current map extent
- Data loaded live from the community Google Sheet — no redeploy needed when the sheet is updated

## Data

Data is sourced from the [PyJogja Google Sheet](https://docs.google.com/spreadsheets/d/18EoSHX94LZZBIHPCWurSHyjvQJyUmzYb2Dc7ezitSCE/edit?usp=sharing), fetched at page load via the public CSV export endpoint. Locations are encoded as [Plus Codes](https://maps.google.com/pluscodes/) and decoded client-side.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # build to dist/
npm run preview  # preview production build
```

## Tech stack

- [OpenLayers](https://openlayers.org/) — map rendering
- [noUiSlider](https://refreshless.com/nouislider/) — time range slider
- [open-location-code](https://github.com/google/open-location-code) — Plus Code decoding
- [Vite](https://vitejs.dev/) — build tool
- GitHub Actions + GitHub Pages — CI/CD

## License

MIT
