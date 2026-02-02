import { describe, expect, it } from "vitest";
import { applyPatch, PatchError } from "../patch.js";

const base = {
  title: "Base",
  nested: {
    inner: 1,
  },
};

describe("applyPatch", () => {
  it("sets and removes properties", () => {
    const patched = applyPatch(base, {
      title: "Updated",
      "nested/inner": null,
    });
    expect(patched.title).toBe("Updated");
    expect("inner" in patched.nested).toBe(false);
  });

  it("rejects missing paths", () => {
    expect(() => applyPatch(base, { "missing/value": 1 })).toThrow(PatchError);
  });

  it("rejects prefix conflicts", () => {
    expect(() =>
      applyPatch(base, {
        title: "Updated",
        "title/value": "Nope",
      }),
    ).toThrow(PatchError);
  });

  it("rejects array traversal", () => {
    const withArray = { items: [{ name: "a" }] };
    expect(() => applyPatch(withArray, { "items/0/name": "b" })).toThrow(PatchError);
  });

  it("rejects array targets", () => {
    const input: number[] = [];
    expect(() => applyPatch(input, { a: 1 })).toThrow(PatchError);
  });

  it("rejects missing path segments", () => {
    const input = { a: {} };
    expect(() => applyPatch(input, { "a/b/c": 1 })).toThrow(PatchError);
  });

  it("rejects undefined path nodes", () => {
    const input = { a: { b: undefined } };
    expect(() => applyPatch(input, { "a/b/c": 1 })).toThrow(PatchError);
  });

  it("handles empty patch", () => {
    const patched = applyPatch(base, {});
    expect(patched).toEqual(base);
  });
});
