// an editorial illustration for the notes: bars of first prints, a pencil editing one of them, and a figure
// with a magnifying glass studying the bar that has not been published yet; colours come from the site tokens
export function NoteArt({ caption }: { caption?: string }) {
  return (
    <figure className="note-art">
      <svg viewBox="0 0 800 290" className="note-art-svg" aria-hidden="true" focusable="false">
        <line className="art-ground" x1="30" y1="250" x2="770" y2="250" />

        <rect className="art-bar" x="80" y="160" width="56" height="90" rx="6" />
        <rect className="art-bar" x="170" y="110" width="56" height="140" rx="6" />
        <rect className="art-bar" x="260" y="190" width="56" height="60" rx="6" />
        <rect className="art-bar" x="350" y="100" width="56" height="150" rx="6" />
        <rect className="art-bar" x="440" y="140" width="56" height="110" rx="6" />
        <rect className="art-bar" x="530" y="120" width="56" height="130" rx="6" />
        <rect className="art-ghost" x="440" y="112" width="56" height="28" rx="6" />
        <rect className="art-unknown" x="620" y="130" width="56" height="120" rx="6" />
        <path className="art-line" d="M638 176c0-14 28-14 28 0 0 10-14 12-14 24m0 14v2" />

        <g className="art-person" transform="translate(198 0)">
          <circle className="art-skin" cx="0" cy="80" r="9" />
          <path className="art-line" d="M0 89v18M0 107l-8 3M0 107l8 3M0 94l-12 7M0 94l12-8" />
        </g>
        <g className="art-person" transform="translate(300 0)">
          <circle className="art-skin" cx="0" cy="170" r="9" />
          <path className="art-line" d="M0 179v16M0 195l-7 5M0 195l7 5M0 184l-11 4M0 184l11 4" />
        </g>

        <g transform="translate(330 38) rotate(24)">
          <rect className="art-eraser" x="0" y="0" width="30" height="22" rx="4" />
          <rect className="art-pencil" x="30" y="0" width="140" height="22" />
          <path className="art-pencil-line" d="M30 7h140M30 15h140" />
          <path className="art-wood" d="M170 0l34 11-34 11z" />
          <path className="art-lead" d="M194 8l10 3-10 3z" />
        </g>
        <path className="art-scribble" d="M462 134c6-5 12 4 18-1s10 3 14-2" />

        <g className="art-person" transform="translate(716 0)">
          <circle className="art-skin" cx="0" cy="206" r="9" />
          <path className="art-line" d="M0 215v22M0 237l-8 13M0 237l8 13M0 222l-18-6" />
          <circle className="art-lens" cx="-30" cy="211" r="12" />
          <path className="art-line" d="M-22 220l-4 5" />
        </g>
      </svg>
      {caption ? <figcaption className="note-art-caption mono">{caption}</figcaption> : null}
    </figure>
  );
}
