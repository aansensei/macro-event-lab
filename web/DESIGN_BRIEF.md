# Prompt: Macro Event Lab UI and UX

Everything below the line is the complete, self-contained brief.

---

You are a senior product designer and front-end engineer who has shipped data products at the level of Our World in Data, the Financial Times graphics desk, Vercel and Linear. Design the user interface and user experience for **Macro Event Lab**, then build it as a static, clickable prototype.

## 1. The product

Macro Event Lab answers one question for every major US macro release:

> What did markets expect before each CPI report, jobs report (NFP) and Fed (FOMC) decision, how did that compare with the number actually published at the time, and how did markets react?

For each release ("event") the data contains:

- **Market expectation over time.** Kalshi prediction markets list contracts such as "CPI month over month above 0.3%". From their prices we derive, hour by hour for the 7 days before the release, a probability distribution over outcomes (bins such as 0.1%, 0.2%, 0.3%, 0.4%, 0.5%), with mean, standard deviation and the 5th, 25th, 50th, 75th and 95th percentiles.
- **The first print.** The number as first published (from ALFRED vintages), at its exact release time (for example 08:30 ET for CPI and jobs, 14:00 ET for FOMC statements).
- **Revisions.** Later revised values with their vintage dates (for example "revised to 0.3% on Nov 13").
- **Surprise.** First print minus the market mean, in standard deviations of the implied distribution, plus the sign.
- **Market reaction.** Change in the 2 year and 10 year Treasury yields on release day, in basis points (daily data, not intraday).
- **Special cases.** Some releases were never published (October 2025 CPI, during a government shutdown). FOMC outcomes are discrete and ordered (cut 50, cut 25, hold, hike 25), not a continuous number.

The core idea is **point in time**: every number is shown as it was known at a given moment, never with information published later. The UI should make this feel tangible.

## 2. Audience and the five second test

- Primary: recruiters and engineers at quant trading firms (Jane Street, Citadel, Two Sigma, HRT). They open the link from a resume, often on a phone.
- In five seconds a visitor must understand: "market expected X, the number came out Y, that was a Z standard deviation surprise".
- An engineer who keeps going must be able to verify everything: sources, vintage dates, snapshot times, a data table, a CSV download, and a "Method" page.
- Tone: a research brief. Specific, restrained, confident. Never marketing copy.

## 3. Design principles (follow strictly)

1. **One color, one meaning.** Blue always means "market expectation" or "interactive". The actual first print is the darkest neutral ink. Surprise uses orange (positive) and purple (negative), always with a "+" or "−" sign. No color is decorative.
2. **Never show a single probability alone.** Every expected value carries a range (the 50% interval) and a plain-language sentence.
3. **The chart is the hero; sources are mandatory.** Every chart has a sentence-style title, a source line, the vintage date, and a "Table" view.
4. **Static first, motion optional.** The default state is a static view the user can scrub. Playback is opt-in, never autoplays, stops at the end.
5. **Glanceable on top, verifiable underneath.** Key numbers first, then the process, then the provenance.
6. **Structure with alignment and hairline borders,** not cards inside cards, drop shadows or gradients.
7. **Mobile is the primary layout,** not a shrunken desktop. Design at 375px first, check 320px, then scale up.

## 4. Brand slot: logo (required)

The owner has a **horizontal rectangular logo** (wordmark style). Reserve a dedicated slot for it:

- Position: top left of the header on every page, vertically centered in the header bar. It links to the home page.
- Size: a box of **160 x 32 px on desktop** and **120 x 24 px on mobile** (aspect ratio about 5:1). The logo must scale to fit inside this box with `object-fit: contain`, never stretch.
- Clear space: at least 12px empty space on all sides of the box. Nothing else (nav items, buttons) may enter that space.
- Implementation: an `<a class="logo-slot" href="/">` containing `<img src="logo-light.svg" alt="Macro Event Lab">` for light mode and `logo-dark.svg` for dark mode (switch with the theme). Until the real files exist, render a **visible placeholder**: a rectangle with a 1px dashed border in the neutral border color, the text "LOGO 160 x 32" centered in small caps, same size as the slot. Do not draw or invent a logo.
- The text "Macro Event Lab" must not also appear next to the logo in the header (the logo is the wordmark). It may appear in the footer and the page title.
- Also reserve a square favicon slot (32 x 32) with a placeholder.

