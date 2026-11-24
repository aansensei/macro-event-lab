import type { ReactNode } from "react";

export type IconName =
  | "sun" | "moon" | "monitor" | "chevron-down" | "arrow-up" | "arrow-right" | "arrow-up-right"
  | "check" | "circle-check" | "circle-alert" | "circle-x";

const SHAPES: Record<IconName, ReactNode> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.2A8.5 8.5 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2.5" /><path d="M8.5 20h7M12 16v4" /></>,
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  "arrow-up": <path d="M12 19V5m-6 6 6-6 6 6" />,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M8.5 7H17v8.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  "circle-check": <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.7" /></>,
  "circle-alert": <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16.2h.01" /></>,
  "circle-x": <><circle cx="12" cy="12" r="9" /><path d="m9.2 9.2 5.6 5.6m0-5.6-5.6 5.6" /></>,
};

// one small set of rounded line icons on a 24 unit grid, drawn in the current text color
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{SHAPES[name]}</svg>;
}
