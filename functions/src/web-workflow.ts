import {createHash} from "node:crypto";
import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import type {Order} from "./shared/models/order";
import {legacyStatus, nextWorkflow, workflowStatus} from "./shared/domain/web-workflow";
import {isValidOperationNo} from "./shared/domain/validators";
import {db, bucket} from "./lib/firebase";
import {nowIso, parse, requireAuth, requireStaff} from "./lib/guards";

const id = z.string().regex(/^BR-\d{4,}$/);
const requestId = z.string().uuid();
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const operationKey = (currency: string, bank: string, reference: string) =>
    digest(
        [currency, bank.trim().toLowerCase(), reference.trim().toUpperCase()].join("|")
    );

/** Inspect the actual object, not just the MIME supplied by the browser. */
export async function checkProof(path: string, prefix: string) {
    if (!path.startsWith(prefix) || path.includes("..") || path.length > 300)
        throw new HttpsError("invalid-argument", "invalid-proof-path");
    const file = bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("failed-precondition", "proof-not-uploaded");
    const [meta] = await file.getMetadata();
    const size = Number(meta.size);
    if (!Number.isFinite(size) || size < 4 || size > 8 * 1024 * 1024)
        throw new HttpsError("invalid-argument", "proof-too-large");
    const chunks: Buffer[] = [];
    for await (const chunk of file.createReadStream({start: 0, end: 15}))
        chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
    const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (
        !(pdf && meta.contentType === "application/pdf") &&
        !(png && meta.contentType === "image/png") &&
        !(jpeg && meta.contentType === "image/jpeg")
    )
        throw new HttpsError("invalid-argument", "unsupported-proof");
    return {generation: meta.generation, size};
}

export async function submitProofFor(
    uid: string,
    input: {orderId: string; operationNo: string; proofPath: string}
) {
    if (!/^BR-\d{4,}$/.test(input.orderId) || !isValidOperationNo(input.operationNo))
        throw new HttpsError("invalid-argument", "invalid-operation-no");
    const ref = db().doc(`orders/${input.orderId}`);
    const preview = (await ref.get()).data() as Order | undefined;
    if (!preview || preview.uid !== uid)
        throw new HttpsError("not-found", "order-not-found");
    const checked = await checkProof(input.proofPath, `proofs/${uid}/${input.orderId}/`);
    const operationNo = input.operationNo.trim().toUpperCase();
    const key = operationKey(preview.sendCurrency, preview.sourceBank, operationNo);
    const lock = db().doc(`operationReferences/${key}`);
    await db().runTransaction(async (tx) => {
        const [snap, reserved] = await Promise.all([tx.get(ref), tx.get(lock)]);
        const order = snap.data() as Order | undefined;
        if (!order || order.uid !== uid)
            throw new HttpsError("not-found", "order-not-found");
        if (reserved.exists && reserved.data()?.orderId !== input.orderId)
            throw new HttpsError("already-exists", "operation-no-duplicate");
        if (
            workflowStatus(order) === "proof_submitted" &&
            order.paymentProofPath === input.proofPath &&
            order.operationNo === operationNo
        )
            return;
        if (workflowStatus(order) !== "awaiting_payment")
            throw new HttpsError("failed-precondition", "order-not-pending");
        const now = nowIso(),
            revision = (order.revision ?? 0) + 1;
        tx.set(lock, {orderId: input.orderId, createdAt: now});
        tx.update(ref, {
            status: "validating",
            workflowStatus: "proof_submitted",
            operationNo,
            paymentProofPath: input.proofPath,
            proofSubmittedAt: now,
            proofGeneration: checked.generation,
            updatedAt: now,
            revision,
        });
        tx.set(ref.collection("events").doc(`proof-${revision}`), {
            id: `proof-${revision}`,
            orderId: input.orderId,
            actor: uid,
            action: "submit_proof",
            note: "",
            createdAt: now,
            from: "awaiting_payment",
            to: "proof_submitted",
        });
    });
}
export async function cancelOwnOrder(uid: string, orderId: string) {
    const ref = db().doc(`orders/${orderId}`);
    await db().runTransaction(async (tx) => {
        const order = (await tx.get(ref)).data() as Order | undefined;
        if (!order || order.uid !== uid)
            throw new HttpsError("not-found", "order-not-found");
        if (workflowStatus(order) === "cancelled") return;
        if (workflowStatus(order) !== "awaiting_payment")
            throw new HttpsError("failed-precondition", "order-not-pending");
        const now = nowIso();
        tx.update(ref, {
            status: "cancelled",
            workflowStatus: "cancelled",
            revision: (order.revision ?? 0) + 1,
            updatedAt: now,
        });
        tx.set(ref.collection("events").doc("customer-cancel"), {
            id: "customer-cancel",
            orderId,
            actor: uid,
            action: "cancel",
            note: "Customer cancelled before payment",
            createdAt: now,
            from: "awaiting_payment",
            to: "cancelled",
        });
    });
}