## 5. Visual system

### Color tokens (use exactly these values)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#111113` | Page background |
| `--surface` | `#f9f9fb` | `#18191b` | Table stripes, control bar, code blocks |
| `--surface-hover` | `#f0f0f3` | `#212225` | Hover rows |
| `--border` | `#d9d9e0` | `#363a3f` | Hairline dividers, decorative grid |
| `--border-control` | `#8b8d98` | `#696e77` | Input borders, axis lines |
| `--text` | `#1c2024` | `#edeef0` | Body text |
| `--text-muted` | `#60646c` | `#b0b4ba` | Secondary text, source lines |
| `--accent` | `#0f62fe` | `#78a9ff` | Links, focus, selected state |
| `--button-bg` | `#0f62fe` | `#0f62fe` | Primary button (white text) |
| `--accent-hover` | `#0043ce` | `#0043ce` | Button hover |
| `--market` | `#0f62fe` | `#4589ff` | Probability bars, market expectation |
| `--band-90` | `#d0e2ff` | `#002d9c` | Fan chart 90% band |
| `--band-50` | `#a6c8ff` | `#0043ce` | Fan chart 50% band |
| `--median` | `#0043ce` | `#a6c8ff` | Median line |
| `--actual` | `#1c2024` | `#edeef0` | First print line and marker |
| `--revision` | `#60646c` | `#b0b4ba` | Revisions (hollow marker, dashed line) |
| `--ghost` | `#8b8d98` | `#777b84` | Outline of the distribution 7 days earlier |
| `--surprise-up` | `#b35806` | `#e08214` | Positive surprise (with "+") |
| `--surprise-down` | `#542788` | `#b2abd2` | Negative surprise (with "−") |

FOMC outcome segments use ordered blues: `#a6c8ff`, `#4589ff`, `#0043ce`, `#001d6c` in light mode, separated by 1px lines in the background color.

Theme: three states (System, Light, Dark), toggle in the header, resolved before first paint (inline script in `<head>`, `data-theme` on `<html>`), with `<meta name="color-scheme" content="light dark">`.

### Typography

- UI font: `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` (Inter variable from Google Fonts is fine for the prototype).
- Mono, only for tickers, series IDs and SQL: `"IBM Plex Mono", ui-monospace, monospace`.
- Scale (size / line height / weight): micro 12/16/400 (axis labels, sources, never smaller than 12px), label 14/20/500, body 16/24/400, h3 20/28/500 (chart titles), h2 24/30/500, h1 28/36/600 (event name), hero numbers 35/40/600 on desktop and 24/30/600 on mobile. No weight above 600.
- Numbers: `font-variant-numeric: tabular-nums lining-nums`, right-aligned in tables, true minus sign (U+2212), always show "+" for positive surprises, fixed decimals per column, units in column headers ("%", "k", "bp"), time zone written as "ET".
- Body text max width 70ch.

### Layout

- Max content width 1200px; text columns max 640px.
- Side padding 16px mobile, 24px tablet, 32px desktop.
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64.
- Radius 6px for controls, 8px for data blocks, never more than 12px.
- Breakpoints: below 640px one column; 640 to 1023px controls beside charts; from 1024px a left sidebar with the event list.
- Charts use fixed `aspect-ratio` (16/10 desktop, 4/5 mobile) so nothing shifts while loading.

## 6. Pages to design

### Page A: Event Explorer (most important, design this first and best)

Desktop structure:

1. **Header:** logo slot (left), nav: Events, Compare, Method, Data, SQL (center or right), theme toggle (far right).
2. **Left sidebar:** release type filter chips [CPI] [Jobs] [FOMC], then a list of events by month, newest first, current one highlighted in blue.
3. **Event header:** "CPI, September 2026" and "Released Oct 14 2026, 08:30 ET".
4. **Key number strip (the five second test):** three blocks in a row:
   - MARKET EXPECTED (T−1h): "0.3% m/m", below it "50% range 0.25 to 0.37".
   - FIRST PRINT: "0.4% m/m", below it "ALFRED vintage 2026-10-14", smaller "Revised to 0.3% (Nov 13)".
   - SURPRISE: "+1.0 SD" in the surprise color, below it "above implied mean".
