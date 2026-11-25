import { ExternalLink } from "../components/ExternalLink";
import { PageGuide } from "../components/PageGuide";
import { RailPage, type RailSection } from "../components/SectionRail";
import { formatFileSize, OPEN_DATA_FILES, OPEN_DATA_SIZES } from "../lib/openData";

const DUCKDB_QUERY =
  `SELECT contestant, rmse FROM 'https://aansensei.dev/macro-event-lab/data/arena_scores.parquet' WHERE target = 'gdp' AND "window" = 'all' ORDER BY rmse;`;

const POLARS_QUERY = [
  "import polars",
  "",
  "scores = polars.read_parquet(",
  '    "https://aansensei.dev/macro-event-lab/data/arena_scores.parquet"',
  ")",
  "print(",
  '    scores.filter((polars.col("target") == "gdp") & (polars.col("window") == "all"))',
  '    .sort("rmse")',
  '    .select("contestant", "rmse")',
  ")",
].join("\n");

function sectionId(file: string): string {
  return `data-${file.replace(/\.(csv|parquet)$/, "").replace(/_/g, "-")}`;
}

const RAIL: RailSection[] = [
  { id: "data-top", label: "Top" },
  { id: "data-sizes", label: "File sizes" },
  { id: "data-query", label: "Query without downloading" },
  ...OPEN_DATA_FILES.map((entry) => ({ id: sectionId(entry.parquet), label: entry.title })),
  { id: "data-notes", label: "Units and sources" },
];

export function Data({ fileSizes = OPEN_DATA_SIZES }: { fileSizes?: Record<string, number> }) {
  return <RailPage sections={RAIL}><div className="data-page page-fade">
    <header className="data-intro" id="data-top">
      <p className="section-kicker">Open data</p>
      <h1 className="t-h1">Open data tables and data dictionary</h1>
      <p className="about-lead">Analytical tables are published as Parquet: typed, compressed and columnar. CSV copies are provided for spreadsheet programs.</p>
    </header>
    <PageGuide
      purpose="Download the public forecast, score, and revision tables as Parquet or CSV with column definitions."
      lookAt="Each file's column dictionary before loading it into an analysis script or spreadsheet."
      limit="Live model weights or private market series. Only public government data and the forecasts of the arena are included." />
    <section className="data-section" aria-labelledby="data-sizes">
      <h2 className="t-h3" id="data-sizes">File sizes</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Open data file sizes">
        <table className="data-dict-table">
          <caption className="sr-only">Parquet and CSV file sizes from the site build</caption>
          <thead><tr><th scope="col">Table</th><th scope="col">Parquet</th><th scope="col">CSV</th></tr></thead>
          <tbody>{OPEN_DATA_FILES.map((entry) => <tr key={entry.parquet}>
            <th scope="row">{entry.title}</th>
            <td className="mono">{formatFileSize(fileSizes[entry.parquet])}</td>
            <td className="mono">{formatFileSize(fileSizes[entry.file])}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="data-section" aria-labelledby="data-query">
      <h2 className="t-h3" id="data-query">Query it without downloading</h2>
      <p>DuckDB reads only the columns it needs directly over HTTPS, without downloading the rest of the file.</p>
      <pre className="data-code"><code>{DUCKDB_QUERY}</code></pre>
      <p>In Python with Polars on the same address:</p>
      <pre className="data-code"><code>{POLARS_QUERY}</code></pre>
    </section>
    {OPEN_DATA_FILES.map((entry) => {
      const id = sectionId(entry.parquet);
      return <section className="data-section" key={entry.parquet} aria-labelledby={id}>
        <h2 className="t-h3" id={id}>{entry.title}</h2>
        <p>{entry.description}</p>
        <div className="data-downloads">
          <a className="data-download" href={`data/${entry.parquet}`} download={entry.parquet}>
            <span>Download {entry.parquet}</span>
            <span className="data-format-note">Recommended for analysis</span>
          </a>
          <a className="data-download data-download-secondary" href={`data/${entry.file}`} download={entry.file}>
            <span>Download {entry.file}</span>
            <span className="data-format-note">For spreadsheets</span>
          </a>
        </div>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`${entry.title} columns`}>
          <table className="data-dict-table">
            <caption className="sr-only">{entry.title} column dictionary</caption>
            <thead><tr><th scope="col">Column</th><th scope="col">Meaning</th></tr></thead>
            <tbody>{entry.columns.map((column) => <tr key={column.name}>
              <th scope="row" className="mono">{column.name}</th>
              <td>{column.meaning}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>;
    })}
    <section className="data-section" aria-labelledby="data-notes">
      <h2 className="t-h3" id="data-notes">Units, sources, and terms of use</h2>
      <p>
        Units follow each series: the arena files express GDP growth in annualized percent q/q, CPI inflation in percent m/m,
        payrolls in thousands of jobs, and forecast errors or accuracy scores in percentage points or thousands of jobs,
        while revisions.parquet and revisions.csv use % m/m for CPI, jobs for Jobs, and % annualized for GDP.
      </p>
      <p>
        Results are preliminary. No file ranks the contestants.
      </p>
      <p className="muted">
        Data sources: <ExternalLink href="https://alfred.stlouisfed.org/">ALFRED</ExternalLink> and{" "}
        <ExternalLink href="https://fred.stlouisfed.org/">FRED</ExternalLink> of the Federal Reserve Bank of St. Louis,
        and the Survey of Professional Forecasters (SPF) of the Federal Reserve Bank of Philadelphia.
        Used for non-commercial education and research. This site is independent and is not endorsed or certified
        by the Federal Reserve Bank of St. Louis or the Federal Reserve Bank of Philadelphia.
      </p>
    </section>
  </div></RailPage>;
}
