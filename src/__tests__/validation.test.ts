import { describe, expect, it } from "vitest";
import { JsCal, ValidationError } from "../index.js";

describe("validation", () => {
  it("rejects LocalDateTime with time zone offset", () => {
    expect(() => new JsCal.Event({ start: "2026-02-01T10:00:00Z" })).toThrowError(
      "object.start: must not include time zone offset",
    );
  });

  it("rejects UTCDateTime with trailing zero fractional seconds", () => {
    expect(() => new JsCal.Event({
      start: "2026-02-01T10:00:00",
      updated: "2026-02-01T00:00:00.120Z",
    })).toThrowError(
      "object.updated: fractional seconds must not have trailing zeros",
    );
  });

  it("rejects invalid description content type", () => {
    expect(() => new JsCal.Event({
      start: "2026-02-01T10:00:00",
      descriptionContentType: "application/json",
    })).toThrowError(
      "object.descriptionContentType: must be a text/* media type",
    );
  });

  it("allows validation to be disabled for create, update, and patch", () => {
    const event = new JsCal.Event(
      { start: "2026-02-01T10:00:00Z" },
      { validate: false },
    );

    expect(event.get("start")).toBe("2026-02-01T10:00:00Z");

    event.update({ start: "2026-02-01T10:00:00Z" }, { validate: false });
    event.patch({ "/start": "2026-02-01T10:00:00Z" }, { validate: false });
  });

  it("throws ValidationError with path and message", () => {
    expect(() => new JsCal.Event({ start: "2026-02-01T10:00:00Z" })).toThrowError(ValidationError);
  });

  it("accepts nested objects with valid ids and media types", () => {
    const event = new JsCal.Event({
      uid: "evt_1",
      start: "2026-02-01T10:00:00",
      descriptionContentType: "text/plain; charset=utf-8",
      locations: {
        loc1: { "@type": "Location", name: "Room A" },
      },
      virtualLocations: {
        v1: { "@type": "VirtualLocation", uri: "https://example.com" },
      },
      links: {
        l1: { "@type": "Link", href: "https://example.com", contentType: "text/plain; charset=utf-8" },
      },
      participants: {
        p1: { "@type": "Participant", roles: { attendee: true }, email: "a@example.com" },
      },
      alerts: {
        a1: {
          "@type": "Alert",
          trigger: { "@type": "OffsetTrigger", offset: "-PT15M" },
        },
      },
      relatedTo: {
        rel1: { "@type": "Relation", relation: { first: true } },
      },
    });

    expect(event.get("uid")).toBe("evt_1");
  });

  it("rejects invalid map key ids", () => {
    expect(() => new JsCal.Event({
      start: "2026-02-01T10:00:00",
      locations: {
        "bad id": { "@type": "Location", name: "Room A" },
      },
    })).toThrowError("object.locations.bad id: must use base64url characters");
  });

  it("rejects non-gregorian rscale values", () => {
    expect(() => new JsCal.Event({
      start: "2026-02-01T10:00:00",
      recurrenceRules: [{ "@type": "RecurrenceRule", frequency: "daily", rscale: "hebrew" }],
    })).toThrowError("object.recurrenceRules[0].rscale: only gregorian is supported");
  });

  it("accepts time zone objects", () => {
    const event = new JsCal.Event({
      start: "2026-02-01T10:00:00",
      timeZones: {
        "Asia/Tokyo": {
          "@type": "TimeZone",
          tzId: "Asia/Tokyo",
          standard: [
            {
              "@type": "TimeZoneRule",
              start: "2026-01-01T00:00:00",
              offsetFrom: "+09:00",
              offsetTo: "+09:00",
            },
          ],
        },
      },
    });

    expect(event.get("timeZones")?.["Asia/Tokyo"]?.tzId).toBe("Asia/Tokyo");
  });
});
