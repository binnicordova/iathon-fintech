import type {Currency} from "../models/currency";
import type {QuoteAmounts, QuoteInput} from "../models/quote";
import type {MarketRates} from "../models/rates";
import type {Pricing} from "../models/settings";
import {roundMoney, roundRate} from "./money";

export const DEFAULT_PRICING: Pricing = {
    // Placeholders until the business and accountant set real values:
    // 2.4% commission is back-solved from the spec's 11.98 on 500, and 18% is
    // the tax rate on the team's board.
    spreadBps: 200,
    commissionBps: 240,
    taxBps: 1800,
    quoteTtlMinutes: 15,
    rateLockMinutes: 30,
    ratesRefreshMinutes: 60,
    largeAmountUsd: 3000,
    minSendUsd: 10,
};

export type PricingError = "invalid-amount" | "same-currency" | "unavailable";

export class QuoteError extends Error {
    constructor(readonly code: PricingError) {
        super(code);
        this.name = "QuoteError";
    }
}

/** Market reference: how many `to` one `from` buys. */
export const marketRateBetween = (
    market: MarketRates,
    from: Currency,
    to: Currency
): number => {
    const fromPerUsd = market.rates[from];
    const toPerUsd = market.rates[to];
    if (!(fromPerUsd > 0) || !(toPerUsd > 0)) {
        throw new QuoteError("unavailable");
    }
    return toPerUsd / fromPerUsd;
};

/** The client's rate: market minus the business spread. */
export const brasperRate = (marketRate: number, spreadBps: number): number =>
    roundRate(marketRate * (1 - spreadBps / 10000));

export const toUsd = (
    market: MarketRates,
    currency: Currency,
    amount: number
): number => amount / market.rates[currency];

export const computeQuote = (
    market: MarketRates,
    pricing: Pricing,
    input: QuoteInput
): QuoteAmounts => {
    const {sendCurrency, receiveCurrency} = input;
    if (sendCurrency === receiveCurrency) {
        throw new QuoteError("same-currency");
    }
    const marketRate = marketRateBetween(market, sendCurrency, receiveCurrency);
    const rate = brasperRate(marketRate, pricing.spreadBps);

    let sendAmount: number;
    if (input.sendAmount !== undefined) {
        sendAmount = roundMoney(input.sendAmount);
    } else if (input.receiveAmount !== undefined) {
        sendAmount = roundMoney(input.receiveAmount / rate);
    } else {
        throw new QuoteError("invalid-amount");
    }
    if (!Number.isFinite(sendAmount) || sendAmount <= 0) {
        throw new QuoteError("invalid-amount");
    }

    const receiveAmount = roundMoney(sendAmount * rate);
    const commission = roundMoney((sendAmount * pricing.commissionBps) / 10000);
    const tax = roundMoney((commission * pricing.taxBps) / 10000);
    const total = roundMoney(sendAmount + commission + tax);
    const usd = toUsd(market, sendCurrency, sendAmount);

    return {
        sendCurrency,
        receiveCurrency,
        sendAmount,
        receiveAmount,
        marketRate: roundRate(marketRate),
        rate,
        commission,
        tax,
        total,
        requiresHuman: usd > pricing.largeAmountUsd,
    };
};

/** Smallest amount worth quoting, in the currency being sent. */
export const minimumSend = (
    market: MarketRates,
    pricing: Pricing,
    currency: Currency
): number => roundMoney(pricing.minSendUsd * market.rates[currency]);
