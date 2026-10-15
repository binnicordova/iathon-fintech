import {randomUUID} from "node:crypto";
import {reviewOperationFor} from "./web-workflow";
import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import type {Order} from "./shared/models/order";
import {db} from "./lib/firebase";
import {ordersToCsv} from "./lib/csv";
import {nowIso, parse, requireStaff} from "./lib/guards";

const OrderIds = z.array(z.string().trim().min(1).max(32)).min(1).max(200);

const ReviewRequest = z.object({
    orderId: z.string().trim().min(1).max(32),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).nullish(),
});

/** The validator checked the bank and the proof photo: records who and when. */
export const reviewOrder = onCall(async (request) => {
    const staff = await requireStaff(request, ["validator"]);
    const input = parse(ReviewRequest, request.data);
    if (input.decision === "reject" && !input.reason) {
        throw new HttpsError("invalid-argument", "reason-required");
    }

    const snap = await db().doc(`orders/${input.orderId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "order-not-found");
    await reviewOperationFor(staff.uid, {
        orderId: input.orderId,
        action: input.decision === "approve" ? "verify" : "reject",
        expectedRevision: snap.data()?.revision ?? 0,
        requestId: randomUUID(),
        note: input.reason ?? "",
    });
    return {ok: true};
});

/**
 * The operator marks approved orders and exports the file for the Dashboard.
 * Everything exported is recorded in a batch, and the orders move to
 * "exported" in the same step.
 */
export const exportOrders = onCall(async (request) => {
    const staff = await requireStaff(request, ["operator"]);
    const {orderIds} = parse(z.object({orderIds: OrderIds}), request.data);

    const now = nowIso();
    const batchRef = db().collection("batches").doc();
    const orders = await db().runTransaction(async (tx) => {
        const refs = orderIds.map((value) => db().doc(`orders/${value}`));
        const snapshots = await tx.getAll(...refs);
        const rows = snapshots.map((snap) => snap.data() as Order | undefined);
        if (
            new Set(orderIds).size !== orderIds.length ||
            rows.some((order) => !order || order.status !== "approved")
        )
            throw new HttpsError("failed-precondition", "only-approved-orders");
        tx.set(batchRef, {
            id: batchRef.id,
            type: "export",
            orderIds,
            createdBy: staff.email,
            createdAt: now,
        });
        for (const [index, row] of rows.entries()) {
            const order = row!;
            tx.update(refs[index]!, {
                status: "exported",
                exportBatchId: batchRef.id,
                exportedAt: now,
                updatedAt: now,
                revision: (order.revision ?? 0) + 1,
            });
            tx.set(refs[index]!.collection("events").doc(`export-${batchRef.id}`), {
                id: `export-${batchRef.id}`,
                orderId: order.orderId,
                actor: staff.uid,
                action: "export",
                note: "Export is not proof of payout",
                createdAt: now,
                from: "verified",
                to: "verified",
            });
        }
        return rows as Order[];
    });
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
