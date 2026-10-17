import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {QuoteError, computeQuote, minimumSend} from "./shared/domain/pricing";
import {CURRENCIES} from "./shared/models/currency";
import type {Quote} from "./shared/models/quote";
import {db} from "./lib/firebase";
import {parse, requireAuth} from "./lib/guards";
import {RatesUnavailableError, loadMarketRates} from "./lib/rates";
import {loadPricing} from "./lib/settings";

export const QuoteRequest = z
    .object({
        sendCurrency: z.enum(CURRENCIES),
        receiveCurrency: z.enum(CURRENCIES),
        sendAmount: z.number().positive().max(10_000_000).optional(),
        receiveAmount: z.number().positive().max(10_000_000).optional(),
        channel: z.enum(["form", "assistant", "whatsapp", "human"]).default("form"),
    })
    .refine((v) => v.sendAmount !== undefined || v.receiveAmount !== undefined, {
        message: "sendAmount or receiveAmount is required",
    });

/**
 * "Continuar" on the calculator: prices the transfer on the server and freezes
 * the rate. The order is created later from this quote id.
 */
export async function createQuoteFor(uid: string, input: z.infer<typeof QuoteRequest>) {
    const pricing = await loadPricing();

    let market;
    try {
        market = await loadMarketRates(pricing.ratesRefreshMinutes);
    } catch (error) {
        if (error instanceof RatesUnavailableError) {
            throw new HttpsError("unavailable", "rates-unavailable");
        }
        throw error;
    }

    let amounts;
    try {
        amounts = computeQuote(market, pricing, input);
    } catch (error) {
        if (error instanceof QuoteError) {
            throw new HttpsError("invalid-argument", error.code);
        }
        throw error;
    }

    if (amounts.sendAmount < minimumSend(market, pricing, amounts.sendCurrency)) {
        throw new HttpsError("invalid-argument", "amount-too-small");
    }
    if (amounts.requiresHuman) {
        throw new HttpsError("failed-precondition", "requires-human", amounts);
    }

    const now = new Date();
    const ref = db().collection("quotes").doc();
    const quote: Quote = {
        id: ref.id,
        uid,
        channel: input.channel,
        status: "open",
        createdAt: now.toISOString(),
        expiresAt: new Date(
            now.getTime() + pricing.quoteTtlMinutes * 60_000
        ).toISOString(),
        ...amounts,
    };
    await ref.set(quote);
    return quote;
}
export const createQuote = onCall(async (request) =>
    createQuoteFor(requireAuth(request), parse(QuoteRequest, request.data))
);
