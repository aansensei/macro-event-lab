import { Icon } from "./Icon";

export function StatusBadge({ label, tone }: { label: string; tone: "pass" | "warn" | "fail" }) {
  return <span className={`status-badge status-badge-${tone}`}>
    <Icon name={tone === "pass" ? "circle-check" : tone === "warn" ? "circle-alert" : "circle-x"} size={14} />{label}
  </span>;
}
