import {
    formatMoney,
    formatNumber,
    formatRate,
    parseAmount,
    roundMoney,
    roundRate,
} from "./money";

describe("roundMoney", () => {
    it("rounds half up without float noise", () => {
        expect(roundMoney(1.005)).toBe(1.01);
        expect(roundMoney(2.675)).toBe(2.68);
        expect(roundMoney(11.98 * 0.18)).toBe(2.16);
    });

    it("keeps the sign for refunds", () => {
        expect(roundMoney(-1.005)).toBe(-1.01);
    });
});

describe("roundRate", () => {
    it("keeps four decimals", () => {
        expect(roundRate(0.689123456)).toBe(0.6891);
    });
});

describe("formatting", () => {
    it("uses each language's separators", () => {
        expect(formatNumber(1234567.5, "es")).toBe("1,234,567.50");
        expect(formatNumber(1234567.5, "pt")).toBe("1.234.567,50");
        expect(formatNumber(999.9, "en")).toBe("999.90");
    });

    it("prefixes the currency symbol", () => {
        expect(formatMoney(500, "BRL", "pt")).toBe("R$ 500,00");
        expect(formatMoney(344.5, "PEN", "es")).toBe("S/ 344.50");
    });

    it("prints rates with four decimals", () => {
        expect(formatRate(0.6581, "es")).toBe("0.6581");
    });
});

describe("parseAmount", () => {
    it.each([
        ["500", 500],
        ["500.50", 500.5],
        ["500,50", 500.5],
        ["1.234,50", 1234.5],
        ["1,234.50", 1234.5],
        ["1,234", 1234],
        ["R$ 2.500", 2500],
    ])("reads %s as %d", (input, expected) => {
        expect(parseAmount(input)).toBe(expected);
    });

    it("rejects empty and non-numeric input", () => {
        expect(parseAmount("")).toBeNull();
        expect(parseAmount("abc")).toBeNull();
    });
});
