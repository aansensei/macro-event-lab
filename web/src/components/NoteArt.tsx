// an editorial illustration for the notes, drawn with the site colours: bars of first prints for the jobs notes, a
// shopping basket for the inflation notes and a calendar, a sealed envelope and a notepad for the index and any other
// note; each has a pencil and a figure with a magnifying glass studying what has not been published yet
export function NoteArt({ caption, target }: { caption?: string; target?: string }) {
  return (
    <figure className="note-art">
      <svg viewBox="0 0 800 290" className="note-art-svg" aria-hidden="true" focusable="false">
        {target === "cpi" ? <BasketScene /> : target === "payrolls" ? <BarsScene /> : <DeskScene />}
      </svg>
      {caption ? <figcaption className="note-art-caption mono">{caption}</figcaption> : null}
    </figure>
  );
}

function BarsScene() {
  return (
    <>
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
    </>
  );
}

function BasketScene() {
  return (
    <>
      <line className="art-ground" x1="30" y1="250" x2="770" y2="250" />

      <path className="art-line" d="M285 150C305 50 495 50 515 150" />
      <ellipse className="art-item-warm" cx="335" cy="132" rx="46" ry="20" />
      <path className="art-line" d="M310 128l8 6M335 120l7 8M358 128l6 5" />
      <circle className="art-item-rose" cx="418" cy="126" r="22" />
      <path className="art-line" d="M418 104c0-8 4-12 9-14" />
      <rect className="art-item-paper" x="466" y="92" width="42" height="62" rx="4" />
      <path className="art-line" d="M466 108h42M476 92l8-10h16l8 10" />
      <path className="art-basket" d="M240 150h320l-34 100H274z" />
      <path className="art-line" d="M300 150l10 100M360 150l5 100M420 150v100M480 150l-5 100M540 150l-10 100" />

      <g transform="translate(130 150)">
        <path className="art-line" d="M104 4C112 0 118 -2 122 -2" />
        <path className="art-tag" d="M0 0h58l16 20-16 20H0z" />
        <circle className="art-line" cx="62" cy="20" r="2" />
        <path className="art-line" d="M10 14h30M10 26h22" />
      </g>
      <g transform="translate(144 166)">
        <path className="art-ghost" d="M0 0h58l16 20-16 20H0z" />
      </g>

      <g transform="translate(36 78) rotate(24)">
        <rect className="art-eraser" x="0" y="0" width="30" height="22" rx="4" />
        <rect className="art-pencil" x="30" y="0" width="140" height="22" />
        <path className="art-pencil-line" d="M30 7h140M30 15h140" />
        <path className="art-wood" d="M170 0l34 11-34 11z" />
        <path className="art-lead" d="M194 8l10 3-10 3z" />
      </g>
      <path className="art-scribble" d="M176 168c6-5 12 4 18-1s10 3 14-2" />

      <g transform="translate(610 140)">
        <path className="art-line" d="M-2 0v-20" />
        <path className="art-unknown" d="M0 0h58l16 20-16 20H0z" />
        <circle className="art-line" cx="62" cy="20" r="2" />
        <path className="art-line" d="M22 20c0-10 22-10 22 0 0 8-11 9-11 17m0 8v2" />
      </g>
      <g className="art-person" transform="translate(716 0)">
        <circle className="art-skin" cx="0" cy="206" r="9" />
        <path className="art-line" d="M0 215v22M0 237l-8 13M0 237l8 13M0 222l-18-6" />
        <circle className="art-lens" cx="-30" cy="211" r="12" />
        <path className="art-line" d="M-22 220l-4 5" />
      </g>
    </>
  );
}

function DeskScene() {
  return (
    <>
      <line className="art-ground" x1="30" y1="250" x2="770" y2="250" />

      <g transform="translate(70 62)">
        <rect className="art-sheet" x="0" y="0" width="210" height="188" rx="10" />
        <path className="art-head" d="M0 38V10a10 10 0 0 1 10-10h190a10 10 0 0 1 10 10v28z" />
        <path className="art-line" d="M50 -8v18M160 -8v18" />
        <circle className="art-dot" cx="38" cy="78" r="5" />
        <circle className="art-dot" cx="82" cy="78" r="5" />
        <circle className="art-dot" cx="126" cy="78" r="5" />
        <circle className="art-dot" cx="170" cy="78" r="5" />
        <circle className="art-dot" cx="38" cy="118" r="5" />
        <circle className="art-dot" cx="82" cy="118" r="5" />
        <circle className="art-dot" cx="126" cy="118" r="5" />
        <circle className="art-dot" cx="170" cy="118" r="5" />
        <circle className="art-dot" cx="38" cy="158" r="5" />
        <circle className="art-dot" cx="82" cy="158" r="5" />
        <circle className="art-ghost" cx="126" cy="118" r="17" />
      </g>

      <g transform="translate(330 150)">
        <rect className="art-sheet" x="0" y="0" width="160" height="100" rx="8" />
        <path className="art-line" d="M4 6l76 50 76-50" />
        <circle className="art-basket" cx="80" cy="56" r="14" />
        <path className="art-line" d="M80 50v7M80 62v1" />
      </g>

      <g transform="translate(556 150)">
        <rect className="art-sheet" x="0" y="0" width="134" height="100" rx="6" />
        <path className="art-line" d="M16 26h72M16 46h96M16 66h60" />
      </g>

      <g transform="translate(486 58) rotate(24)">
        <rect className="art-eraser" x="0" y="0" width="30" height="22" rx="4" />
        <rect className="art-pencil" x="30" y="0" width="140" height="22" />
        <path className="art-pencil-line" d="M30 7h140M30 15h140" />
        <path className="art-wood" d="M170 0l34 11-34 11z" />
        <path className="art-lead" d="M194 8l10 3-10 3z" />
      </g>

      <g className="art-person" transform="translate(738 0)">
        <circle className="art-skin" cx="0" cy="206" r="9" />
        <path className="art-line" d="M0 215v22M0 237l-8 13M0 237l8 13M0 222l-18-6" />
        <circle className="art-lens" cx="-30" cy="211" r="12" />
        <path className="art-line" d="M-22 220l-4 5" />
      </g>
    </>
  );
}
