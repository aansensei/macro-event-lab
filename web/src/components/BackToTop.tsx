import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const SHOW_AFTER_PX = 600;

// a round button that appears after scrolling down and glides back to the top
export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toTop() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    document.getElementById("app-main")?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      className={`back-to-top${shown ? " is-shown" : ""}`}
      aria-label="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={toTop}
    >
      <Icon name="arrow-up" size={18} />
    </button>
  );
}
