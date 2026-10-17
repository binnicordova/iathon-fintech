import {randomUUID} from "node:crypto";
import {reviewOperationFor} from "./web-workflow";
import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {formatOrderId} from "./shared/domain/orders";
import {roundMoney, roundRate} from "./shared/domain/money";
import {
    isValidAccount,
    isValidDocNumber,
    isValidEmail,
    isValidName,
    normalizeDocNumber,
} from "./shared/domain/validators";
import {CURRENCIES} from "./shared/models/currency";
import {DOC_TYPES, FUNDS_SOURCES} from "./shared/models/order";
import type {Order} from "./shared/models/order";
import {db} from "./lib/firebase";
import {ordersToCsv} from "./lib/csv";
import {nowIso, parse, requireStaff} from "./lib/guards";
import {loadPaymentAccount, loadPricing} from "./lib/settings";

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

const text = (max = 120) => z.string().trim().min(1).max(max);

const ManualOrderRequest = z
    .object({
        clientName: text(120),
        docType: z.enum(DOC_TYPES),
        docNumber: text(20),
        email: text(160),
        fundsSource: z.enum(FUNDS_SOURCES),
        sourceBank: text(60),
        sourceAccount: text(60),
        destinationBank: text(60),
        destinationAccount: text(60),
        sendCurrency: z.enum(CURRENCIES),
        receiveCurrency: z.enum(CURRENCIES),
        sendAmount: z.number().positive().max(10_000_000),
        /** The rate the seller agreed with the client, 1 send = rate receive. */
        rate: z.number().positive().max(100_000),
        /** Commission in the send currency; the tax on it is computed here. */
        commission: z.number().min(0).max(1_000_000),
    })
    .superRefine((value, ctx) => {
        const checks: Array<[boolean, string]> = [
            [value.sendCurrency !== value.receiveCurrency, "receiveCurrency"],
            [isValidName(value.clientName), "clientName"],
            [isValidDocNumber(value.docType, value.docNumber), "docNumber"],
            [isValidEmail(value.email), "email"],
            [isValidAccount(value.sourceAccount), "sourceAccount"],
            [isValidAccount(value.destinationAccount), "destinationAccount"],
        ];
        for (const [ok, path] of checks) {
            if (!ok) {
                ctx.addIssue({code: "custom", path: [path], message: "invalid"});
            }
        }
    });

/**
 * A seller closed the deal by phone or chat ("Hablar con una persona") and
 * registers it here, so it follows the same path as every other operation.
 * The rate and commission are the ones negotiated; the tax and the totals are
 * computed on the server. The order belongs to the staff member who creates it
 * (so they can attach the proof with submitProof) and is marked channel "human".
 */
export const createManualOrder = onCall(async (request) => {
    const staff = await requireStaff(request, ["validator", "operator"]);
    const input = parse(ManualOrderRequest, request.data);
    const pricing = await loadPricing();
    const paymentAccount = await loadPaymentAccount(input.sendCurrency);

    const sendAmount = roundMoney(input.sendAmount);
    const commission = roundMoney(input.commission);
    if (commission >= sendAmount) {
        throw new HttpsError("invalid-argument", "commission-too-high");
    }
    const tax = roundMoney((commission * pricing.taxBps) / 10000);
    const rate = roundRate(input.rate);
    if (rate <= 0 || roundMoney(sendAmount * rate) <= 0)
        throw new HttpsError("invalid-argument", "rate-too-small");
    const counterRef = db().doc("counters/orders");

    const order = await db().runTransaction(async (tx) => {
        const counter = await tx.get(counterRef);
        const seq = ((counter.data()?.seq as number | undefined) ?? 0) + 1;
        const orderId = formatOrderId(seq);
        const now = new Date();
        const created = now.toISOString();
        const next: Order = {
            orderId,
            seq,
            uid: staff.uid,
            channel: "human",
            workflowStatus: "awaiting_payment",
            revision: 0,
            sourceSystem: staff.uid.startsWith("supabase:") ? "supabase" : "firebase",
            language: "es",
            status: "pending",
            createdAt: created,
            updatedAt: created,
            quoteId: "manual",
            clientName: input.clientName,
            docType: input.docType,
            docNumber: normalizeDocNumber(input.docType, input.docNumber),
            email: input.email.toLowerCase(),
            fundsSource: input.fundsSource,
            sourceBank: input.sourceBank,
            sourceAccount: input.sourceAccount,
            destinationBank: input.destinationBank,
            destinationAccount: input.destinationAccount,
            sendAmount,
            sendCurrency: input.sendCurrency,
            receiveAmount: roundMoney(sendAmount * rate),
            receiveCurrency: input.receiveCurrency,
            rate,
            marketRate: rate,
            commission,
            tax,
            total: roundMoney(sendAmount + commission + tax),
            rateLockedUntil: new Date(
                now.getTime() + pricing.rateLockMinutes * 60_000
            ).toISOString(),
            paymentAccount,
            operationNo: null,
            paymentProofPath: null,
            proofSubmittedAt: null,
            validatedBy: null,
            validatedAt: null,
            rejectionReason: null,
            exportBatchId: null,
            exportedAt: null,
            invoiceStatus: null,
            createdBy: staff.email,
        };
        tx.set(counterRef, {seq}, {merge: true});
        tx.set(db().doc(`orders/${orderId}`), next);
        tx.set(db().doc(`orders/${orderId}/events/created`), {
            id: "created",
            orderId,
            actor: staff.uid,
            action: "created_manual",
            note: "",
            createdAt: created,
            from: "awaiting_payment",
            to: "awaiting_payment",
        });
        return next;
    });
    return order;
});
