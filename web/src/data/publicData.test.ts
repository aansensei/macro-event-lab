import { expect, it } from "vitest";

import { arrayValue, countValue, dateValue, objectValue, textValue, uniqueValues } from "./publicData";

it("accepts only the requested JSON shape and scalar types", () => {
  expect(objectValue({ value: 0 }, "Fixture")).toEqual({ value: 0 });
  expect(arrayValue([], "Fixture")).toEqual([]);
  expect(textValue("Fixture", "Label")).toBe("Fixture");
  expect(countValue(0, "Count")).toBe(0);
  for (const value of [null, [], 1]) expect(() => objectValue(value, "Fixture")).toThrow();
  expect(() => arrayValue({}, "Fixture")).toThrow();
  for (const value of ["", " ", null]) expect(() => textValue(value, "Label")).toThrow();
  for (const value of [NaN, Infinity, -1, 0.5, "1", 2 ** 54]) expect(() => countValue(value, "Count")).toThrow();
});

it("validates calendar dates instead of accepting JavaScript rollover", () => {
  expect(dateValue("2024-02-29", "Date")).toBe("2024-02-29");
  for (const value of ["2025-02-29", "2024-04-31", "0000-01-01", "2025-13-01", "2025-1-01", "invalid"]) {
    expect(() => dateValue(value, "Date")).toThrow();
  }
  expect(uniqueValues(["a", "b"], "IDs")).toBeUndefined();
  expect(() => uniqueValues(["a", "a"], "IDs")).toThrow("duplicate");
});
