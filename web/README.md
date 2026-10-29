# Website

React + TypeScript, built with Vite into static files. The first view reads the prebuilt JSON the pipeline writes to `data/web/` (a manifest plus one file per event), so it needs no server and no query engine.

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

- `src/data/types.ts`: shapes of the JSON files, matching `pipeline/src/macro_event_lab/web_export.py`.
- `src/data/load.ts`: fetches and validates the JSON; a wrong or outdated file fails with the name of the bad field.
- `src/lib/`: formatting, point-in-time snapshot lookup, URL state, the plain words reading of each event and the glossary, all unit tested.
- `src/components/`: one file per page (Event Explorer, Compare, Method, Glossary, About) and per chart, plus the header.
- `summary.json` (next to `manifest.json`): per series calibration and yield response, and one point per scored event, for the Compare page.
- `public/`: logo and favicons, copied as is into the build.
- Links keep the view: `?event=kxcpi-26sep&h=48` opens that event 48 hours before its market closed.
- `prototype/`: the static design prototype the site is being built from.
- `DESIGN_RESEARCH.md`, `DESIGN_BRIEF.md`: design research and the brief behind the prototype.

`public/data/` is never committed: data derived from market prices is published only after a review of the data providers' terms.
