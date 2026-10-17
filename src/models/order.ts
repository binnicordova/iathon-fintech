import type {Channel, Currency, Language} from "./currency";
import type {InvoiceStatus} from "./invoice";
import type {PaymentAccount} from "./settings";
import type {OperationExtension} from "./web-operation";

export const ORDER_STATUSES = [
    "pending",
    "validating",
    "approved",
    "exported",
    "rejected",
    "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DOC_TYPES = ["DNI", "CE", "RUC", "CPF"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const FUNDS_SOURCES = [
    "savings",
    "salary",
    "business",
    "asset_sale",
    "donation",
    "other",
] as const;
export type FundsSource = (typeof FUNDS_SOURCES)[number];

/** What the client types once, by form or by chat. */
export type OrderClientData = {
    clientName: string;
    docType: DocType;
    docNumber: string;
    email: string;
    fundsSource: FundsSource;
    sourceBank: string;
    sourceAccount: string;
    destinationBank: string;
    destinationAccount: string;
};

export type Order = OrderClientData &
    OperationExtension & {
        /** `BR-0001`. Primary key. */
        orderId: string;
        seq: number;
        uid: string;
        channel: Channel;
        language: Language;
        status: OrderStatus;
        /** ISO, UTC. Shown in Lima time (UTC-5). */
        createdAt: string;
        updatedAt: string;
        quoteId: string;
        sendAmount: number;
        sendCurrency: Currency;
        receiveAmount: number;
        receiveCurrency: Currency;
        /** Rate frozen when the client pressed "Continuar". */
        rate: number;
        marketRate: number;
        commission: number;
        tax: number;
        total: number;
        rateLockedUntil: string;
        /** Snapshot of where the client was told to pay (audit). */
        paymentAccount: PaymentAccount;
        operationNo: string | null;
        paymentProofPath: string | null;
        proofSubmittedAt: string | null;
        validatedBy: string | null;
        validatedAt: string | null;
        rejectionReason: string | null;
        exportBatchId: string | null;
        exportedAt: string | null;
        /** Mirrored from `invoices/{orderId}`, which only Fact writes. */
        invoiceStatus: InvoiceStatus | null;
        /** Staff email for an operation registered through the human channel. */
        createdBy?: string;
    };

export type TimelineStepKey = "registered" | "verifying" | "sent" | "received";
export type TimelineStepState = "done" | "active" | "todo" | "failed";

export type TimelineStep = {
    key: TimelineStepKey;
    state: TimelineStepState;
};
