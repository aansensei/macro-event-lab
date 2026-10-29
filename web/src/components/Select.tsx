import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { moveIndex, typeaheadIndex } from "../lib/listbox";

export interface SelectOption {
  value: string;
  label: string;
  // shown on the right of the option, such as a badge
  meta?: ReactNode;
}

interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  // which edge the open list lines up with
  align?: "start" | "end";
}

const TYPEAHEAD_RESET_MS = 600;

// a designed dropdown: a button that opens a listbox, with arrow keys, Home and End, type-ahead, Enter and Escape
export function Select({ label, value, options, onChange, align = "start" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  // a press anywhere outside closes the list
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // opening focuses the list on the current choice; the highlighted option stays in view
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  function openList() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    const moved = moveIndex(e.key, active, options.length);
    if (moved !== null) {
      e.preventDefault();
      setActive(moved);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > TYPEAHEAD_RESET_MS ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const found = typeaheadIndex(options.map((o) => o.label), typed.current.text, active - 1);
      if (found >= 0) setActive(found);
    }
  }

  return (
    <div className="select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKey}
      >
        <span className="select-value">{selected?.label}</span>
        <svg className="select-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          className={`select-list select-${align}`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              className={`select-option${i === active ? " is-active" : ""}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span className="select-check" aria-hidden="true">{i === selectedIndex ? "✓" : ""}</span>
              <span className="select-option-label">{o.label}</span>
              {o.meta && <span className="select-option-meta">{o.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
