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
- Overview reads only `summary.json` and `revisions.json`. Its release preview selects the largest absolute surprise in each supported series with an observed 2-year yield change, reveals surprise and daily yields in sequence, and links to the full Events view. Selection and source notes identify these as extreme examples; the SD axis is a standardized distance, not a probability distribution.
- Those two sources load independently. A missing summary leaves revision evidence usable; a missing revisions file leaves the release hook usable. Each source can be retried without resetting the other interaction.
- `src/components/`: reusable controls, charts, reading blocks and shared layout. Explorer is the event detail component composed by the Events page.
- `TimelineData` supplies an optional keyboard-accessible table for the time chart. It shows actual snapshot timestamps and the same quantiles or displayed outcome probabilities as the chart. Rows are mounted only when opened, rounded for display and contained in a scrollable region on small screens.
- `src/hooks/`: browser navigation, persistent Events selection and loading state, chart measurement and animation hooks. Keeping Events state above the page preserves the selected release and filter across navigation.
- The first keyboard link skips repeated navigation. Page navigation and browser history focus the named main content region; changing an hour or revealing a result keeps focus on the control. Browser titles identify the page or selected release.
- `useReducedMotion` follows preference changes while the site is open. Enabling it stops an active replay and settles animated numbers. The timeline then offers a manual Step action, including across missing snapshots. Disabling it does not restart a replay.
- Chart transitions also follow the live preference through `useTween`. Fan and outcome paths break across missing observations; isolated valid observations stay visible as dots.
- `src/styles.css`: ordered CSS imports only. Keep import order stable because later rules can override earlier rules.
- `src/styles/tokens.css`: the light and dark theme variables.
- `src/styles/pages/`: styles for individual pages. Shared base, layout, navigation, reading, charts, footer, story and motion rules live in the other `src/styles/` files.
- `src/data/types.ts`: shapes of the JSON files, matching `pipeline/src/macro_event_lab/web_export.py`.
- `src/data/load.ts`: fetches and validates the JSON; a wrong or outdated file fails with the name of the bad field.
- Event files must match the selected manifest entry's ID, series and event ticker. Validation also rejects invalid bin bounds, nonfinite or out-of-range probabilities, invalid snapshot hours and out-of-range coverage. Empty observation lists remain valid and show an explicit empty state.
- `useResource` handles loading, retry and stale responses for Overview, Compare, Scorecard, Revisions and Models. `ResourceError` preserves a meaningful heading and focuses the main content before its retry control disappears. Events also retries its manifest and explains an empty event list.
- `src/lib/`: formatting, point-in-time snapshot lookup, URL state, the plain words reading of each event and the glossary, all unit tested.
- Tests live next to the code they check. `src/App.test.ts` exercises routing, history restoration, Events state retention and loading failures with the chart rendering isolated.
- `summary.json` (next to `manifest.json`): per series calibration and yield response, and one point per scored event, for the Compare page.
- `public/`: logo and favicons, copied as is into the build.
- `public/robots.txt`: asks all crawlers not to crawl the site. Vite copies it to `dist/robots.txt`; hosting must serve it at the origin's `/robots.txt`. This also asks search engines not to crawl and does not block clients that ignore the policy or protect private data.
- Links keep the view: `?event=kxcpi-26sep&h=48` opens that event at T-48h on its hourly close grid.
- Relative hours use the market close rounded down to the hour, matching the pipeline's snapshot grid. `h=0` is the close hour, not the exact close instant. Earlier contracts can close before release day; use each snapshot's timestamp as the exact cutoff.
- Events supports an optional reveal sequence. `reveal=0` hides the first print, surprise and daily yields; `reveal=1` shows the print and surprise; omitting it shows all results and keeps existing links compatible. The URL preserves this state as the hour changes. Choosing a different release while in the sequence starts with its results hidden.
- The hidden view reads its expectation figures from the selected snapshot. Once the first print is visible, the summary comparison returns to its labelled anchor snapshot. The historical timeline still displays the full pre-close path, and downloaded JSON retains the results. Use the pipeline's temporal evaluation for forecast claims.
- Overview's Open this release link carries the current reveal stage into Events. Browser history restores both the snapshot hour and stage, including a return to the same release.
- Daily Treasury yield changes describe an association over the day. Missing maturities stay unavailable while recorded maturities remain visible. The source notes link to the Federal Reserve H.15 description.
- `?page=events` opens Events explicitly; the root opens Overview. Models reads its separate ALFRED-only nowcast export.
- `prototype/`: the static design prototype the site is being built from.
- `DESIGN_RESEARCH.md`, `DESIGN_BRIEF.md`: design research and the brief behind the prototype.

`public/data/` is never committed: data derived from market prices is published only after a review of the data providers' terms.
