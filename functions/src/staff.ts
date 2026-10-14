import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {canTransition} from "./shared/domain/orders";
import type {Order} from "./shared/models/order";
import {db} from "./lib/firebase";
import {ordersToCsv} from "./lib/csv";
import {nowIso, parse, requireStaff} from "./lib/guards";

const OrderIds = z.array(z.string().trim().min(1).max(32)).min(1).max(200);

const loadOrders = async (ids: string[]): Promise<Order[]> => {
    const snaps = await db().getAll(...ids.map((id) => db().doc(`orders/${id}`)));
    return snaps.flatMap((snap) => (snap.exists ? [snap.data() as Order] : []));
};

const ReviewRequest = z.object({
    orderId: z.string().trim().min(1).max(32),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).nullish(),
});

/** The validator checked the bank and the proof photo: records who and when. */
export const reviewOrder = onCall(async (request) => {
    const staff = requireStaff(request, ["validator"]);
    const input = parse(ReviewRequest, request.data);
    if (input.decision === "reject" && !input.reason) {
        throw new HttpsError("invalid-argument", "reason-required");
    }

    const ref = db().doc(`orders/${input.orderId}`);
    await db().runTransaction(async (tx) => {
        const order = (await tx.get(ref)).data() as Order | undefined;
        if (!order) {
            throw new HttpsError("not-found", "order-not-found");
        }
        const next = input.decision === "approve" ? "approved" : "rejected";
        if (!canTransition(order.status, next)) {
            throw new HttpsError("failed-precondition", `cannot-${next}-from-${order.status}`);
        }
        const now = nowIso();
        tx.update(ref, {
            status: next,
            validatedBy: staff.email,
            validatedAt: now,
            rejectionReason: input.decision === "reject" ? input.reason ?? null : null,
            updatedAt: now,
        });
    });
    return {ok: true};
});

/**
 * The operator marks approved orders and exports the file for the Dashboard.
 * Everything exported is recorded in a batch, and the orders move to
 * "exported" in the same step.
 */
export const exportOrders = onCall(async (request) => {
    const staff = requireStaff(request, ["operator"]);
    const {orderIds} = parse(z.object({orderIds: OrderIds}), request.data);

    const orders = await loadOrders(orderIds);
    const notApproved = orders.filter((order) => !canTransition(order.status, "exported"));
    if (orders.length !== orderIds.length || notApproved.length > 0) {
        throw new HttpsError("failed-precondition", "only-approved-orders", {
            blocked: notApproved.map((order) => order.orderId),
        });
    }

    const now = nowIso();
    const batchRef = db().collection("batches").doc();
    const batch = db().batch();
    batch.set(batchRef, {
        id: batchRef.id,
        type: "export",
        orderIds,
        createdBy: staff.email,
        createdAt: now,
    });
    for (const order of orders) {
        batch.update(db().doc(`orders/${order.orderId}`), {
            status: "exported",
            exportBatchId: batchRef.id,
            exportedAt: now,
            updatedAt: now,
        });
    }
    await batch.commit();

    const exported = orders.map((order) => ({
        ...order,
        status: "exported" as const,
        exportBatchId: batchRef.id,
        exportedAt: now,
    }));
    return {
        batchId: batchRef.id,
        count: orders.length,
        filename: `brasper-orders-${now.slice(0, 10)}-${batchRef.id.slice(0, 6)}.csv`,
        csv: ordersToCsv(exported),
    };
});
