import type {Channel, Language} from "./currency";

export type HandoffStatus = "waiting" | "assigned" | "closed";

/** A client asking for a person, with the context the assistant gathered. */
export type Handoff = {
    id: string;
    uid: string;
    orderId: string | null;
    status: HandoffStatus;
    channel: Channel;
    language: Language;
    summary: string;
    createdAt: string;
    assignedTo: string | null;
};

export type QueueInfo = {
    handoffId: string;
    /** 1-based place in line. */
    position: number;
    estimatedWaitMinutes: number;
};
