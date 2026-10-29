// Keyboard rules for the designed dropdown, kept pure so they can be tested.

// the option index after a key, or null when the key does not move the highlight
export function moveIndex(key: string, current: number, count: number, page = 8): number | null {
  if (count === 0) return null;
  const last = count - 1;
  switch (key) {
    case "ArrowDown":
      return Math.min(last, current + 1);
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return last;
    case "PageDown":
      return Math.min(last, current + page);
    case "PageUp":
      return Math.max(0, current - page);
    default:
      return null;
  }
}

// first option after `from` whose label starts with the typed text, wrapping around; -1 when none
export function typeaheadIndex(labels: string[], query: string, from: number): number {
  const q = query.toLowerCase();
  if (!q) return -1;
  for (let step = 1; step <= labels.length; step++) {
    const i = (from + step) % labels.length;
    if (labels[i]?.toLowerCase().startsWith(q)) return i;
  }
  return -1;
}
