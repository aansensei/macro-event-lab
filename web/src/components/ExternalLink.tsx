import type { ReactNode } from "react";

// a link that leaves the site: it opens in a new tab, gives the new page no access back, and says so to screen readers
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
