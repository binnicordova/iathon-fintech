import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {formatOrderId} from "./shared/domain/orders";
import {
    isValidAccount,
    isValidDocNumber,
    isValidEmail,
    isValidName,
    normalizeDocNumber,
} from "./shared/domain/validators";
import {LANGUAGES} from "./shared/models/currency";
import {DOC_TYPES, FUNDS_SOURCES, type Order} from "./shared/models/order";
import type {Quote} from "./shared/models/quote";
import type {ClientProfile} from "./shared/models/client";
import {db} from "./lib/firebase";
import {nowIso, parse, requireAuth} from "./lib/guards";
import {submitProofFor, cancelOwnOrder} from "./web-workflow";
import {loadPaymentAccount, loadPricing} from "./lib/settings";

const text = (max = 120) => z.string().trim().min(1).max(max);

export const CreateOrderRequest = z
    .object({
        quoteId: text(64),
        language: z.enum(LANGUAGES).default("es"),
        clientName: text(120),
        docType: z.enum(DOC_TYPES),
        docNumber: text(20),
        email: text(160),
        fundsSource: z.enum(FUNDS_SOURCES),
        sourceBank: text(60),
        // The client only names the bank they pay from; the number is optional.
        sourceAccount: z.string().trim().max(60).default(""),
        destinationBank: text(60),
        destinationAccount: text(60),
        recipientName: text(120).optional(),
        recipientDocument: text(32).optional(),
        recipientDocumentType: z.enum(DOC_TYPES).optional(),
        customerPhone: z
            .string()
            .regex(/^\+?[1-9]\d{7,14}$/)
            .optional(),
        billingPreference: z.enum(["boleta", "factura", "br_receipt"]).optional(),
        billingEmail: z.string().email().max(160).optional(),
        billingName: text(160).optional(),
        billingDocument: text(32).optional(),
        fundsReason: text(500).optional(),
        saveAccounts: z.boolean().default(false),
    })
    .superRefine((value, ctx) => {
        const checks: Array<[boolean, string]> = [
            [isValidName(value.clientName), "clientName"],
            [isValidDocNumber(value.docType, value.docNumber), "docNumber"],
            [isValidEmail(value.email), "email"],
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
export async function createOrderFor(
    uid: string,
    input: z.infer<typeof CreateOrderRequest>
) {
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
        if (quote.status === "consumed" && quote.orderId) {
            const previous = (await tx.get(db().doc(`orders/${quote.orderId}`))).data() as
                | Order
                | undefined;
            if (previous?.uid === uid) return previous;
        }
        if (quote.status !== "open")
            throw new HttpsError("failed-precondition", "quote-already-used");
        const now = new Date();
        if (now.getTime() > new Date(quote.expiresAt).getTime()) {
            throw new HttpsError("deadline-exceeded", "quote-expired");
        }

        const seq = ((counterSnap.data()?.seq as number | undefined) ?? 0) + 1;
        const orderId = formatOrderId(seq);
        const created = now.toISOString();
        const docNumber = normalizeDocNumber(input.docType, input.docNumber);

        const next: Order = {
            ...Object.fromEntries(
                Object.entries(input).filter(
                    ([key]) => !["quoteId", "language"].includes(key)
                )
            ),
            workflowStatus: "awaiting_payment",
            sourceSystem: uid.startsWith("supabase:") ? "supabase" : "firebase",
            revision: 0,
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
        tx.set(db().doc(`orders/${orderId}/events/created`), {
            id: "created",
            orderId,
            actor: uid,
            action: "created",
            note: "",
            createdAt: created,
            from: "awaiting_payment",
            to: "awaiting_payment",
        });
        tx.update(quoteRef, {status: "consumed", orderId});
        return next;
    });

    if (!input.saveAccounts) return order;
    // Opt-in; do not save a guest's accounts merely because they created an order.
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
    const addAccount = (
        bank: string,
        accountNumber: string,
        currency: Order["sendCurrency"]
    ) => {
        const key = `${bank}|${accountNumber}`;
        if (!accounts.has(key)) {
            accounts.set(key, {id: key, bank, accountNumber, currency});
        }
    };
    if (order.sourceAccount) {
        addAccount(order.sourceBank, order.sourceAccount, order.sendCurrency);
    }
    addAccount(order.destinationBank, order.destinationAccount, order.receiveCurrency);
    await profileRef.set({...profile, accounts: [...accounts.values()].slice(-12)});

    return order;
}
export const createOrder = onCall(async (request) => {
    const uid = requireAuth(request),
        input = parse(CreateOrderRequest, request.data);
    if (
        input.saveAccounts &&
        (request.auth?.token.sourceAnonymous === true ||
            request.auth?.token.firebase?.sign_in_provider === "anonymous")
    )
        throw new HttpsError("permission-denied", "registered-account-required-to-save");
    return createOrderFor(uid, input);
});

const SubmitProofRequest = z.object({
    orderId: text(32),
    operationNo: text(24),
    proofPath: text(300),
});
export const submitProof = onCall(async (request) => {
    const uid = requireAuth(request);
    const input = parse(SubmitProofRequest, request.data);
    await submitProofFor(uid, input);
    return {ok: true, orderId: input.orderId};
});
export const cancelOrder = onCall(async (request) => {
    const uid = requireAuth(request);
    const {orderId} = parse(z.object({orderId: text(32)}), request.data);
    await cancelOwnOrder(uid, orderId);
    return {ok: true, orderId};
});