export const ReviewOperationRequest = z
    .object({
        orderId: id,
        requestId,
        expectedRevision: z.number().int().nonnegative(),
        action: z.enum(["verify", "request_proof", "reject", "cancel", "payout"]),
        note: z.string().trim().max(500).default(""),
        confirmation: z.string().optional(),
        payoutPath: z.string().max(300).optional(),
        payoutReference: z.string().trim().min(3).max(100).optional(),
    })
    .strict();

export async function reviewOperationFor(
    actor: string,
    input: z.infer<typeof ReviewOperationRequest>
) {
    if (input.action === "cancel" && input.confirmation !== input.orderId)
        throw new HttpsError("failed-precondition", "cancellation-confirmation-required");
    if (["reject", "request_proof", "cancel"].includes(input.action) && !input.note)
        throw new HttpsError("invalid-argument", "reason-required");
    const ref = db().doc(`orders/${input.orderId}`),
        event = ref.collection("events").doc(input.requestId);
    const fingerprint = digest(JSON.stringify(input));
    const preview = (await ref.get()).data() as Order | undefined;
    if (!preview) throw new HttpsError("not-found", "order-not-found");
    if (input.action === "payout") {
        if (!input.payoutReference || !input.payoutPath)
            throw new HttpsError("invalid-argument", "payout-evidence-required");
        await checkProof(input.payoutPath, `payouts/${input.orderId}/`);
    }
    return db().runTransaction(async (tx) => {
        const [snap, prior] = await Promise.all([tx.get(ref), tx.get(event)]);
        if (prior.exists) {
            if (
                prior.data()?.fingerprint !== fingerprint ||
                prior.data()?.actor !== actor
            )
                throw new HttpsError("already-exists", "idempotency-key-conflict");
            return {ok: true, replayed: true};
        }
        const order = snap.data() as Order | undefined;
        if (!order) throw new HttpsError("not-found", "order-not-found");
        if ((order.revision ?? 0) !== input.expectedRevision)
            throw new HttpsError("aborted", "stale-operation-reload");
        const from = workflowStatus(order);
        let to;
        try {
            to = nextWorkflow(from, input.action);
        } catch {
            throw new HttpsError("failed-precondition", "invalid-workflow-transition");
        }
        if (input.action === "verify" && !order.paymentProofPath)
            throw new HttpsError("failed-precondition", "missing-proof");
        const now = nowIso();
        const patch: Record<string, unknown> = {
            workflowStatus: to,
            status: legacyStatus(to),
            updatedAt: now,
            revision: (order.revision ?? 0) + 1,
        };
        if (input.action === "verify" || input.action === "reject")
            Object.assign(patch, {
                validatedBy: actor,
                validatedAt: now,
                rejectionReason: input.action === "reject" ? input.note : null,
            });
        if (input.action === "payout")
            Object.assign(patch, {
                payoutPath: input.payoutPath,
                payoutReference: input.payoutReference,
                payoutAt: now,
                payoutBy: actor,
            });
        tx.update(ref, patch);
        tx.create(event, {
            id: input.requestId,
            orderId: input.orderId,
            actor,
            action: input.action,
            note: input.note,
            createdAt: now,
            from,
            to,
            fingerprint,
        });
        return {ok: true, replayed: false};
    });
}
export const reviewOperation = onCall(async (request) => {
    const input = parse(ReviewOperationRequest, request.data);
    const staff = await requireStaff(
        request,
        input.action === "payout" ? ["operator"] : ["validator"]
    );
    return reviewOperationFor(staff.uid, input);
});

export const getOperationProof = onCall(async (request) => {
    const uid = requireAuth(request);
    const input = parse(
        z.object({orderId: id, kind: z.enum(["deposit", "payout"])}),
        request.data
    );
    const order = (await db().doc(`orders/${input.orderId}`).get()).data() as
        | Order
        | undefined;
    if (!order) throw new HttpsError("not-found", "order-not-found");
    if (order.uid !== uid)
        await requireStaff(request, ["validator", "operator", "billing"]);
    const path = input.kind === "deposit" ? order.paymentProofPath : order.payoutPath;
    if (!path) throw new HttpsError("not-found", "proof-not-uploaded");
    const [url] = await bucket()
        .file(path)
        .getSignedUrl({action: "read", expires: Date.now() + 5 * 60_000});
    return {url, expiresIn: 300};
});
