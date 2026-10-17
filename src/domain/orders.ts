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

type TimelineInput = Pick<Order, "status" | "invoiceStatus" | "payoutAt">;

/** Approval/export are bookkeeping; only a recorded payout means sent. */
export const timelineFor = ({
    status,
    payoutAt,
}: TimelineInput): TimelineStep[] => {
    const failed = status === "rejected" || status === "cancelled";
    const verifying: TimelineStepState = failed
        ? "failed"
        : status === "validating"
          ? "active"
          : status === "approved" || status === "exported"
            ? "done"
            : "todo";
    return [
        {key: "registered", state: "done"},
        {key: "verifying", state: verifying},
        {key: "sent", state: payoutAt ? "done" : "todo"},
        // No bank confirmation of beneficiary receipt exists yet.
        {key: "received", state: payoutAt ? "active" : "todo"},
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
