import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {formatOrderId} from "./shared/domain/orders";
import {
    isValidAccount,
    isValidDocNumber,
    isValidEmail,
    isValidName,
    isValidOperationNo,
    normalizeDocNumber,
} from "./shared/domain/validators";
import {LANGUAGES} from "./shared/models/currency";
import {DOC_TYPES, FUNDS_SOURCES, type Order} from "./shared/models/order";
import type {Quote} from "./shared/models/quote";
import type {ClientProfile} from "./shared/models/client";
import {bucket, db} from "./lib/firebase";
import {nowIso, parse, requireAuth} from "./lib/guards";
import {loadPaymentAccount, loadPricing} from "./lib/settings";

const text = (max = 120) => z.string().trim().min(1).max(max);

const CreateOrderRequest = z
    .object({
        quoteId: text(64),
        language: z.enum(LANGUAGES).default("es"),
        clientName: text(120),
        docType: z.enum(DOC_TYPES),
        docNumber: text(20),
        email: text(160),
        fundsSource: z.enum(FUNDS_SOURCES),
        sourceBank: text(60),
        sourceAccount: text(60),
        destinationBank: text(60),
        destinationAccount: text(60),
    })
    .superRefine((value, ctx) => {
        const checks: Array<[boolean, string]> = [
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
 * Creates the "IV" (Intención de Venta): one record, whether it came from the
 * form or the assistant. Rate, fees and the payment account come from the
 * server and the frozen quote, never from the request.
 */
export const createOrder = onCall(async (request) => {
    const uid = requireAuth(request);
    const input = parse(CreateOrderRequest, request.data);
    const pricing = await loadPricing();

    const quoteRef = db().doc(`quotes/${input.quoteId}`);
    const counterRef = db().doc("counters/orders");

    const preview = (await quoteRef.get()).data() as Quote | undefined;
    if (!preview) {
        throw new HttpsError("not-found", "quote-not-found");
    }
    const paymentAccount = await loadPaymentAccount(preview.sendCurrency);

    const order = await db().runTransaction(async (tx) => {
        const [quoteSnap, counterSnap] = await Promise.all([
            tx.get(quoteRef),
            tx.get(counterRef),
        ]);
        const quote = quoteSnap.data() as Quote | undefined;
        if (!quote || quote.uid !== uid) {
            throw new HttpsError("not-found", "quote-not-found");
        }
        if (quote.status !== "open") {
            throw new HttpsError("failed-precondition", "quote-already-used");
        }
        const now = new Date();
        if (now.getTime() > new Date(quote.expiresAt).getTime()) {
            throw new HttpsError("deadline-exceeded", "quote-expired");
        }

        const seq = ((counterSnap.data()?.seq as number | undefined) ?? 0) + 1;
        const orderId = formatOrderId(seq);
        const created = now.toISOString();
        const docNumber = normalizeDocNumber(input.docType, input.docNumber);

        const next: Order = {
            orderId,
            seq,
            uid,
            channel: quote.channel,
            language: input.language,
            status: "pending",
            createdAt: created,
            updatedAt: created,
            quoteId: quote.id,
            clientName: input.clientName,
            docType: input.docType,
            docNumber,
            email: input.email.toLowerCase(),
            fundsSource: input.fundsSource,
            sourceBank: input.sourceBank,
            sourceAccount: input.sourceAccount,
            destinationBank: input.destinationBank,
            destinationAccount: input.destinationAccount,
            sendAmount: quote.sendAmount,
            sendCurrency: quote.sendCurrency,
            receiveAmount: quote.receiveAmount,
            receiveCurrency: quote.receiveCurrency,
            rate: quote.rate,
            marketRate: quote.marketRate,
            commission: quote.commission,
            tax: quote.tax,
            total: quote.total,
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
        };

        tx.set(counterRef, {seq}, {merge: true});
        tx.set(db().doc(`orders/${orderId}`), next);
        tx.update(quoteRef, {status: "consumed", orderId});
        return next;
    });

    // Saved for next time, so a returning client does not retype.
    const profile: ClientProfile = {
        clientName: input.clientName,
        email: input.email.toLowerCase(),
        docType: input.docType,
        docNumber: order.docNumber,
        language: input.language,
        accounts: [],
        updatedAt: nowIso(),
    };
    const profileRef = db().doc(`clients/${uid}`);
    const existing = (await profileRef.get()).data() as ClientProfile | undefined;
    const accounts = new Map(
        (existing?.accounts ?? []).map((a) => [`${a.bank}|${a.accountNumber}`, a])
    );
    const addAccount = (bank: string, accountNumber: string, currency: Order["sendCurrency"]) => {
        const key = `${bank}|${accountNumber}`;
        if (!accounts.has(key)) {
            accounts.set(key, {id: key, bank, accountNumber, currency});
        }
    };
    addAccount(order.sourceBank, order.sourceAccount, order.sendCurrency);
    addAccount(order.destinationBank, order.destinationAccount, order.receiveCurrency);
    await profileRef.set({...profile, accounts: [...accounts.values()].slice(-12)});

    return order;
});

const SubmitProofRequest = z.object({
    orderId: text(32),
    operationNo: text(24),
    proofPath: text(300),
});

const MAX_PROOF_BYTES = 8 * 1024 * 1024;

/**
 * Saves the bank operation number and the proof photo and moves the order to
 * "validating". The assistant never judges the proof: a person does, in the
 * VIEW.
 */
export const submitProof = onCall(async (request) => {
    const uid = requireAuth(request);
    const input = parse(SubmitProofRequest, request.data);

    if (!isValidOperationNo(input.operationNo)) {
        throw new HttpsError("invalid-argument", "invalid-operation-no");
    }
    const prefix = `proofs/${uid}/${input.orderId}/`;
    if (!input.proofPath.startsWith(prefix) || input.proofPath.includes("..")) {
        throw new HttpsError("invalid-argument", "invalid-proof-path");
    }
    const file = bucket().file(input.proofPath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new HttpsError("failed-precondition", "proof-not-uploaded");
    }
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) > MAX_PROOF_BYTES) {
        throw new HttpsError("invalid-argument", "proof-too-large");
    }

    const operationNo = input.operationNo.trim().toUpperCase();
    // The same bank operation number on two orders is the classic reuse fraud.
    const duplicate = await db()
        .collection("orders")
        .where("operationNo", "==", operationNo)
        .limit(3)
        .get();
    const clash = duplicate.docs.find(
        (doc) =>
            doc.id !== input.orderId &&
            !["cancelled", "rejected"].includes(doc.data().status)
    );
    if (clash) {
        throw new HttpsError("already-exists", "operation-no-duplicate");
    }

    const ref = db().doc(`orders/${input.orderId}`);
    await db().runTransaction(async (tx) => {
        const order = (await tx.get(ref)).data() as Order | undefined;
        if (!order || order.uid !== uid) {
            throw new HttpsError("not-found", "order-not-found");
        }
        if (order.status !== "pending") {
            throw new HttpsError("failed-precondition", "order-not-pending");
        }
        const now = nowIso();
        tx.update(ref, {
            status: "validating",
            operationNo,
            paymentProofPath: input.proofPath,
            proofSubmittedAt: now,
            updatedAt: now,
        });
    });
    return {ok: true, orderId: input.orderId};
});

export const cancelOrder = onCall(async (request) => {
    const uid = requireAuth(request);
    const {orderId} = parse(z.object({orderId: text(32)}), request.data);
    const ref = db().doc(`orders/${orderId}`);
    await db().runTransaction(async (tx) => {
        const order = (await tx.get(ref)).data() as Order | undefined;
        if (!order || order.uid !== uid) {
            throw new HttpsError("not-found", "order-not-found");
        }
        if (order.status !== "pending") {
            throw new HttpsError("failed-precondition", "order-not-pending");
        }
        tx.update(ref, {status: "cancelled", updatedAt: nowIso()});
    });
    return {ok: true, orderId};
});

