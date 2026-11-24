export function objectValue(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where}: expected an object.`);
  }
  return value as Record<string, unknown>;
}

export function arrayValue(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${where}: expected an array.`);
  return value;
}

export function textValue(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${where}: expected nonempty text.`);
  }
  return value;
}

export function dateValue(value: unknown, where: string): string {
  const text = textValue(value, where);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text.startsWith("0000")
    || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${where}: expected a real calendar date in YYYY-MM-DD format.`);
  }
  return text;
}

export function countValue(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${where}: expected a nonnegative whole count.`);
  }
  return value;
}

export function uniqueValues(values: string[], where: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${where}: duplicate identifiers.`);
}

export async function fetchPublicJson(
  name: string, missingMessage: string, fetchImpl: typeof fetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${import.meta.env.BASE_URL}data/${name}.json`);
  } catch {
    throw new Error("The data file could not be reached. Check your connection and try again.");
  }
  if (response.status === 404) throw new Error(missingMessage);
  if (!response.ok) throw new Error(`The data request failed (HTTP ${response.status}). Try again.`);
  try {
    return await response.json();
  } catch {
    throw new Error("The data file is not valid JSON. Try again after the next build.");
  }
}