5. **Main chart row:** left (about 60%) a **fan chart** of the 7 days before release; right (about 40%) the **bin probability chart** at the selected moment, headed "As of Oct 12 08:30 ET (T−48h)".
6. **Time control bar:** Play/Pause button, a native range slider (1 hour steps), and preset chips [T−7d] [T−1d] [T−1h] [Final].
7. **Secondary section:** "Probability above threshold" step chart with a [Chart | Table] toggle and a [Raw | Normalized] toggle; a "Market reaction on release day: 2y +6 bp, 10y +4 bp" line; source line with CSV link; a collapsible "About this data" (tickers, snapshot times, vintages, the as-of rule).

Mobile structure (375px), in this order: header (logo slot, menu button), event selectors as two dropdowns, release time, the key number strip as a 2x2 grid, "As of" line plus a "Readout" line, the bin chart rotated to horizontal bars (labels left, percentages right), the fan chart (4:5, only 50% and 90% bands), reaction and sources, then a **sticky bottom control bar** within thumb reach (Play, slider, preset chips) with `padding-bottom: env(safe-area-inset-bottom)`.

### Page B: Events overview (home)

- A one sentence intro, then a **small multiples** grid: one tile per release, same x axis per indicator, showing the distribution at T−1h and the first print.
- A **surprise strip**: one dot per release on a horizontal axis of surprise in SD, orange or purple with a sign, clickable to open Page A.
- Upcoming releases show the current market expectation and a "next release" date.
- Mobile: one column of sparkline-sized rows with first print and surprise as text.

### Page C: Method

A readable long-form page (640px column): how probabilities are derived from Kalshi prices, normalization, how percentiles are computed, what "point in time" means (`known_from`, `as_of`), data sources and their terms. Use sidenotes or footnotes, one simple diagram, no marketing.

### Page D: FOMC event variant

Same layout as Page A, but the main chart is a **100% stacked horizontal bar** of discrete outcomes at the selected moment and a **stacked area over time**, ordered blues, direct labels on every segment, the actual decision outlined in the actual color with the label "Decision".

## 7. Chart rules

- **Fan chart:** x is "hours before release" from T−7d to T; y is the indicator value. Two bands only (50% and 90%) with direct labels at the right edge; a darker median line; the first print as a horizontal line in `--actual` labeled "First print 0.4%"; revisions as hollow dashed markers; a vertical line labeled "Release 08:30 ET"; a thin vertical cursor at the selected time. The caption must say the fan narrows toward the release.
- **Bin chart:** bars ordered by outcome value, probability printed on or beside each bar ("46%"); an outline-only ghost bar for the distribution at T−7d; after release, the bin containing the first print is outlined in `--actual` and labeled.
- **Threshold chart:** a descending step function of P(X > k) with a dot at each strike; tooltip shows how bin probabilities are differences of adjacent thresholds.
- Direct labels instead of legends. No dual y axes. Never rescale an axis during playback. No 3D, no pie charts, no gauges, no needles, no jitter.
- Every chart has: a sentence title that states the takeaway, an auto-generated summary sentence (for example "At T−48h the market put 46% on 0.3% m/m, up from 38% a week earlier."), a source line ("Sources: Kalshi KXCPI hourly snapshots; BLS CPI via ALFRED, vintage 2026-10-14"), and a collapsible "How to read this chart".

## 8. Interaction and UX

- Slider: native `<input type="range">` with `aria-valuetext` like "48 hours before CPI release, Oct 12 08:30 ET". Arrow keys, Home, End, PageUp, PageDown. Preset chips give a non-dragging alternative.
- Play: a real `<button>` toggling "Play" and "Pause", off by default, about 250ms per step, only bar heights change, stops at the end.
- Hover on desktop; on touch, tap to pin a value into a fixed "Readout" line above the chart (not a floating tooltip under the finger); tap elsewhere or press Escape to unpin. Charts use `touch-action: pan-y` so vertical scrolling still works.
- URL holds the state, for example `?event=cpi-2026-09&t=-48h&view=chart`, so any moment can be shared.
- `prefers-reduced-motion: reduce` turns all transitions off and makes Play step manually.
- Each chart is a `<figure>` with an accessible name and a "Show data table" button that reveals a real `<table>` for the selected moment.
- Charts take one tab stop; arrow keys move between bars inside.
- Touch targets at least 24 x 24 px, 44px for Play, chips and the theme toggle on touch devices.
- Focus ring: 2px `--accent`, 2px offset, never removed.
- Contrast: text at least 4.5:1, chart marks and control borders at least 3:1, in both themes.

