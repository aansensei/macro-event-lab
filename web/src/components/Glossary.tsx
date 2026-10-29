import { useEffect } from "react";

import { GLOSSARY } from "../lib/glossary";

export function Glossary() {
  // a link such as ?page=glossary#sd lands on that entry once the page has rendered
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <article className="about-page page-fade">
      <h1 className="t-h1">Glossary</h1>
      <p className="about-lead">
        The words this site uses, in plain language. No economics background needed.
      </p>
      <dl className="glossary-list">
        {GLOSSARY.map((e) => (
          <div key={e.id} id={e.id} className="glossary-entry">
            <dt>{e.term}</dt>
            <dd>{e.long}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
