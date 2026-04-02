import { RSCALE_GREGORIAN } from "../constants.js";

const GREGORY = "gregory";

type RscaleDefinition = {
    canonical: string;
    calendarId: string;
};

const RSCALE_DEFINITIONS = new Map<string, RscaleDefinition>([
    [RSCALE_GREGORIAN, { canonical: RSCALE_GREGORIAN, calendarId: GREGORY }],
    [GREGORY, { canonical: RSCALE_GREGORIAN, calendarId: GREGORY }],
    ["iso8601", { canonical: RSCALE_GREGORIAN, calendarId: GREGORY }],
    ["hebrew", { canonical: "hebrew", calendarId: "hebrew" }],
    ["chinese", { canonical: "chinese", calendarId: "chinese" }],
    ["dangi", { canonical: "dangi", calendarId: "dangi" }],
    ["indian", { canonical: "indian", calendarId: "indian" }],
    ["persian", { canonical: "persian", calendarId: "persian" }],
    ["japanese", { canonical: "japanese", calendarId: "japanese" }],
    ["buddhist", { canonical: "buddhist", calendarId: "buddhist" }],
    ["roc", { canonical: "roc", calendarId: "roc" }],
    ["coptic", { canonical: "coptic", calendarId: "coptic" }],
    ["ethiopic", { canonical: "ethiopic", calendarId: "ethiopic" }],
    ["ethioaa", { canonical: "ethiopic-amete-alem", calendarId: "ethioaa" }],
    [
        "ethiopic-amete-alem",
        { canonical: "ethiopic-amete-alem", calendarId: "ethioaa" },
    ],
    ["islamic", { canonical: "islamic", calendarId: "islamic" }],
    [
        "islamic-civil",
        { canonical: "islamic-civil", calendarId: "islamic-civil" },
    ],
    ["islamic-tbla", { canonical: "islamic-tbla", calendarId: "islamic-tbla" }],
    [
        "islamic-umalqura",
        { canonical: "islamic-umalqura", calendarId: "islamic-umalqura" },
    ],
]);

/**
 * Resolve an RSCALE value into canonical recurrence and Temporal calendar IDs.
 * @param input RSCALE value from the recurrence rule.
 * @return Canonical recurrence metadata.
 */
export function resolveRscaleDefinition(input?: string): RscaleDefinition {
    const resolved = input
        ? RSCALE_DEFINITIONS.get(input.toLowerCase())
        : undefined;
    if (resolved) {
        return resolved;
    }
    if (input) {
        throw new Error(`Unsupported rscale: ${input}`);
    }
    return {
        canonical: RSCALE_GREGORIAN,
        calendarId: GREGORY,
    };
}
