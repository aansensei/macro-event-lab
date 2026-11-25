// the blocks of every page that fade up when they scroll into view: sections, figures and cards
export const REVEAL_SELECTOR = [
  ".about-section", ".arena-section", ".data-section", ".status-section", ".reactions-section", ".play-section",
  ".briefing-section", ".chart-figure", ".method-figure", ".rev-figure", ".lineage-figure", ".note-art",
  ".headline-card", ".note-card", ".briefing-card", ".score-card", ".live-proof", ".release-file",
  ".public-findings", ".public-explore", ".public-next-releases", ".journal-trouble", ".journal-entry",
].join(", ");

const REVEAL_MS = 1000;

// blocks that appear in the same moment follow each other by a short delay, five steps at most
export function revealDelay(index: number): number {
  return Math.min(Math.max(index, 0), 4) * 70;
}

// marks every matching block as waiting, shows it when it enters the screen and then clears the mark so that hover
// effects work as usual; blocks added later, such as the ones that appear after data loads, are picked up as well.
// Without an IntersectionObserver nothing is hidden. Returns the function that stops it.
export function armReveal(root: HTMLElement, Observer: typeof IntersectionObserver | undefined): () => void {
  if (!Observer) return () => {};
  const seen = new WeakSet<Element>();
  const timers = new Set<number>();
  const observer = new Observer(
    (entries) => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const block = entry.target as HTMLElement;
        observer.unobserve(block);
        block.style.setProperty("--reveal-delay", `${revealDelay(index++)}ms`);
        block.dataset.reveal = "in";
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          delete block.dataset.reveal;
          block.style.removeProperty("--reveal-delay");
        }, REVEAL_MS);
        timers.add(timer);
      }
    },
    { rootMargin: "0px 0px -6% 0px" },
  );
  const arm = () => {
    for (const block of root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
      if (seen.has(block)) continue;
      seen.add(block);
      block.dataset.reveal = "pending";
      observer.observe(block);
    }
  };
  const mutations = new MutationObserver(arm);
  mutations.observe(root, { childList: true, subtree: true });
  arm();
  return () => {
    mutations.disconnect();
    observer.disconnect();
    for (const timer of timers) window.clearTimeout(timer);
  };
}
