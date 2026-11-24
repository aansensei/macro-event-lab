import type { ReactNode } from "react";

// a collapsed note under a graph or table that explains what each mark means and what the picture does not show
export function HowToRead({ subject = "chart", children }: { subject?: "chart" | "table"; children: ReactNode }) {
  return <details className="how-to-read">
    <summary>How to read this {subject}</summary>
    {children}
  </details>;
}
