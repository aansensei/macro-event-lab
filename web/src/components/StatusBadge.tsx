export function StatusBadge({ label, tone }: { label: string; tone: "pass" | "warn" | "fail" }) {
  return <span className={`status-badge status-badge-${tone}`}>
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      {tone === "pass" ? <path d="m3 8 3 3 7-7" /> : tone === "warn"
        ? <><path d="M8 2 15 14H1Z" /><path d="M8 6v4m0 1v1" /></>
        : <path d="m4 4 8 8M12 4l-8 8" />}
    </svg>{label}
  </span>;
}
