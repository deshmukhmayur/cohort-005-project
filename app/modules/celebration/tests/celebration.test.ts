import { describe, expect, it } from "vitest";
import {
  isCelebrating,
  welcomePathWithCelebration,
  withoutCelebration,
} from "../index";

describe("celebration", () => {
  it("builds the welcome path with the flag", () => {
    expect(welcomePathWithCelebration("abc")).toBe(
      "/courses/abc/welcome?celebrate=1"
    );
  });

  it("detects the flag only when it is 1", () => {
    expect(isCelebrating({ search: "?celebrate=1" })).toBe(true);
    expect(isCelebrating({ search: "?celebrate=0" })).toBe(false);
    expect(isCelebrating({ search: "" })).toBe(false);
  });

  it("removes only the flag", () => {
    expect(
      withoutCelebration({ pathname: "/w", search: "?celebrate=1", hash: "" })
    ).toBe("/w");
    expect(
      withoutCelebration({
        pathname: "/w",
        search: "?a=b&celebrate=1",
        hash: "#h",
      })
    ).toBe("/w?a=b#h");
  });
});
