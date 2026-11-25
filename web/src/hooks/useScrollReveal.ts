import { useLayoutEffect, type RefObject } from "react";

import { armReveal } from "../lib/scrollReveal";

const REDUCED = "(prefers-reduced-motion: reduce)";

// fades the blocks inside the element up as they scroll into view; people who ask for less motion see everything at once
export function useScrollReveal(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia(REDUCED).matches) return;
    return armReveal(element, window.IntersectionObserver);
  }, [root]);
}
