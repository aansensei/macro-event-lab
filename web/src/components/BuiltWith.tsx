import { useLayoutEffect, useRef, useState } from "react";

import type { IconName } from "./Icon";
import { Icon } from "./Icon";

type Tool = { name: string; role: string };

// the tools of the project in four short cards, each with its own line icon; names only, no versions
const GROUPS: { icon: IconName; title: string; note: string; live?: boolean; items: Tool[] }[] = [
  {
    icon: "code",
    title: "Data",
    note: "pipeline",
    items: [
      { name: "Python", role: "pipeline" },
      { name: "Polars", role: "tables" },
      { name: "DuckDB", role: "queries" },
      { name: "Parquet", role: "storage" },
      { name: "NumPy", role: "numbers" },
      { name: "httpx", role: "downloads" },
    ],
  },
  {
    icon: "globe",
    title: "Website",
    note: "browser",
    items: [
      { name: "React 19", role: "pages" },
      { name: "TypeScript", role: "types" },
      { name: "Vite", role: "build" },
      { name: "Charts", role: "plain SVG" },
      { name: "Chart library", role: "none" },
    ],
  },
  {
    icon: "check",
    title: "Checks",
    note: "every push",
    items: [
      { name: "pytest", role: "pipeline tests" },
      { name: "Hypothesis", role: "property tests" },
      { name: "Vitest", role: "site tests" },
      { name: "ruff", role: "lint" },
      { name: "40 claims", role: "one command" },
    ],
  },
  {
    icon: "arrow-up-right",
    title: "Deploy",
    note: "daily",
    live: true,
    items: [
      { name: "GitHub Actions", role: "daily build" },
      { name: "GitHub Pages", role: "hosting" },
      { name: "Docker", role: "claim checks" },
    ],
  },
];

// each card fades up when it scrolls into view, one after the other; without IntersectionObserver the cards simply stay visible
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".built-card"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    setArmed(true);
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, []);
  return { ref, armed };
}

// a compact grid of four cards that says what the project is built with, what checks it and where it runs
export function BuiltWith() {
  const { ref, armed } = useRevealOnScroll();
  return (
    <div ref={ref} className={armed ? "built-with is-armed" : "built-with"}>
      {GROUPS.map((group, index) => (
        <section key={group.title} className="built-card" aria-label={group.title} style={{ "--i": index } as React.CSSProperties}>
          <header className="built-card-head">
            <span className="built-card-icon" aria-hidden="true"><Icon name={group.icon} size={16} /></span>
            <h3 className="built-card-title">{group.title}</h3>
            <span className="built-card-note mono">
              {group.live ? <span className="built-live" aria-hidden="true" /> : null}
              {group.note}
            </span>
          </header>
          <ul className="built-card-list">
            {group.items.map((item, row) => (
              <li key={item.name} style={{ "--r": row } as React.CSSProperties}>
                <span className="built-tool">{item.name}</span>
                <span className="built-role mono">{item.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
