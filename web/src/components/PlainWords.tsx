import type { EventFile, SurvivalPoint } from "../data/types";
import { plainWords } from "../lib/plainWords";
import type { EventStatus } from "../lib/snapshots";
import { pageSearch } from "../lib/url";

interface Props {
  event: EventFile;
  status: EventStatus;
  expectedMedian: number | null;
  survival: SurvivalPoint[] | null;
}

// the event read out in plain English, from its numbers and how it compares with its series
export function PlainWords({ event, status, expectedMedian, survival }: Props) {
  const paragraphs = plainWords(event, status, expectedMedian, survival);
  return (
    <section className="plain-words" aria-labelledby="plain-words-title">
      <h2 className="section-kicker" id="plain-words-title">In plain words</h2>
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <a className="plain-words-link" href={pageSearch("glossary")}>New to these terms? See the glossary</a>
    </section>
  );
}
