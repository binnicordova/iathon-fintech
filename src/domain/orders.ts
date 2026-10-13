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

type TimelineInput = Pick<Order, "status">;

/**
 * Client-facing progress: registered → verifying → money sent → money received.
 * Derived from the order, so the form and the assistant always agree.
 */
export const timelineFor = ({status}: TimelineInput): TimelineStep[] => {
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
    const received: TimelineStepState =
        status === "exported" ? "active" : "todo";

    return [
        {key: "registered", state: "done"},
        {key: "verifying", state: verifying},
        {key: "sent", state: sent},
        {key: "received", state: received},
    ];
};
