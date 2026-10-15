import {onCall, HttpsError} from "firebase-functions/https";
import {z} from "zod";
import type {Query} from "firebase-admin/firestore";
import type {Order} from "./shared/models/order";
import {WORKFLOW_STATUSES} from "./shared/models/web-operation";
import {workflowStatus} from "./shared/domain/web-workflow";
import {db} from "./lib/firebase";
import {parse, requireStaff} from "./lib/guards";

const ListRequest = z
    .object({
        status: z.enum(WORKFLOW_STATUSES).optional(),
        currency: z.enum(["PEN", "BRL"]).optional(),
        search: z
            .object({
                field: z.enum(["docNumber", "email", "customerPhone"]),
                value: z.string().trim().min(1).max(160),
            })
            .strict()
            .optional(),
        fromDate: z.string().datetime().optional(),
        toDate: z.string().datetime().optional(),
        cursor: z
            .string()
            .regex(/^BR-\d{4,}$/)
            .optional(),
        limit: z.number().int().min(1).max(100).default(25),
    })
    .strict();
export const listOperations = onCall(async (request) => {
    await requireStaff(request, ["validator", "operator", "billing"]);
    const input = parse(ListRequest, request.data);
    let query: Query = db().collection("orders");
    // Legacy orders are deliberately not assigned a workflow without an audit migration.
    if (input.status) query = query.where("workflowStatus", "==", input.status);
    if (input.currency) query = query.where("sendCurrency", "==", input.currency);
    if (input.search) {
        if (input.status || input.currency)
            throw new HttpsError("invalid-argument", "search-or-worklist-filter");
        query = query.where(
            input.search.field,
            "==",
            input.search.field === "email"
                ? input.search.value.toLowerCase()
                : input.search.value
        );
    }
    if (input.fromDate) query = query.where("createdAt", ">=", input.fromDate);
    if (input.toDate) query = query.where("createdAt", "<=", input.toDate);
    query = query.orderBy("createdAt", "desc").orderBy("orderId", "desc");
    if (input.cursor) {
        const cursor = await db().doc(`orders/${input.cursor}`).get();
        if (!cursor.exists) throw new HttpsError("invalid-argument", "invalid-cursor");
        query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(input.limit + 1).get();
    const rows = snapshot.docs.slice(0, input.limit).map((s) => {
        const order = s.data() as Order;
        return {...order, workflowStatus: workflowStatus(order)};
    });
    return {
        operations: rows,
        nextCursor: snapshot.size > input.limit ? rows.at(-1)?.orderId : null,
    };
});
export const getOperation = onCall(async (request) => {
    await requireStaff(request, ["validator", "operator", "billing"]);
    const {orderId} = parse(
        z.object({orderId: z.string().regex(/^BR-\d{4,}$/)}),
        request.data
    );
    const ref = db().doc(`orders/${orderId}`),
        snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "order-not-found");
    const events = await ref
        .collection("events")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
    const order = snap.data() as Order;
    return {
        operation: {...order, workflowStatus: workflowStatus(order)},
        events: events.docs.map((s) => s.data()),
    };
});
export const getOperationsSummary = onCall(async (request) => {
    await requireStaff(request, ["validator", "operator", "billing"]);
    const statuses = await Promise.all(
        WORKFLOW_STATUSES.map(async (status) => {
            const result = await db()
                .collection("orders")
                .where("workflowStatus", "==", status)
                .count()
                .get();
            return [status, result.data().count];
        })
    );
    const total = (await db().collection("orders").count().get()).data().count;
    const counts = Object.fromEntries(statuses) as Record<string, number>;
    return {
        total,
        counts,
        legacyWithoutWorkflow: total - Object.values(counts).reduce((a, b) => a + b, 0),
    };
});
