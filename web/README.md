# Website

React + TypeScript, built with Vite into static files. Pages read the prebuilt JSON the pipeline writes to `data/web/`, so the website needs no application server or query engine. Overview is the entry page; Events loads a manifest and one file per selected release.

## Run it locally

```bash
python -m macro_event_lab build   # from the repo root: writes data/web/
cd web
npm ci
npm run sync-data                 # copies data/web into public/data (gitignored)
npm run dev
```

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Type check, then build static files into `dist/` |
| `npm run typecheck` | TypeScript check only |
| `npm test` | Unit tests (Vitest) |
| `npm run sync-data` | Copy `data/web` (or `$MEL_DATA_DIR/web`) into `public/data` |

## Layout

- `index.html`: the Vite entry document, font links and theme initialization before the first paint. Page content belongs in React files, not this document.
- `src/main.tsx`: mounts React and imports the stylesheet entry.
- `src/App.tsx`: composes the shared header, active page and footer.
- `src/pages/`: Overview, Events, Compare, Scorecard, Revisions, Models, Method, Glossary and About, each in its own file.
- `src/components/`: reusable controls, charts, reading blocks and shared layout. Explorer is the event detail component composed by the Events page.
- `src/hooks/`: browser navigation, persistent Events selection and loading state, chart measurement and animation hooks. Keeping Events state above the page preserves the selected release and filter across navigation.
- `src/styles.css`: ordered CSS imports only. Keep import order stable because later rules can override earlier rules.
- `src/styles/tokens.css`: the light and dark theme variables.
- `src/styles/pages/`: styles for individual pages. Shared base, layout, navigation, reading, charts, footer, story and motion rules live in the other `src/styles/` files.
- `src/data/types.ts`: shapes of the JSON files, matching `pipeline/src/macro_event_lab/web_export.py`.
- `src/data/load.ts`: fetches and validates the JSON; a wrong or outdated file fails with the name of the bad field.
- `src/lib/`: formatting, point-in-time snapshot lookup, URL state, the plain words reading of each event and the glossary, all unit tested.
- Tests live next to the code they check. `src/App.test.ts` exercises routing, history restoration, Events state retention and loading failures with the chart rendering isolated.
- `summary.json` (next to `manifest.json`): per series calibration and yield response, and one point per scored event, for the Compare page.
- `public/`: logo and favicons, copied as is into the build.
- `public/robots.txt`: asks all crawlers not to crawl the site. Vite copies it to `dist/robots.txt`; hosting must serve it at the origin's `/robots.txt`. This also asks search engines not to crawl and does not block clients that ignore the policy or protect private data.
- Links keep the view: `?event=kxcpi-26sep&h=48` opens that event 48 hours before its market closed.
- `?page=events` opens Events explicitly; the root opens Overview. Models reads its separate ALFRED-only nowcast export.
- `prototype/`: the static design prototype the site is being built from.
- `DESIGN_RESEARCH.md`, `DESIGN_BRIEF.md`: design research and the brief behind the prototype.

`public/data/` is never committed: data derived from market prices is published only after a review of the data providers' terms.
