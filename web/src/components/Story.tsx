import type { Page } from "../lib/url";
import { STORY, nextStop, storyHref, storyIndex } from "../lib/story";

// the four story pages as a numbered path, with the current one marked, so a reader sees where this page fits
export function StoryPath({ current }: { current: Page }) {
  const at = storyIndex(current);
  if (at < 0) return null;
  return (
    <nav className="story-path" aria-label={`The site's story, step ${at + 1} of ${STORY.length}`}>
      <ol>
        {STORY.map((s, i) => (
          <li key={s.page} className={i < at ? "is-done" : i === at ? "is-current" : ""}>
            <a href={storyHref(s.page)} aria-current={i === at ? "step" : undefined}>
              <span className="story-num" aria-hidden="true">{i + 1}</span>
              <span className="story-text">
                <span className="story-label">{s.label}</span>
                <span className="story-question">{s.question}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// the end of a story page: one sentence on why to go on, and the page that comes next
export function StoryNext({ current }: { current: Page }) {
  const step = STORY[storyIndex(current)];
  const next = nextStop(current);
  if (!step || !next) return null;
  return (
    <aside className="story-next" aria-label="Next in the story">
      <p>{step.lead}</p>
      <a className="story-next-link" href={next.href}>
        <span className="story-next-kicker">Next</span>
        <span className="story-next-label">{next.label}</span>
        <span className="story-next-question">{next.question}</span>
        <span className="story-next-arrow" aria-hidden="true" />
      </a>
    </aside>
  );
}
