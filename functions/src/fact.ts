import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {
    INVOICE_ISSUER,
    invoiceNumber,
    isReceiptReady,
} from "./shared/domain/orders";
import {isValidDocNumber, isValidEmail} from "./shared/domain/validators";
import type {Invoice} from "./shared/models/invoice";
import type {Order} from "./shared/models/order";
import {bucket, db} from "./lib/firebase";
import {nowIso, parse, requireAuth, requireStaff} from "./lib/guards";
import {buildReceiptPdf, buildTestXml, readTotalsFromXml} from "./lib/receipt";

const SERIES = "B001";

/** Per-order checks Fact runs before it spends a number. */
export const checkOrderForBilling = (order: Order): string | null => {
    if (!isValidEmail(order.email)) {
        return "invalid-email";
    }
    if (!isValidDocNumber(order.docType, order.docNumber)) {
        return "invalid-document";
    }
    if (order.commission < 0 || order.total < order.commission + order.tax) {
        return "amount-mismatch";
    }
    return null;
};

type FactResult = {
    orderId: string;
    outcome: "accepted" | "skipped" | "set-aside" | "rejected";
    detail?: string;
    invoice?: string;
};

const issueInvoice = async (order: Order): Promise<FactResult> => {
    const invoiceRef = db().doc(`invoices/${order.orderId}`);

    // Idempotency: one invoice per order, ever. The row is the lock.
    const existing = (await invoiceRef.get()).data() as Invoice | undefined;
    if (existing && (existing.status === "accepted" || existing.status === "sent")) {
        return {orderId: order.orderId, outcome: "skipped", invoice: existing.fullNumber};
    }

    const problem = checkOrderForBilling(order);
    if (problem) {
        return {orderId: order.orderId, outcome: "set-aside", detail: problem};
    }

    const counterRef = db().doc(`counters/invoice-${SERIES}`);
    const reserved = await db().runTransaction(async (tx) => {
        const current = (await tx.get(invoiceRef)).data() as Invoice | undefined;
        if (current) {
            return current;
        }
        const counter = await tx.get(counterRef);
        const number = ((counter.data()?.last as number | undefined) ?? 0) + 1;
        const now = nowIso();
        const row: Invoice = {
            orderId: order.orderId,
            uid: order.uid,
            series: SERIES,
            number,
            fullNumber: invoiceNumber(SERIES, number),
            status: "reserved",
            providerMessage: null,
            issuer: INVOICE_ISSUER[order.sendCurrency],
            currency: order.sendCurrency,
            taxableValue: order.commission,
            tax: order.tax,
            total: Number((order.commission + order.tax).toFixed(2)),
            xmlPath: `invoices/${order.orderId}.xml`,
            pdfPath: `invoices/${order.orderId}.pdf`,
            emailedAt: null,
            createdAt: now,
            updatedAt: now,
            testMode: true,
        };
        tx.set(counterRef, {last: number}, {merge: true});
        tx.set(invoiceRef, row);
        return row;
    });

    // Test-mode provider: always accepts. KeyFácil (SUNAT) / Omni plug in here
    // and may reject, in which case nothing is retried automatically.
    const xml = buildTestXml(order, reserved);
    await bucket().file(reserved.xmlPath).save(xml, {contentType: "application/xml"});

    const totals = readTotalsFromXml(xml);
    if (!totals || totals.total !== reserved.total) {
        await invoiceRef.update({
            status: "rejected",
            providerMessage: "pdf-total-differs-from-xml",
            updatedAt: nowIso(),
        });
        return {orderId: order.orderId, outcome: "rejected", detail: "pdf-total-differs-from-xml"};
    }

    const pdf = await buildReceiptPdf(order, {...reserved, ...totals});
    await bucket().file(reserved.pdfPath).save(Buffer.from(pdf), {
        contentType: "application/pdf",
    });

    const now = nowIso();
    await db().batch()
        .update(invoiceRef, {
            status: "accepted",
            providerMessage: "TEST MODE: accepted without contacting SUNAT/Omni",
            updatedAt: now,
        })
        .update(db().doc(`orders/${order.orderId}`), {
            invoiceStatus: "accepted",
            updatedAt: now,
        })
        .commit();

    return {orderId: order.orderId, outcome: "accepted", invoice: reserved.fullNumber};
};

/**
 * Fact, in test mode: for each exported order, reserve a number, register the
 * sale with a stand-in provider, keep the XML as received, build the PDF from
 * it and report the result back to the order. Safe to run twice.
 */
export const runFact = onCall({memory: "512MiB", timeoutSeconds: 120}, async (request) => {
    requireStaff(request, ["billing"]);
    const {orderIds} = parse(
        z.object({orderIds: z.array(z.string().trim().min(1).max(32)).min(1).max(100)}),
        request.data
    );

    const snaps = await db().getAll(...orderIds.map((id) => db().doc(`orders/${id}`)));
    const results: FactResult[] = [];
    for (const snap of snaps) {
        const order = snap.data() as Order | undefined;
        if (!order) {
            results.push({orderId: snap.id, outcome: "set-aside", detail: "order-not-found"});
        } else if (order.status !== "exported") {
            results.push({orderId: order.orderId, outcome: "set-aside", detail: "not-exported"});
        } else {
            results.push(await issueInvoice(order));
        }
    }
    return {results};
});

/** The client's PDF receipt (or staff's), only once Fact accepted the sale. */
export const getReceipt = onCall(async (request) => {
    const uid = requireAuth(request);
    const {orderId} = parse(z.object({orderId: z.string().trim().min(1).max(32)}), request.data);
    const invoice = (await db().doc(`invoices/${orderId}`).get()).data() as Invoice | undefined;
    if (!invoice) {
        throw new HttpsError("not-found", "receipt-not-ready");
    }
    const isStaff = Boolean(request.auth?.token.role);
    if (invoice.uid !== uid && !isStaff) {
        throw new HttpsError("permission-denied", "not-your-order");
    }
    if (!isReceiptReady(invoice)) {
        throw new HttpsError("failed-precondition", "receipt-not-ready");
    }
    const [bytes] = await bucket().file(invoice.pdfPath).download();
    return {
        filename: `${invoice.fullNumber}.pdf`,
        contentType: "application/pdf",
        base64: bytes.toString("base64"),
    };
});
