import type {Language} from "@/models/currency";
import type {Quote} from "@/models/quote";

/**
 * Rich blocks the app renders from system data. The assistant never writes the
 * numbers on them: rates, fees and account numbers come from the server.
 */
export type ChatCard =
    | {kind: "quote"; quote: Quote}
    | {kind: "review"; quote: Quote}
    | {kind: "payment"; orderId: string}
    | {kind: "proof"; orderId: string}
    | {kind: "status"; orderId: string};

/** One-tap replies under the latest assistant message. */
export type QuickActionId =
    | "continue"
    | "changeAmount"
    | "human"
    | "form"
    | "review"
    | "paid"
    | "proof"
    | "status";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    text: string;
    cards: ChatCard[];
    actions: QuickActionId[];
    at: number;
};

export type AssistantLanguageName = Record<Language, string>;
