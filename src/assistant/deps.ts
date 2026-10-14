import type {ClientProfile} from "@/models/client";
import type {Channel, Currency, Language} from "@/models/currency";
import type {ClientDraft} from "@/models/draft";
import type {Order} from "@/models/order";
import type {Quote} from "@/models/quote";

export type LockQuoteInput = {
    amount: number;
    amountKind: "send" | "receive";
    sendCurrency: Currency;
    receiveCurrency: Currency;
};

/**
 * Everything the assistant's tools touch, behind one interface. The app wires
 * the real stores and Cloud Functions in `defaultDeps`; tests pass fakes. It is
 * also the seam for moving the same graph to a server (WhatsApp) later.
 */
export type AssistantDeps = {
    now(): Date;
    language(): Language;
    channel: Channel;
    getDraft(): ClientDraft;
    updateDraft(update: Partial<ClientDraft>): void;
    getProfile(): ClientProfile | null;
    getLockedQuote(): Quote | null;
    lockQuote(input: LockQuoteInput): Promise<Quote>;
    getActiveOrderId(): string | null;
    /** The given order, else the active one, else the client's latest. */
    fetchOrder(orderId: string | null): Promise<Order | null>;
};
