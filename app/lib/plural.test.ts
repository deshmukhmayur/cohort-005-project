import { describe, expect, it } from "vitest";
import { countOf } from "./plural";

describe("countOf", () => {
  it("keeps the noun singular for exactly one", () => {
    expect(countOf(1, "lesson")).toBe("1 lesson");
  });

  it("adds an s for zero and for more than one", () => {
    expect(countOf(0, "lesson")).toBe("0 lessons");
    expect(countOf(12, "course")).toBe("12 courses");
  });

  it("uses the plural it is given", () => {
    expect(countOf(2, "category", "categories")).toBe("2 categories");
    expect(countOf(1, "category", "categories")).toBe("1 category");
  });
});
