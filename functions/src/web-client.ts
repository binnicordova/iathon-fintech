import {createHash} from "node:crypto";
import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {db} from "./lib/firebase";
import {parse, requireAuth} from "./lib/guards";
import {createQuoteFor, QuoteRequest} from "./quotes";
import {createOrderFor, CreateOrderRequest} from "./orders";
import {isValidDocNumber} from "./shared/domain/validators";

export const createWebQuote = onCall(async (request) => {
    const uid = requireAuth(request),
        input = parse(QuoteRequest, request.data);
    if (
        input.sendCurrency === "USD" ||
        input.receiveCurrency === "USD" ||
        input.sendCurrency === input.receiveCurrency
    )
        throw new HttpsError("invalid-argument", "pen-brl-only");
    return createQuoteFor(uid, input);
});
export const createWebOrder = onCall(async (request) => {
    const uid = requireAuth(request);
    const schema = CreateOrderRequest.safeExtend({
        recipientName: z.string().trim().min(2).max(120),
        recipientDocument: z.string().trim().min(5).max(32),
        recipientDocumentType: z.enum(["DNI", "CE", "RUC", "CPF"]),
        billingPreference: z.enum(["boleta", "factura", "br_receipt"]),
        billingEmail: z.string().email().max(160),
        fundsReason: z.string().trim().min(3).max(500),
    });
    const input = parse(schema, request.data);
    if (!isValidDocNumber(input.recipientDocumentType, input.recipientDocument))
        throw new HttpsError("invalid-argument", "invalid-recipient-document");
    const quote = (await db().doc(`quotes/${input.quoteId}`).get()).data();
    if (!quote || quote.uid !== uid) throw new HttpsError("not-found", "quote-not-found");
    if (
        !["PEN", "BRL"].includes(quote.sendCurrency) ||
        !["PEN", "BRL"].includes(quote.receiveCurrency)
    )
        throw new HttpsError("invalid-argument", "pen-brl-only");
    if (
        (quote.receiveCurrency === "BRL" && input.billingPreference !== "br_receipt") ||
        (quote.receiveCurrency === "PEN" && input.billingPreference === "br_receipt")
    )
        throw new HttpsError("invalid-argument", "receipt-country-mismatch");
    if (
        input.billingPreference === "factura" &&
        (!input.billingName || !isValidDocNumber("RUC", input.billingDocument ?? ""))
    )
        throw new HttpsError("invalid-argument", "invoice-identity-required");
    if (input.saveAccounts && isGuest(request))
        throw new HttpsError(
            "failed-precondition",
            "registered-account-required-to-save"
        );
    const order = await createOrderFor(uid, input);
    if (input.saveAccounts) {
        const key = createHash("sha256")
            .update(
                `${order.receiveCurrency}|${order.destinationBank.toLowerCase()}|${order.destinationAccount}`
            )
            .digest("hex");
        await db()
            .doc(`recipients/${uid}/accounts/${key}`)
            .set({
                label: order.recipientName,
                name: order.recipientName,
                document: order.recipientDocument,
                bank: order.destinationBank,
                account: order.destinationAccount,
                currency: order.receiveCurrency,
                updatedAt: new Date().toISOString(),
            });
    }
    return order;
});
function isGuest(request: Parameters<typeof requireAuth>[0]) {
    return (
        request.auth?.token.sourceAnonymous === true ||
        request.auth?.token.firebase?.sign_in_provider === "anonymous"
    );
}
function registered(request: Parameters<typeof requireAuth>[0]) {
    const uid = requireAuth(request);
    if (isGuest(request))
        throw new HttpsError("permission-denied", "registered-account-required-to-save");
    return uid;
}
const Recipient = z
    .object({
        label: z.string().trim().min(1).max(80),
        name: z.string().trim().min(2).max(120),
        document: z.string().trim().min(5).max(32),
        bank: z.string().trim().min(2).max(60),
        account: z.string().trim().min(5).max(60),
        currency: z.enum(["PEN", "BRL"]),
    })
    .strict();
export const listSavedRecipients = onCall(async (request) => {
    const uid = registered(request);
    const snap = await db()
        .collection(`recipients/${uid}/accounts`)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();
    return {recipients: snap.docs.map((doc) => ({...doc.data(), id: doc.id}))};
});
export const saveRecipient = onCall(async (request) => {
    const uid = registered(request),
        input = parse(Recipient, request.data);
    const id = createHash("sha256")
        .update(`${input.currency}|${input.bank.toLowerCase()}|${input.account}`)
        .digest("hex");
    await db()
        .doc(`recipients/${uid}/accounts/${id}`)
        .set({...input, updatedAt: new Date().toISOString()});
    return {id};
});
export const deleteRecipient = onCall(async (request) => {
    const uid = registered(request);
    const {id} = parse(z.object({id: z.string().regex(/^[a-f0-9]{64}$/)}), request.data);
    await db().doc(`recipients/${uid}/accounts/${id}`).delete();
    return {ok: true};
});
