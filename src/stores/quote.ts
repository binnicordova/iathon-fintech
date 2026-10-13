import {atom} from "jotai";
import {STORAGE_KEYS} from "@/constants/storage";
import {formatNumber, parseAmount} from "@/domain/money";
import {computeQuote, minimumSend, QuoteError} from "@/domain/pricing";
import type {Channel} from "@/models/currency";
import {DEFAULT_QUOTE_DRAFT, type QuoteDraft} from "@/models/draft";
import type {Quote, QuoteAmounts} from "@/models/quote";
import {api} from "@/services/api";
import {languageAtom} from "@/stores/language";
import {persistedAtom} from "@/stores/persisted";
import {ratesAtom} from "@/stores/rates";

export const quoteDraftAtom = persistedAtom<QuoteDraft>(
    STORAGE_KEYS.quoteDraft,
    DEFAULT_QUOTE_DRAFT
);

export type LiveQuote =
    | {status: "empty"}
    | {status: "unavailable"}
    | {status: "too-small"; minimum: number}
    | {status: "ready"; amounts: QuoteAmounts};

/**
 * Prices the calculator as the client types, from the rates the server sent.
 * It is only a preview: "Continuar" asks the server for the real, frozen quote.
 */
export const liveQuoteAtom = atom<LiveQuote>((get) => {
    const payload = get(ratesAtom);
    const draft = get(quoteDraftAtom);
    if (!payload) {
        return {status: "unavailable"};
    }
    const text = draft.editing === "send" ? draft.sendText : draft.receiveText;
    const amount = parseAmount(text);
    if (amount === null || amount <= 0) {
        return {status: "empty"};
    }
    try {
        const amounts = computeQuote(payload.market, payload.pricing, {
            sendCurrency: draft.sendCurrency,
            receiveCurrency: draft.receiveCurrency,
            ...(draft.editing === "send"
                ? {sendAmount: amount}
                : {receiveAmount: amount}),
        });
        const minimum = minimumSend(
            payload.market,
            payload.pricing,
            draft.sendCurrency
        );
        if (amounts.sendAmount < minimum) {
            return {status: "too-small", minimum};
        }
        return {status: "ready", amounts};
    } catch (error) {
        if (error instanceof QuoteError && error.code === "invalid-amount") {
            return {status: "empty"};
        }
        return {status: "unavailable"};
    }
});

/** The text to show in the field the client is *not* typing in. */
export const derivedAmountTextAtom = atom((get) => {
    const live = get(liveQuoteAtom);
    const draft = get(quoteDraftAtom);
    const language = get(languageAtom);
    if (live.status !== "ready") {
        return "";
    }
    const value =
        draft.editing === "send"
            ? live.amounts.receiveAmount
            : live.amounts.sendAmount;
    return formatNumber(value, language).replace(/[,.]00$/, "");
});

/** The server-priced quote the client pressed "Continuar" on. */
export const lockedQuoteAtom = persistedAtom<Quote | null>(
    STORAGE_KEYS.lockedQuote,
    null
);

export const lockQuoteAtom = atom(
    null,
    async (get, set, channel: Channel = "form") => {
        const draft = get(quoteDraftAtom);
        const amount = parseAmount(
            draft.editing === "send" ? draft.sendText : draft.receiveText
        );
        if (amount === null) {
            throw new QuoteError("invalid-amount");
        }
        const quote = await api.createQuote({
            sendCurrency: draft.sendCurrency,
            receiveCurrency: draft.receiveCurrency,
            ...(draft.editing === "send"
                ? {sendAmount: amount}
                : {receiveAmount: amount}),
            channel,
        });
        set(lockedQuoteAtom, quote);
        return quote;
    }
);
