import {httpsCallable} from "firebase/functions";
import type {Channel, Language} from "@/models/currency";
import type {Handoff, QueueInfo} from "@/models/handoff";
import type {Order, OrderClientData} from "@/models/order";
import type {Quote, QuoteAmounts, QuoteInput} from "@/models/quote";
import type {MarketRates} from "@/models/rates";
import type {Pricing} from "@/models/settings";
import {functions} from "@/services/firebase/app";

export {ApiError, type ApiErrorCode, toApiError} from "@/services/apiError";

import {toApiError} from "@/services/apiError";

const call =
    <Input, Output>(name: string) =>
    async (input: Input): Promise<Output> => {
        try {
            const result = await httpsCallable<Input, Output>(
                functions,
                name
            )(input);
            return result.data;
        } catch (error) {
            throw toApiError(error);
        }
    };

export type RatesPayload = {
    market: MarketRates;
    pricing: Pricing;
    minutesPerQueuedClient: number;
};

export type CreateQuoteInput = QuoteInput & {channel: Channel};

export type CreateOrderInput = OrderClientData & {
    quoteId: string;
    language: Language;
};

export type RequestHumanInput = {
    orderId: string | null;
    summary: string;
    language: Language;
    channel: Channel;
};

export type QueueStatus = QueueInfo & {status?: Handoff["status"]};

export type AssistantPart = {
    text?: string;
    functionCall?: {name: string; args: Record<string, unknown>};
    functionResponse?: {name: string; response: Record<string, unknown>};
    thoughtSignature?: string;
};

export type AssistantContent = {role: "user" | "model"; parts: AssistantPart[]};

export type AssistantRequest = {
    systemInstruction: string;
    contents: AssistantContent[];
    functionDeclarations: Array<{
        name: string;
        description: string;
        parameters?: Record<string, unknown>;
    }>;
    temperature?: number;
    maxOutputTokens?: number;
};

export type AssistantResponse = {
    model: string;
    parts: AssistantPart[];
    finishReason: string;
    usage: {promptTokens: number; outputTokens: number};
};

export const api = {
    getRates: call<void, RatesPayload>("getRates"),
    createQuote: call<CreateQuoteInput, Quote>("createQuote"),
    createOrder: call<CreateOrderInput, Order>("createOrder"),
    submitProof: call<
        {orderId: string; operationNo: string; proofPath: string},
        {ok: true; orderId: string}
    >("submitProof"),
    cancelOrder: call<{orderId: string}, {ok: true}>("cancelOrder"),
    requestHuman: call<RequestHumanInput, QueueInfo>("requestHuman"),
    getQueueInfo: call<{handoffId: string}, QueueStatus>("getQueueInfo"),
    leaveQueue: call<{handoffId: string}, {ok: true}>("leaveQueue"),
    assistantGenerate: call<AssistantRequest, AssistantResponse>(
        "assistantGenerate"
    ),
};

export type {QuoteAmounts};
