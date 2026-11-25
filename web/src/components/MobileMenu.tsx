import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { menuGroups } from "../lib/menuGroups";
import { LEARN, PRIMARY } from "../lib/navigation";
import { pageSearch, type Page } from "../lib/url";
import { Icon } from "./Icon";
import { ThemeSwitch } from "./ThemeSwitch";

const DESKTOP_WIDTH = 800;

// bottom navigation sheet shown below 800 pixels wide
export function MobileMenu({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const groups = menuGroups(PRIMARY, LEARN);

  function closeMenu(restoreFocus: boolean) {
    document.documentElement.classList.remove("mobile-menu-open");
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("mobile-menu-open");
    sheetRef.current?.querySelector<HTMLElement>("a[aria-current], a, button")?.focus();

    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu(true);
    }

    function onResize() {
      if (window.innerWidth >= DESKTOP_WIDTH) closeMenu(false);
    }

    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.documentElement.classList.remove("mobile-menu-open");
    };
  }, [open]);

  // keeps Tab inside the open dialog
  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const items = [...(sheetRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (!sheetRef.current?.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="mobile-menu-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={18} />
        <span>Menu</span>
      </button>
      {open && (
        <div className="mobile-menu-layer">
          <div className="contents-backdrop" onClick={() => closeMenu(true)} />
          <div
            ref={sheetRef}
            className="contents-sheet mobile-menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onKeyDown={trapTab}
          >
            <div className="contents-head">
              <span className="contents-title" aria-hidden="true">Menu</span>
              <button
                type="button"
                className="contents-close"
                aria-label="Close menu"
                onClick={() => closeMenu(true)}
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="mobile-menu-body">
              {groups.map((group) => (
                <div key={group.title} className="mobile-menu-group">
                  <h2 className="mobile-menu-group-title">{group.title}</h2>
                  <ul className="contents-list mobile-menu-list">
                    {group.items.map((item) => (
                      <li key={item.page}>
                        <a
                          href={pageSearch(item.page)}
                          aria-current={page === item.page ? "page" : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            closeMenu(false);
                            onNavigate(item.page);
                          }}
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <section className="mobile-menu-theme" aria-labelledby="mobile-theme-title">
                <p id="mobile-theme-title" className="mobile-menu-group-title">Theme</p>
                <ThemeSwitch />
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
