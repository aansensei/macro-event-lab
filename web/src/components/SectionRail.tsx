import { useEffect, useState, type MouseEvent } from "react";

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

  useEffect(() => {
    function update() {
      const tops = sections.map((s) => document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity);
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
  }, [sections]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  return (
    <nav className="section-rail" aria-label="On this page">
      <ol>
        {sections.map((s, i) => (
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
