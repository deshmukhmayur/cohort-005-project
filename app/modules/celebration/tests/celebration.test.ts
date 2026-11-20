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
    expect(isCelebrating(new URL("http://x/w?celebrate=1"))).toBe(true);
    expect(isCelebrating(new URL("http://x/w?celebrate=0"))).toBe(false);
    expect(isCelebrating(new URL("http://x/w"))).toBe(false);
  });

  it("removes only the flag", () => {
    expect(withoutCelebration(new URL("http://x/w?celebrate=1"))).toBe("/w");
    expect(withoutCelebration(new URL("http://x/w?a=b&celebrate=1#h"))).toBe(
      "/w?a=b#h"
    );
  });
});
