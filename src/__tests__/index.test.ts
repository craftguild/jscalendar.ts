import { describe, expect, it } from "vitest";
import { JsCal } from "../index.js";

describe("index export", () => {
  it("re-exports JsCal", () => {
    expect(JsCal.Event).toBeDefined();
    expect(JsCal.Task).toBeDefined();
    expect(JsCal.Group).toBeDefined();
  });
});
