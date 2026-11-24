// three plain answers at the top of a page: what it is for, what to look at first, and what it cannot show
export function PageGuide({ purpose, lookAt, limit }: { purpose: string; lookAt: string; limit: string }) {
  return <dl className="page-guide" aria-label="About this page">
    <div><dt>What this page is for</dt><dd>{purpose}</dd></div>
    <div><dt>Look at first</dt><dd>{lookAt}</dd></div>
    <div><dt>What it cannot show</dt><dd>{limit}</dd></div>
  </dl>;
}
