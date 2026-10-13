/**
 * Verification hours, in Lima time (UTC-5, no daylight saving):
 * Mon–Fri 7–18, Sat 8–14, Sun 12–14. Outside them only self-service works.
 */
export const LIMA_OFFSET_HOURS = -5;

/** [open, close) in whole hours, by `getUTCDay()` (0 = Sunday). */
const HOURS_BY_DAY: Record<number, [number, number]> = {
    0: [12, 14],
    1: [7, 18],
    2: [7, 18],
    3: [7, 18],
    4: [7, 18],
    5: [7, 18],
    6: [8, 14],
};

/** A date whose UTC fields read as Lima wall-clock time. */
export const toLimaWallClock = (date: Date): Date =>
    new Date(date.getTime() + LIMA_OFFSET_HOURS * 3_600_000);

const fromLimaWallClock = (wall: Date): Date =>
    new Date(wall.getTime() - LIMA_OFFSET_HOURS * 3_600_000);

export const isSupportOpen = (now: Date): boolean => {
    const wall = toLimaWallClock(now);
    const [open, close] = HOURS_BY_DAY[wall.getUTCDay()];
    const hour = wall.getUTCHours() + wall.getUTCMinutes() / 60;
    return hour >= open && hour < close;
};

/** When a person will next check the bank: now if open, else the next opening. */
export const nextVerificationSlot = (now: Date): Date => {
    if (isSupportOpen(now)) {
        return now;
    }
    const wall = toLimaWallClock(now);
    for (let offset = 0; offset < 8; offset += 1) {
        const day = new Date(
            Date.UTC(
                wall.getUTCFullYear(),
                wall.getUTCMonth(),
                wall.getUTCDate() + offset
            )
        );
        const [open] = HOURS_BY_DAY[day.getUTCDay()];
        const candidate = new Date(day.getTime() + open * 3_600_000);
        if (candidate.getTime() > wall.getTime()) {
            return fromLimaWallClock(candidate);
        }
    }
    return now;
};

export type LimaTimeParts = {hour24: number; minute: number};

export const limaTimeParts = (date: Date): LimaTimeParts => {
    const wall = toLimaWallClock(date);
    return {hour24: wall.getUTCHours(), minute: wall.getUTCMinutes()};
};

/** "5:18 p. m." — 12-hour clock, same on every platform. */
export const formatLimaClock = (date: Date): string => {
    const {hour24, minute} = limaTimeParts(date);
    const suffix = hour24 >= 12 ? "p. m." : "a. m.";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
};

export const isSameLimaDay = (a: Date, b: Date): boolean => {
    const wa = toLimaWallClock(a);
    const wb = toLimaWallClock(b);
    return (
        wa.getUTCFullYear() === wb.getUTCFullYear() &&
        wa.getUTCMonth() === wb.getUTCMonth() &&
        wa.getUTCDate() === wb.getUTCDate()
    );
};

const pad = (value: number): string => String(value).padStart(2, "0");

/** "12/10/2026 5:18 p. m." for lists and receipts. */
export const formatLimaDateTime = (date: Date): string => {
    const wall = toLimaWallClock(date);
    return `${pad(wall.getUTCDate())}/${pad(wall.getUTCMonth() + 1)}/${wall.getUTCFullYear()} ${formatLimaClock(date)}`;
};
