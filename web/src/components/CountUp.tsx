import { useCountUp } from "./useCountUp";

interface Props {
  value: number;
  format: (v: number) => string;
}

// a number that counts up to its value; screen readers get the final value straight away
export function CountUp({ value, format }: Props) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
