import { useEffect } from "react";

import { PUBLIC_EDITION } from "../lib/edition";
import { glossaryGroupsFor, glossaryEntryFor } from "../lib/glossaryEdition";
import { SectionRail, type RailSection } from "../components/SectionRail";

const GROUPS = glossaryGroupsFor(PUBLIC_EDITION);
const RAIL: RailSection[] = [
  { id: "glossary-top", label: "Top" },
  ...GROUPS.map((g) => ({ id: g.id, label: g.title })),
];

export function Glossary() {
  // a link such as ?page=glossary#sd lands on that entry once the page has rendered
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div className="with-rail">
      <SectionRail sections={RAIL} />
      <article className="about-page page-fade">
        <h1 className="t-h1 rail-target" id="glossary-top">Glossary</h1>
        <p className="about-lead">
          The words this site uses, in plain language. No economics background needed.
        </p>
        {GROUPS.map((g) => (
          <section key={g.id} className="glossary-group rail-target" id={g.id} aria-labelledby={`${g.id}-title`}>
            <h2 className="section-kicker" id={`${g.id}-title`}>{g.title}</h2>
            <dl className="glossary-list">
              {g.ids.map((id) => {
                const e = glossaryEntryFor(id, PUBLIC_EDITION);
                return e ? (
                  <div key={e.id} id={e.id} className="glossary-entry">
                    <dt>{e.term}</dt>
                    <dd>{e.long}</dd>
                  </div>
                ) : null;
              })}
            </dl>
          </section>
        ))}
      </article>
    </div>
  );
}