## 9. States to design

1. Loading: skeleton blocks with the final dimensions (no layout shift), and a short line "Loading event data".
2. Release not yet published: key number strip shows "First print: due Nov 10, 08:30 ET" and a countdown in plain text (no animation).
3. Release never published (October 2025 CPI): a neutral notice "Not published. BLS did not release October 2025 CPI during the government shutdown." and the market chart still shown.
4. Missing or sparse market data for older events: an honest note and fewer bins, never invented data.
5. Error loading data: a plain message and a retry button.
6. Dark mode and light mode for every page.

## 10. Do not

- No emoji anywhere. No em dashes or en dashes in UI copy; use commas, colons, periods or parentheses.
- No purple or indigo gradients, glassmorphism, background blobs, hero illustrations, three icon feature cards, cards inside cards, or shadows on every block.
- No "AI-powered", "unlock insights", "revolutionize" or similar marketing phrases.
- No red/green as the only signal of up/down.
- No count-up number animations, no autoplay, no looping motion.
- No external chart library for the prototype; draw charts as inline SVG.
- Do not invent a logo; use the placeholder slot described in section 4.

## 11. Mock data (illustrative only)

All numbers below are made up for layout purposes. Label the prototype "Illustrative data" in the footer. Do not present them as real market data.

```json
{
  "event": {
    "id": "cpi-2026-09",
    "release": "cpi",
    "title": "CPI, September 2026",
    "release_ts": "2026-10-14T08:30:00-04:00",
    "unit": "% m/m",
    "first_print": 0.4,
    "first_print_vintage": "2026-10-14",
    "revisions": [{ "value": 0.3, "vintage": "2026-11-13" }],
    "reaction_bp": { "dgs2": 6, "dgs10": 4 }
  },
  "bins": [0.1, 0.2, 0.3, 0.4, 0.5],
  "snapshots": [
    { "t": "-168h", "probs": [0.10, 0.27, 0.38, 0.17, 0.08], "mean": 0.29, "sd": 0.11, "p5": 0.12, "p25": 0.22, "p50": 0.29, "p75": 0.36, "p95": 0.47 },
    { "t": "-48h",  "probs": [0.06, 0.21, 0.46, 0.19, 0.08], "mean": 0.30, "sd": 0.10, "p5": 0.13, "p25": 0.24, "p50": 0.30, "p75": 0.36, "p95": 0.46 },
    { "t": "-1h",   "probs": [0.03, 0.17, 0.52, 0.22, 0.06], "mean": 0.31, "sd": 0.09, "p5": 0.16, "p25": 0.25, "p50": 0.31, "p75": 0.37, "p95": 0.45 }
  ],
  "surprise_sd": 1.0,
  "fomc_example": {
    "title": "FOMC, December 2026",
    "outcomes": ["Cut 50", "Cut 25", "Hold", "Hike 25"],
    "probs_at_t_minus_1h": [0.05, 0.62, 0.31, 0.02],
    "decision": "Cut 25"
  }
}
```

Interpolate between snapshots linearly to fill hourly steps for the prototype.

## 12. Deliverables

1. **Design rationale** (one page): how the design follows the principles above and where you made trade-offs.
2. **A single-file static prototype** (`index.html` with inline CSS and vanilla JavaScript, no build step, no external JS) that contains Page A (CPI) with working slider, preset chips, Play/Pause, tap to pin, URL state, theme toggle, chart/table toggle and the logo placeholder; Page D (FOMC) as a variant; and Page B (overview). Page C (Method) can be a styled text page.
3. **Responsive screenshots or descriptions** for 375px, 768px and 1280px, light and dark.
4. **A component inventory**: header with logo slot, event list, key number block, fan chart, bin chart, threshold chart, FOMC stacked bar, time control bar, source line, "About this data" panel, theme toggle, each with its states.
5. **An accessibility note**: how keyboard, screen reader and reduced motion work in the prototype.

Before you start building, restate in three sentences what a visitor should understand in five seconds, then build.
