import type {Currency} from "./currency";
import type {DocType, FundsSource} from "./order";

/** The quote calculator, as the client left it. */
export type QuoteDraft = {
    sendCurrency: Currency;
    receiveCurrency: Currency;
    /** Whichever field the client typed in drives the other one. */
    editing: "send" | "receive";
    sendText: string;
    receiveText: string;
};

/** Everything the data step (or the assistant) collects, as typed text. */
export type ClientDraft = {
    clientName: string;
    email: string;
    docType: DocType;
    docNumber: string;
    fundsSource: FundsSource | "";
    sourceBank: string;
    sourceAccount: string;
    destinationBank: string;
    destinationAccount: string;
};

export const EMPTY_CLIENT_DRAFT: ClientDraft = {
    clientName: "",
    email: "",
    docType: "DNI",
    docNumber: "",
    fundsSource: "",
    sourceBank: "",
    sourceAccount: "",
    destinationBank: "",
    destinationAccount: "",
};

export const DEFAULT_QUOTE_DRAFT: QuoteDraft = {
    sendCurrency: "BRL",
    receiveCurrency: "PEN",
    editing: "send",
    sendText: "500",
    receiveText: "",
};
