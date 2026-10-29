// Which section the reader is in, for the dot contents rail beside long pages.

// a section counts as current once its top has passed this share of the window height
export const READ_LINE = 0.35;

// index of the current section from each section's top edge relative to the window: the last one
// whose top is above the read line, the first one before any has passed it, and the last one when
// the page is scrolled to the bottom (a short final section may never reach the line)
export function activeSection(tops: number[], viewportHeight: number, atBottom: boolean): number {
  if (tops.length === 0) return -1;
  if (atBottom) return tops.length - 1;
  let current = 0;
  tops.forEach((top, i) => {
    if (top <= viewportHeight * READ_LINE) current = i;
  });
  return current;
}
