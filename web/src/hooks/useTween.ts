import { useEffect, useRef, useState } from "react";

import { easeOutCubic, lerpArrays } from "../lib/tween";

const DURATION_MS = 220;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// glides from the values on screen to new targets; a new `shape` key (other bins, another event) jumps instead
export function useTween(target: number[], shape: string): number[] {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const shapeRef = useRef(shape);
  const targetKey = target.join(",");

  useEffect(() => {
    const goal = targetKey === "" ? [] : targetKey.split(",").map(Number);
    if (shape !== shapeRef.current || reducedMotion()) {
      shapeRef.current = shape;
      shownRef.current = goal;
      setShown(goal);
      return;
    }
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const next = lerpArrays(from, goal, easeOutCubic((now - start) / DURATION_MS));
      shownRef.current = next;
      setShown(next);
      if (now - start < DURATION_MS) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [targetKey, shape]);

  return shape === shapeRef.current ? shown : target;
}
