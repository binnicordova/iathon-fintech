import {
    formatLimaClock,
    formatLimaDateTime,
    isSupportOpen,
    nextVerificationSlot,
} from "./hours";

// Lima is UTC-5, so 12:00 Lima = 17:00Z.
const lima = (iso: string): Date => new Date(`${iso}-05:00`);

describe("isSupportOpen", () => {
    it("is open on weekday working hours", () => {
        expect(isSupportOpen(lima("2026-10-12T10:00:00"))).toBe(true); // Monday
        expect(isSupportOpen(lima("2026-10-12T06:59:00"))).toBe(false);
        expect(isSupportOpen(lima("2026-10-12T18:00:00"))).toBe(false);
    });

    it("keeps shorter weekend hours", () => {
        expect(isSupportOpen(lima("2026-10-17T09:00:00"))).toBe(true); // Saturday
        expect(isSupportOpen(lima("2026-10-17T14:00:00"))).toBe(false);
        expect(isSupportOpen(lima("2026-10-18T13:00:00"))).toBe(true); // Sunday
        expect(isSupportOpen(lima("2026-10-18T10:00:00"))).toBe(false);
    });
});

describe("nextVerificationSlot", () => {
    it("is now while open", () => {
        const now = lima("2026-10-12T10:00:00");
        expect(nextVerificationSlot(now).getTime()).toBe(now.getTime());
    });

    it("waits for the same day's opening when early", () => {
        const slot = nextVerificationSlot(lima("2026-10-18T09:00:00")); // Sunday
        expect(formatLimaClock(slot)).toBe("12:00 p. m.");
        expect(slot.getTime()).toBe(lima("2026-10-18T12:00:00").getTime());
    });

    it("rolls to the next day after closing", () => {
        const slot = nextVerificationSlot(lima("2026-10-16T19:00:00")); // Friday night
        expect(slot.getTime()).toBe(lima("2026-10-17T08:00:00").getTime()); // Saturday
    });

    it("skips from Sunday night to Monday morning", () => {
        const slot = nextVerificationSlot(lima("2026-10-18T20:00:00"));
        expect(slot.getTime()).toBe(lima("2026-10-19T07:00:00").getTime());
    });
});

describe("formatting", () => {
    it("prints a 12-hour clock", () => {
        expect(formatLimaClock(lima("2026-10-11T17:18:00"))).toBe("5:18 p. m.");
        expect(formatLimaClock(lima("2026-10-11T00:05:00"))).toBe(
            "12:05 a. m."
        );
    });

    it("prints date and time in Lima", () => {
        expect(formatLimaDateTime(new Date("2026-10-11T22:18:00Z"))).toBe(
            "11/10/2026 5:18 p. m."
        );
    });
});
