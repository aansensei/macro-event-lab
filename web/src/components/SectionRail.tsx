import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { activeSection } from "../lib/rail";

export interface RailSection {
  id: string;
  label: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// a column of dots beside a long page, one per section: the current one glows with its name,
// the others show theirs when the rail is hovered or focused, and a click glides to that section
export function SectionRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);
  const [present, setPresent] = useState(sections);

  // a page may list sections that only exist once its data has loaded, so the rail keeps the ones on screen
  useEffect(() => {
    const found = sections.filter((s) => document.getElementById(s.id));
    setPresent((current) => (current.map((s) => s.id).join() === found.map((s) => s.id).join() ? current : found));
  });

  useEffect(() => {
    function update() {
      const tops = present.map((s) => document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActive(activeSection(tops, window.innerHeight, atBottom));
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [present]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return (
    <nav className="section-rail" aria-label="On this page">
      <ol>
        {present.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={i === active ? "location" : undefined} onClick={(e) => go(e, s.id)}>
              <span className="rail-dot" aria-hidden="true" />
              <span className="rail-label">{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// the page with its contents rail beside it from 1180 pixels wide
export function RailPage({ sections, children }: { sections: RailSection[]; children: ReactNode }) {
  return <div className="with-rail"><SectionRail sections={sections} />{children}</div>;
}
