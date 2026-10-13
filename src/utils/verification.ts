import {
    formatLimaClock,
    isSameLimaDay,
    isSupportOpen,
    nextVerificationSlot,
    toLimaWallClock,
} from "@/domain/hours";
import {formatNumber} from "@/domain/money";
import type {Params, TranslationKey} from "@/i18n";

type Translate = (key: TranslationKey, params?: Params) => string;

/** "hoy a las 12:00 p. m." / "el 13/10 a las 7:00 a. m." for the pay screen. */
export const describeVerificationSlot = (
    now: Date,
    t: Translate
): string | null => {
    if (isSupportOpen(now)) {
        return null;
    }
    const slot = nextVerificationSlot(now);
    const time = formatLimaClock(slot);
    if (isSameLimaDay(slot, now)) {
        return t("pay.today", {time});
    }
    const wall = toLimaWallClock(slot);
    const date = `${formatNumber(wall.getUTCDate(), "es", 0)}/${String(wall.getUTCMonth() + 1).padStart(2, "0")}`;
    return t("pay.otherDay", {date, time});
};
