import type {Currency, Language} from "../models/currency";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
    BRL: "R$",
    PEN: "S/",
    USD: "US$",
};

const SEPARATORS: Record<Language, {group: string; decimal: string}> = {
    es: {group: ",", decimal: "."},
    en: {group: ",", decimal: "."},
    pt: {group: ".", decimal: ","},
};

/** Round to cents, half away from zero, immune to 1.005-style float noise. */
export const roundMoney = (value: number): number =>
    Math.sign(value) *
    (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100);

export const roundRate = (value: number): number =>
    Math.round((value + Number.EPSILON) * 10000) / 10000;

const groupDigits = (digits: string, group: string): string =>
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, group);

/** Fixed, locale-independent formatting so every platform prints the same. */
export const formatNumber = (
    value: number,
    language: Language,
    fractionDigits = 2
): string => {
    const {group, decimal} = SEPARATORS[language];
    const fixed = Math.abs(value).toFixed(fractionDigits);
    const [whole, fraction] = fixed.split(".");
    const sign = value < 0 ? "-" : "";
    const body = groupDigits(whole, group);
    return fraction ? `${sign}${body}${decimal}${fraction}` : `${sign}${body}`;
};

export const formatMoney = (
    value: number,
    currency: Currency,
    language: Language
): string => `${CURRENCY_SYMBOL[currency]} ${formatNumber(value, language)}`;

export const formatRate = (value: number, language: Language): string =>
    formatNumber(value, language, 4);

/** Parses what a person typed: tolerates "1.234,50", "1,234.50" and "500". */
export const parseAmount = (input: string): number | null => {
    const cleaned = input.replace(/[^\d.,]/g, "");
    if (!cleaned) {
        return null;
    }
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    const decimalAt = Math.max(lastDot, lastComma);
    let normalized: string;
    if (decimalAt === -1) {
        normalized = cleaned;
    } else {
        const decimals = cleaned.length - decimalAt - 1;
        const onlyOneSeparator =
            cleaned.indexOf(cleaned[decimalAt]) === decimalAt;
        // "1,234" with a single separator and 3 trailing digits is a group.
        const looksLikeGroup = onlyOneSeparator && decimals === 3;
        normalized = looksLikeGroup
            ? cleaned.replace(/[.,]/g, "")
            : `${cleaned.slice(0, decimalAt).replace(/[.,]/g, "")}.${cleaned.slice(decimalAt + 1)}`;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
};
