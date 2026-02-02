import { describe, expect, it } from "vitest";
import { JsCal } from "../jscal.js";
import { resolveTimeZone } from "../timezones.js";

describe("time zones", () => {
  it("resolves lowercase inputs", () => {
    expect(resolveTimeZone("asia/tokyo")).toBe("Asia/Tokyo");
  });

  it("throws on unknown time zones", () => {
    // @ts-expect-error invalid time zone input
    expect(() => JsCal.timeZone("Invalid/Zone")).toThrow();
  });
});
