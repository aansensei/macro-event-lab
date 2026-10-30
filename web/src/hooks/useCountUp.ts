import { useEffect, useRef, useState } from "react";

import { easeOutCubic } from "../lib/tween";

const DURATION_MS = 700;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// counts up from 0 to `target` when first shown, and glides from the shown value when the target changes
export function useCountUp(target: number): number {
  const [shown, setShown] = useState(() => (reducedMotion() ? target : 0));
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = easeOutCubic((now - start) / DURATION_MS);
      const next = from + (target - from) * t;
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // a paused page (background tab, print) never runs frames; the final value still lands
    const settle = window.setTimeout(() => {
      shownRef.current = target;
      setShown(target);
    }, DURATION_MS + 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [target]);

  return shown;
}
