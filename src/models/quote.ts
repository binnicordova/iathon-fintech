import type {Channel, Currency} from "./currency";

export type QuoteStatus = "open" | "consumed";

export type QuoteAmounts = {
    sendCurrency: Currency;
    receiveCurrency: Currency;
    /** What the client sends (the amount being exchanged). */
    sendAmount: number;
    /** What arrives at the destination account. */
    receiveAmount: number;
    /** Market reference: 1 send = marketRate receive. */
    marketRate: number;
    /** Brasper rate: 1 send = rate receive. Frozen on the order. */
    rate: number;
    /** Taxable value, in the send currency. */
    commission: number;
    tax: number;
    /** sendAmount + commission + tax: what the client actually transfers. */
    total: number;
    /** True when a person must negotiate the rate (large amounts). */
    requiresHuman: boolean;
};

export type QuoteInput = {
    sendCurrency: Currency;
    receiveCurrency: Currency;
    sendAmount?: number;
    receiveAmount?: number;
};

export type Quote = QuoteAmounts & {
    id: string;
    orderId?: string;
    uid: string;
    channel: Channel;
    status: QuoteStatus;
    createdAt: string;
    /** The rate is guaranteed until this time. */
    expiresAt: string;
};
