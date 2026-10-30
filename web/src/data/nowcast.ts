export interface NowcastPoint {
  reference_period: string; release_date: string; as_of: string;
  first_print: number; previous_print: number | null; nowcast: number;
}
export interface Nowcast {
  source: "ALFRED"; schema_version: number; points: NowcastPoint[];
  coefficients: { feature: string; coef: number; lo: number; hi: number }[];
}

export function parseNowcast(value: unknown): Nowcast {
  const o = value as Nowcast;
  if (!o || o.source !== "ALFRED" || o.schema_version !== 1 || !Array.isArray(o.points)
    || !Array.isArray(o.coefficients)) throw new Error("Unsupported nowcast data");
  const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(v));
  if (o.points.some((p) => !p || !date(p.reference_period) || !date(p.as_of) || !date(p.release_date)
    || p.as_of >= p.release_date || !number(p.first_print) || !number(p.nowcast)
    || (p.previous_print !== null && !number(p.previous_print)))) throw new Error("Invalid nowcast point");
  if (o.coefficients.some((c) => !c || typeof c.feature !== "string"
    || ![c.coef, c.lo, c.hi].every(number) || c.lo > c.hi)) throw new Error("Invalid coefficient");
  return { ...o, points: [...o.points].sort((a, b) => a.reference_period.localeCompare(b.reference_period)) };
}

export async function loadNowcast(fetchImpl: typeof fetch = fetch): Promise<Nowcast> {
  const response = await fetchImpl(`${import.meta.env.BASE_URL}data/nowcast.json`);
  if (!response.ok) throw new Error(`Could not load nowcast (HTTP ${response.status})`);
  return parseNowcast(await response.json());
}

export function nowcastErrors(points: NowcastPoint[]) {
  const paired = points.filter((p) => p.previous_print !== null);
  if (!paired.length) return null;
  const rmse = (key: "nowcast" | "previous_print") => Math.sqrt(
    paired.reduce((sum, p) => sum + ((p[key] as number) - p.first_print) ** 2, 0) / paired.length,
  );
  return { n: paired.length, model: rmse("nowcast"), naive: rmse("previous_print") };
}
