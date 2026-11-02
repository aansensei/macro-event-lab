export function ResourceError({ title, message, onRetry, heading: Heading = "h2" }: {
  title: string; message: string; onRetry: () => void; heading?: "h1" | "h2";
}) {
  return <div className="state-banner" role="alert" aria-label={title}>
    <Heading className="t-h3">{title}</Heading>
    <p>{message}</p>
    <button type="button" className="play-btn" onClick={(event) => {
      event.currentTarget.closest<HTMLElement>("main")?.focus({ preventScroll: true });
      onRetry();
    }}>Try again</button>
  </div>;
}
