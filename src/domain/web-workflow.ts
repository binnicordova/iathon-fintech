import type {Order} from "../models/order";
import type {OperationAction, WorkflowStatus} from "../models/web-operation";

export function workflowStatus(
    order: Pick<Order, "status" | "workflowStatus" | "payoutAt">
): WorkflowStatus {
    if (order.workflowStatus) return order.workflowStatus;
    if (order.status === "cancelled" || order.status === "rejected")
        return order.status;
    if (order.payoutAt) return "paid_out";
    if (order.status === "approved" || order.status === "exported")
        return "verified";
    return order.status === "validating"
        ? "proof_submitted"
        : "awaiting_payment";
}
export function nextWorkflow(
    from: WorkflowStatus,
    action: OperationAction
): WorkflowStatus {
    if (action === "verify" && from === "proof_submitted") return "verified";
    if (action === "request_proof" && from === "proof_submitted")
        return "awaiting_payment";
    if (action === "reject" && from === "proof_submitted") return "rejected";
    if (action === "payout" && from === "verified") return "paid_out";
    if (
        action === "cancel" &&
        ["awaiting_payment", "proof_submitted", "verified"].includes(from)
    )
        return "cancelled";
    throw new Error("invalid-workflow-transition");
}
export const legacyStatus = (status: WorkflowStatus): Order["status"] =>
    ({
        awaiting_payment: "pending",
        proof_submitted: "validating",
        verified: "approved",
        paid_out: "exported",
        cancelled: "cancelled",
        rejected: "rejected",
    })[status] as Order["status"];
