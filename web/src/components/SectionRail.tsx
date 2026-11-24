import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { activeSection } from "../lib/rail";
import { Icon } from "./Icon";

export interface RailSection {
  id: string;
  label: string;
}

// the width at which the side rail replaces the pill and the sheet
const WIDE = 1180;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function glideTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

// wide screens: a column of dots beside a long page, one per section; the current one glows with its name,
// the others show theirs when the rail is hovered or focused, and a click glides to that section.
// phones and tablets: a floating pill with the position (1 / 7) that opens a sheet listing every section
export function SectionRail({ sections }: { sections: RailSection[] }) {
  const [active, setActive] = useState(0);
  const [present, setPresent] = useState(sections);
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

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

  // the floating back to top button moves down to the pill's line while a pill is on the page
  const hasPill = present.length > 1;
  useEffect(() => {
    document.body.classList.toggle("has-contents-pill", hasPill);
    return () => document.body.classList.remove("has-contents-pill");
  }, [hasPill]);

  function closeSheet(restoreFocus: boolean) {
    document.documentElement.classList.remove("contents-open");
    setOpen(false);
    if (restoreFocus) pillRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("contents-open");
    sheetRef.current?.querySelector<HTMLElement>("a[aria-current], a")?.focus();
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeSheet(true);
    }
    // the sheet is hidden from 1180 pixels up, so a window that grows past that closes it and frees the page scroll
    function onResize() {
      if (window.innerWidth >= WIDE) closeSheet(false);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("contents-open");
    };
  }, [open]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string, fromSheet = false) {
    e.preventDefault();
    if (fromSheet) closeSheet(false);
    glideTo(id);
  }

  // keeps Tab inside the open sheet
  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const items = [...(sheetRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <>
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
      {present.length > 1 && (
        <>
          <button ref={pillRef} type="button" className="contents-pill" aria-haspopup="dialog" aria-expanded={open}
            onClick={() => setOpen(true)}>
            <Icon name="list" size={20} />
            <span className="contents-pill-count num" aria-hidden="true">{Math.max(active, 0) + 1} / {present.length}</span>
            <span className="sr-only">Contents, section {Math.max(active, 0) + 1} of {present.length}</span>
          </button>
          {open && (
            <div className="contents-layer">
              <div className="contents-backdrop" onClick={() => closeSheet(true)} />
              <div ref={sheetRef} className="contents-sheet" role="dialog" aria-modal="true" aria-labelledby="contents-title"
                onKeyDown={trapTab}>
                <div className="contents-head">
                  <h2 id="contents-title" className="contents-title">Contents</h2>
                  <button type="button" className="contents-close" aria-label="Close contents" onClick={() => closeSheet(true)}>
                    <Icon name="x" size={20} />
                  </button>
                </div>
                <ol className="contents-list">
                  {present.map((s, i) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} aria-current={i === active ? "location" : undefined} onClick={(e) => go(e, s.id, true)}>
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// the page with its contents rail beside it from 1180 pixels wide
export function RailPage({ sections, children }: { sections: RailSection[]; children: ReactNode }) {
  return <div className="with-rail"><SectionRail sections={sections} />{children}</div>;
}
