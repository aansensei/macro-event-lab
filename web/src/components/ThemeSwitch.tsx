import { useThemePref } from "../lib/theme";
import { Icon } from "./Icon";

// system follows the operating system and keeps following it while the page is open
export function ThemeSwitch() {
  const [pref, choose] = useThemePref();

  return (
    <div className="theme-group" role="group" aria-label="Color theme">
      {(["system", "light", "dark"] as const).map((p) => (
        <button
          key={p}
          type="button"
          className="theme-btn"
          aria-label={p === "system" ? "Match the device" : p === "light" ? "Light" : "Dark"}
          title={p === "system" ? "Match the device" : p === "light" ? "Light" : "Dark"}
          aria-pressed={pref === p}
          onClick={() => choose(p)}
        >
          <Icon name={p === "system" ? "monitor" : p === "light" ? "sun" : "moon"} size={18} />
        </button>
      ))}
    </div>
  );
}
