import type {MarketRates} from "../models/rates";
import {
    brasperRate,
    computeQuote,
    DEFAULT_PRICING,
    marketRateBetween,
    minimumSend,
    QuoteError,
} from "./pricing";

// 1 USD = 5.01 BRL = 3.45 PEN, the figures in the plan (11 Oct 2026).
const market: MarketRates = {
    base: "USD",
    rates: {USD: 1, BRL: 5.01, PEN: 3.45},
    source: "open.er-api.com",
    fetchedAt: "2026-10-11T22:18:00.000Z",
    nextUpdateAt: "2026-10-11T23:18:00.000Z",
    providerUpdatedAt: null,
};

describe("marketRateBetween", () => {
    it("crosses through USD", () => {
        expect(marketRateBetween(market, "BRL", "PEN")).toBeCloseTo(0.6886, 4);
        expect(marketRateBetween(market, "USD", "BRL")).toBe(5.01);
    });

    it("refuses a missing rate instead of returning 0", () => {
        const broken = {...market, rates: {...market.rates, PEN: 0}};
        expect(() => marketRateBetween(broken, "BRL", "PEN")).toThrow(
            QuoteError
        );
    });
});

describe("brasperRate", () => {
    it("takes the spread off the market rate", () => {
        expect(brasperRate(0.6886, 200)).toBe(0.6748);
    });
});

describe("computeQuote", () => {
    const base = {sendCurrency: "BRL", receiveCurrency: "PEN"} as const;

    it("prices a 500 BRL → PEN transfer", () => {
        const quote = computeQuote(market, DEFAULT_PRICING, {
            ...base,
            sendAmount: 500,
        });
        expect(quote.sendAmount).toBe(500);
        expect(quote.rate).toBe(0.6749);
        expect(quote.receiveAmount).toBe(337.45);
        expect(quote.commission).toBe(12);
        expect(quote.tax).toBe(2.16);
        expect(quote.total).toBe(514.16);
        expect(quote.requiresHuman).toBe(false);
    });

    it("works backwards from the amount the recipient should get", () => {
        const quote = computeQuote(market, DEFAULT_PRICING, {
            ...base,
            receiveAmount: 337.45,
        });
        expect(quote.sendAmount).toBe(500);
    });

    it("sends large amounts to a person", () => {
        const quote = computeQuote(market, DEFAULT_PRICING, {
            sendCurrency: "USD",
            receiveCurrency: "BRL",
            sendAmount: 5000,
        });
        expect(quote.requiresHuman).toBe(true);
    });

    it("rejects bad input", () => {
        expect(() =>
            computeQuote(market, DEFAULT_PRICING, {...base, sendAmount: 0})
        ).toThrow("invalid-amount");
        expect(() => computeQuote(market, DEFAULT_PRICING, base)).toThrow(
            "invalid-amount"
        );
        expect(() =>
            computeQuote(market, DEFAULT_PRICING, {
                sendCurrency: "BRL",
                receiveCurrency: "BRL",
                sendAmount: 10,
            })
        ).toThrow("same-currency");
    });

    it("never lets the total be below the send amount", () => {
        const quote = computeQuote(market, DEFAULT_PRICING, {
            ...base,
            sendAmount: 1,
        });
        expect(quote.total).toBeGreaterThanOrEqual(quote.sendAmount);
    });
});

describe("minimumSend", () => {
    it("converts the USD floor to the send currency", () => {
        expect(minimumSend(market, DEFAULT_PRICING, "BRL")).toBe(50.1);
    });
});
