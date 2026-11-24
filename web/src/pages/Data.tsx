import { ExternalLink } from "../components/ExternalLink";
import { PageGuide } from "../components/PageGuide";
import { RailPage, type RailSection } from "../components/SectionRail";
import { OPEN_DATA_FILES } from "../lib/openData";

function sectionId(file: string): string {
  return `data-${file.replace(/\.csv$/, "").replace(/_/g, "-")}`;
}

const RAIL: RailSection[] = [
  { id: "data-top", label: "Top" },
  ...OPEN_DATA_FILES.map((entry) => ({ id: sectionId(entry.file), label: entry.title })),
  { id: "data-notes", label: "Units and sources" },
];

export function Data() {
  return <RailPage sections={RAIL}><div className="data-page page-fade">
    <header className="data-intro" id="data-top">
      <p className="section-kicker">Open data</p>
      <h1 className="t-h1">Downloadable CSV tables and data dictionary</h1>
      <p className="about-lead">Tidy tables built daily with the site for analysts, teachers, and students to download and inspect directly.</p>
    </header>
    <PageGuide
      purpose="Download the public forecast, score, and revision tables in plain CSV format with column definitions."
      lookAt="Each file's column dictionary before loading it into a spreadsheet or analysis script."
      limit="Live model weights or private market series. Only public government data and recorded forecasts are included." />
    {OPEN_DATA_FILES.map((entry) => {
      const id = sectionId(entry.file);
      return <section className="data-section" key={entry.file} aria-labelledby={id}>
        <h2 className="t-h3" id={id}>{entry.title}</h2>
        <p>{entry.description}</p>
        <p><a className="data-download" href={`data/${entry.file}`} download={entry.file}>Download {entry.file}</a></p>
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
        while revisions.csv uses % m/m for CPI, jobs for Jobs, and % annualized for GDP.
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
