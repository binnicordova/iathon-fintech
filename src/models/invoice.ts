import type {Currency} from "./currency";

export const INVOICE_STATUSES = [
    "reserved",
    "sent",
    "accepted",
    "rejected",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Written only by Fact. One per order, ever (`orderId` is the key). */
export type Invoice = {
    orderId: string;
    uid: string;
    series: string;
    number: number;
    /** `B001-00000003`. `series` + `number` are unique together. */
    fullNumber: string;
    status: InvoiceStatus;
    providerMessage: string | null;
    /** Derived from the send currency: PEN → INGENITECH S.A.C., BRL → Brasper 21. */
    issuer: string;
    currency: Currency;
    taxableValue: number;
    tax: number;
    total: number;
    xmlPath: string;
    pdfPath: string;
    emailedAt: string | null;
    createdAt: string;
    updatedAt: string;
    /** Always true until KeyFácil / Omni test access exists. */
    testMode: boolean;
};
