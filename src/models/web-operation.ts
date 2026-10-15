/** Firebase owns operations; Supabase may remain the identity/chat provider. */
export const WORKFLOW_STATUSES = [
    "awaiting_payment",
    "proof_submitted",
    "verified",
    "paid_out",
    "cancelled",
    "rejected",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type OperationExtension = {
    workflowStatus?: WorkflowStatus;
    recipientName?: string;
    recipientDocument?: string;
    recipientDocumentType?: string;
    customerPhone?: string;
    billingPreference?: "boleta" | "factura" | "br_receipt";
    billingEmail?: string;
    billingName?: string;
    billingDocument?: string;
    fundsReason?: string;
    payoutPath?: string | null;
    payoutReference?: string | null;
    payoutAt?: string | null;
    payoutBy?: string | null;
    sourceSystem?: "firebase" | "supabase";
    saveAccounts?: boolean;
    /** Optimistic concurrency: staff submits this version when acting. */
    revision?: number;
};
export type OperationAction =
    | "verify"
    | "request_proof"
    | "reject"
    | "cancel"
    | "payout";
export type OperationAudit = {
    id: string;
    orderId: string;
    actor: string;
    action: string;
    note: string;
    createdAt: string;
    from: WorkflowStatus;
    to: WorkflowStatus;
};
