import type {Currency} from "./currency";

/**
 * Business pricing, kept in `config/public` so the team can change it without
 * a release. Basis points: 100 bps = 1%.
 */
export type Pricing = {
    /** Gap between market and Brasper rate, taken from the client. */
    spreadBps: number;
    /** Commission on the send amount (the taxable value). */
    commissionBps: number;
    /** Tax on the commission (IGV 18%). Accountant to confirm. */
    taxBps: number;
    /** How long a quote can be turned into an order. */
    quoteTtlMinutes: number;
    /** How long the rate is guaranteed once the order exists. */
    rateLockMinutes: number;
    ratesRefreshMinutes: number;
    /** Above this (USD equivalent) a person negotiates the rate. */
    largeAmountUsd: number;
    minSendUsd: number;
};

export type PaymentAccount = {
    currency: Currency;
    holder: string;
    bank: string;
    accountNumber: string;
    /** PIX key for BRL accounts. */
    pixKey?: string;
    /** Placeholder account for demos; the app labels it as such. */
    demo?: boolean;
};

export type PublicConfig = {
    pricing: Pricing;
    /** Average minutes a person needs per queued client. */
    minutesPerQueuedClient: number;
};

export type PaymentAccounts = Record<Currency, PaymentAccount>;
