import type {Invoice} from "../models/invoice";
import type {
    Order,
    OrderStatus,
    TimelineStep,
    TimelineStepState,
} from "../models/order";

export const formatOrderId = (seq: number): string =>
    `BR-${String(seq).padStart(4, "0")}`;

export const parseOrderSeq = (orderId: string): number | null => {
    const match = /^BR-(\d{4,})$/.exec(orderId.trim().toUpperCase());
    return match ? Number(match[1]) : null;
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ["validating", "cancelled"],
    validating: ["approved", "rejected"],
    approved: ["exported"],
    exported: [],
    rejected: [],
    cancelled: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
    TRANSITIONS[from].includes(to);

export const isOpenOrder = (status: OrderStatus): boolean =>
    status === "pending" || status === "validating";

export const isTerminalOrder = (status: OrderStatus): boolean =>
    TRANSITIONS[status].length === 0;

type TimelineInput = Pick<Order, "status" | "invoiceStatus">;

/**
 * Client-facing progress: registered → verifying → money sent → money received.
 * Derived from the order, so the form and the assistant always agree.
 */
export const timelineFor = ({
    status,
    invoiceStatus,
}: TimelineInput): TimelineStep[] => {
    const receiptReady =
        invoiceStatus === "accepted" || invoiceStatus === "sent";
    const failed = status === "rejected" || status === "cancelled";

    const verifying: TimelineStepState = failed
        ? "failed"
        : status === "validating"
          ? "active"
          : status === "approved" || status === "exported"
            ? "done"
            : "todo";
    const sent: TimelineStepState =
        status === "approved" || status === "exported" ? "done" : "todo";
    const received: TimelineStepState = receiptReady
        ? "done"
        : status === "exported"
          ? "active"
          : "todo";

    return [
        {key: "registered", state: "done"},
        {key: "verifying", state: verifying},
        {key: "sent", state: sent},
        {key: "received", state: received},
    ];
};

/**
 * Issuer follows the send currency (PEN → INGENITECH S.A.C., BRL → Brasper 21).
 * The plan does not say who invoices USD; INGENITECH is an assumption to
 * confirm with the accountant.
 */
export const INVOICE_ISSUER = {
    PEN: "INGENITECH S.A.C.",
    BRL: "Brasper 21",
    USD: "INGENITECH S.A.C.",
} as const;

export const invoiceNumber = (series: string, number: number): string =>
    `${series}-${String(number).padStart(8, "0")}`;

export const isReceiptReady = (
    invoice: Pick<Invoice, "status"> | null
): boolean => invoice?.status === "accepted" || invoice?.status === "sent";
