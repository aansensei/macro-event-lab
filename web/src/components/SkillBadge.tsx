export function SkillBadge({ skill }: { skill: number | null }) {
  if (skill === null) return <span className="verdict">No benchmark</span>;
  if (skill === 0) return <span className="verdict">Matches the naive guess</span>;
  const pct = Math.round(Math.abs(skill) * 100);
  return skill > 0
    ? <span className="verdict verdict-calibrated">Beats the naive guess by {pct}%</span>
    : <span className="verdict verdict-overconfident">{pct}% more error than naive</span>;
}
