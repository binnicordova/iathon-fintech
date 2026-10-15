// No credentials and no production project: this suite must run inside emulators:exec.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require = createRequire(import.meta.url);
if (
    !process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:") ||
    !process.env.FIREBASE_STORAGE_EMULATOR_HOST?.startsWith("127.0.0.1:") ||
    !process.env.GCLOUD_PROJECT?.startsWith("demo-")
)
    throw Error("Emulators with demo-* project required");
process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: process.env.GCLOUD_PROJECT,
    storageBucket: process.env.GCLOUD_PROJECT + ".appspot.com",
});
const {db, bucket} = require("../lib/lib/firebase.js");
const {
    createWebOrder,
    listSavedRecipients,
    saveRecipient,
} = require("../lib/web-client.js");
const {submitProof, createOrderFor, CreateOrderRequest} = require("../lib/orders.js");
const {reviewOperation, getOperationProof} = require("../lib/web-workflow.js");
const {listOperations, getOperationsSummary} = require("../lib/dashboard.js");
const {exportOrders, createManualOrder} = require("../lib/staff.js");
const {
    getOperationsConfig,
    updateOperationsConfig,
} = require("../lib/operations-config.js");
const {loadMarketRates} = require("../lib/lib/rates.js");
const {verifiedSupabaseIdentity} = require("../lib/supabase-session.js");
const call = (fn, uid, data, role) =>
    fn.run({data, auth: {uid, token: {role, firebase: {sign_in_provider: "password"}}}});
const customer = "customer-test",
    other = "other-test";
const input = (quoteId) => ({
    quoteId,
    language: "es",
    clientName: "Cliente Prueba",
    docType: "DNI",
    docNumber: "12345678",
    email: "test@example.com",
    fundsSource: "salary",
    sourceBank: "BCP",
    sourceAccount: "1234567890",
    destinationBank: "Nubank",
    destinationAccount: "9876543210",
    recipientName: "Persona Destino",
    recipientDocument: "12345678",
    recipientDocumentType: "DNI",
    billingPreference: "br_receipt",
    billingEmail: "test@example.com",
    fundsReason: "Sueldo mensual",
});
async function quote(id, uid = customer) {
    await db()
        .doc("quotes/" + id)
        .set({
            id,
            uid,
            channel: "form",
            status: "open",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            sendCurrency: "PEN",
            receiveCurrency: "BRL",
            sendAmount: 100,
            receiveAmount: 140,
            rate: 1.4,
            marketRate: 1.5,
            commission: 2,
            tax: 0.36,
            total: 102.36,
            requiresHuman: false,
        });
}
let passed = 0;
async function test(name, fn) {
    await fn();
    passed++;
    console.log("PASS " + name);
}
await test("Supabase identity is verified remotely; metadata cannot grant roles", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
        Response.json({
            id: "11111111-1111-4111-8111-111111111111",
            is_anonymous: false,
            user_metadata: {role: "admin"},
        });
    try {
        const user = await verifiedSupabaseIdentity(
            "a.b.c",
            "https://lfjnywpvunfrvkgcfobl.supabase.co",
            "public"
        );
        assert.equal(user.uid, "supabase:11111111-1111-4111-8111-111111111111");
        assert.equal(user.role, undefined);
        globalThis.fetch = async () => new Response("", {status: 401});
        await assert.rejects(() =>
            verifiedSupabaseIdentity(
                "a.b.c",
                "https://lfjnywpvunfrvkgcfobl.supabase.co",
                "public"
            )
        );
        await assert.rejects(() =>
            verifiedSupabaseIdentity("a.b.c", "http://localhost", "public")
        );
    } finally {
        globalThis.fetch = original;
    }
});
await quote("q-one");
let order;
await test("Concurrent create consumes the quote once, ignores supplied amount/status", async () => {
    const rows = await Promise.all([
        call(createWebOrder, customer, {
            ...input("q-one"),
            amount: 1,
            status: "exported",
        }),
        call(createWebOrder, customer, input("q-one")),
    ]);
    assert.equal(rows[0].orderId, rows[1].orderId);
    order = rows[0];
    assert.equal(order.sendAmount, 100);
    assert.equal(order.workflowStatus, "awaiting_payment");
    assert.equal((await db().collection("orders").get()).size, 1);
});
await test("Other owner cannot consume a quote or view the staff dashboard", async () => {
    await assert.rejects(() => call(createWebOrder, other, input("q-one")));
    await assert.rejects(() => call(listOperations, customer, {}));
});
await test("Guest can create but cannot save accounts", async () => {
    await quote("q-guest", "guest");
    const req = {
        data: {...input("q-guest"), saveAccounts: true},
        auth: {uid: "guest", token: {firebase: {sign_in_provider: "anonymous"}}},
    };
    await assert.rejects(() => createWebOrder.run(req));
    req.data.saveAccounts = false;
    assert.ok((await createWebOrder.run(req)).orderId);
});
await test("Bridged staff requires an explicit Firebase grant", async () => {
    await assert.rejects(() => call(listOperations, "supabase:unassigned", {}, "admin"));
    await db().doc("supabaseStaff/supabase:assigned").set({role: "validator"});
    assert.ok((await call(listOperations, "supabase:assigned", {})).operations.length);
    await db().doc("supabaseStaff/supabase:assigned").delete();
    await assert.rejects(() => call(listOperations, "supabase:assigned", {}));
});
const proof = `proofs/${customer}/${order.orderId}/proof.pdf`;
await bucket()
    .file(proof)
    .save(Buffer.from("%PDF-1.7\nprivate test"), {contentType: "application/pdf"});
await test("Proof owner/path and bytes are enforced; exact retries are idempotent", async () => {
    await assert.rejects(() =>
        call(submitProof, other, {
            orderId: order.orderId,
            operationNo: "12345678",
            proofPath: proof,
        })
    );
    const fake = `proofs/${customer}/${order.orderId}/fake.pdf`;
    await bucket().file(fake).save("not a PDF", {contentType: "application/pdf"});
    await assert.rejects(() =>
        call(submitProof, customer, {
            orderId: order.orderId,
            operationNo: "12345678",
            proofPath: fake,
        })
    );
    const data = {orderId: order.orderId, operationNo: "12345678", proofPath: proof};
    await call(submitProof, customer, data);
    await call(submitProof, customer, data);
    assert.equal((await db().doc(`orders/${order.orderId}`).get()).data().revision, 1);
});
await test("Concurrent reuse of the same bank reference permits only one new order", async () => {
    const rows = [];
    for (const q of ["q-dup-a", "q-dup-b"]) {
        await quote(q);
        rows.push(await call(createWebOrder, customer, input(q)));
    }
    for (const row of rows)
        await bucket()
            .file(`proofs/${customer}/${row.orderId}/proof.pdf`)
            .save("%PDF-1.7\ntest", {contentType: "application/pdf"});
    const results = await Promise.allSettled(
        rows.map((row) =>
            call(submitProof, customer, {
                orderId: row.orderId,
                operationNo: "99999999",
                proofPath: `proofs/${customer}/${row.orderId}/proof.pdf`,
            })
        )
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
await test("Review is role-gated, versioned and idempotent", async () => {
    const data = {
        orderId: order.orderId,
        requestId: randomUUID(),
        expectedRevision: 1,
        action: "verify",
        note: "Ingreso bancario comprobado",
    };
    await assert.rejects(() => call(reviewOperation, "operator", data, "operator"));
    assert.equal(
        (await call(reviewOperation, "validator", data, "validator")).replayed,
        false
    );
    assert.equal(
        (await call(reviewOperation, "validator", data, "validator")).replayed,
        true
    );
    await assert.rejects(() =>
        call(reviewOperation, "validator", {...data, note: "changed"}, "validator")
    );
    await assert.rejects(() =>
        call(
            reviewOperation,
            "validator",
            {...data, requestId: randomUUID()},
            "validator"
        )
    );
    const saved = (await db().doc(`orders/${order.orderId}`).get()).data();
    assert.equal(saved.workflowStatus, "verified");
    assert.equal(saved.payoutAt, undefined);
});
await test("Export records no payout and does not prevent a later real payout record", async () => {
    await call(exportOrders, "operator", {orderIds: [order.orderId]}, "operator");
    const data = (await db().doc(`orders/${order.orderId}`).get()).data();
    assert.equal(data.workflowStatus, "verified");
    assert.equal(data.payoutAt, undefined);
});
await test("Cancellation requires explicit confirmation; payout requires evidence and operator", async () => {
    const current = (await db().doc(`orders/${order.orderId}`).get()).data();
    await assert.rejects(() =>
        call(
            reviewOperation,
            "validator",
            {
                orderId: order.orderId,
                requestId: randomUUID(),
                expectedRevision: current.revision,
                action: "cancel",
                note: "reason",
            },
            "validator"
        )
    );
    const payoutPath = `payouts/${order.orderId}/out.pdf`;
    await bucket()
        .file(payoutPath)
        .save("%PDF-1.7\nout", {contentType: "application/pdf"});
    const data = {
        orderId: order.orderId,
        requestId: randomUUID(),
        expectedRevision: current.revision,
        action: "payout",
        payoutPath,
        payoutReference: "OUT-123",
    };
    await assert.rejects(() => call(reviewOperation, "validator", data, "validator"));
    await call(reviewOperation, "operator", data, "operator");
    await call(reviewOperation, "operator", data, "operator");
    assert.equal(
        (await db().doc(`orders/${order.orderId}`).get()).data().workflowStatus,
        "paid_out"
    );
    await assert.rejects(() =>
        call(
            reviewOperation,
            "validator",
            {
                ...data,
                requestId: randomUUID(),
                expectedRevision: current.revision + 1,
                action: "cancel",
                confirmation: order.orderId,
                note: "late",
            },
            "validator"
        )
    );
});
await test("Dashboard filters, stable cursor, counts and audit preserve source identity", async () => {
    const first = await call(listOperations, "validator", {limit: 1}, "validator");
    assert.equal(first.operations.length, 1);
    assert.ok(first.nextCursor);
    const second = await call(
        listOperations,
        "validator",
        {limit: 1, cursor: first.nextCursor},
        "validator"
    );
    assert.notEqual(first.operations[0].orderId, second.operations[0].orderId);
    const paid = await call(
        listOperations,
        "validator",
        {status: "paid_out"},
        "validator"
    );
    assert.equal(paid.operations[0].orderId, order.orderId);
    const summary = await call(getOperationsSummary, "validator", {}, "validator");
    assert.equal(summary.counts.paid_out, 1);
    const events = await db().collection(`orders/${order.orderId}/events`).get();
    assert.equal(events.docs.filter((s) => s.data().action === "payout").length, 1);
    assert.ok(events.docs.some((s) => s.data().actor === "operator"));
});
await test("Saved recipients are isolated by owner", async () => {
    await call(saveRecipient, customer, {
        label: "Familia",
        name: "Persona Destino",
        document: "12345678",
        bank: "BCP",
        account: "12345678",
        currency: "PEN",
    });
    assert.equal((await call(listSavedRecipients, customer, {})).recipients.length, 1);
    assert.equal((await call(listSavedRecipients, other, {})).recipients.length, 0);
});
await test("Expired quotes are rejected", async () => {
    await quote("q-expired");
    await db().doc("quotes/q-expired").update({expiresAt: "2000-01-01T00:00:00Z"});
    await assert.rejects(() =>
        createOrderFor(customer, CreateOrderRequest.parse(input("q-expired")))
    );
});
await test("Exact search is bounded, and settings require admin; fixed rates are server-owned", async () => {
    const result = await call(
        listOperations,
        "validator",
        {search: {field: "email", value: "test@example.com"}},
        "validator"
    );
    assert.ok(result.operations.length);
    const config = {
        manualRates: {
            active: true,
            penPerUsd: 3.8,
            brlPerUsd: 5.2,
            validUntil: new Date(Date.now() + 600000).toISOString(),
        },
    };
    await assert.rejects(() =>
        call(updateOperationsConfig, "validator", config, "validator")
    );
    await call(updateOperationsConfig, "admin", config, "admin");
    assert.equal(
        (await call(getOperationsConfig, "operator", {}, "operator")).manualRates
            .brlPerUsd,
        5.2
    );
    const rates = await loadMarketRates(5);
    assert.equal(rates.source, "manual");
    assert.equal(rates.rates.PEN, 3.8);
});
await test("Request correction permits new evidence but retains audit and reference lock", async () => {
    await quote("q-correction");
    const row = await call(createWebOrder, customer, input("q-correction"));
    const first = `proofs/${customer}/${row.orderId}/first.pdf`,
        second = `proofs/${customer}/${row.orderId}/second.pdf`;
    for (const path of [first, second])
        await bucket()
            .file(path)
            .save("%PDF-1.7\nproof", {contentType: "application/pdf"});
    await call(submitProof, customer, {
        orderId: row.orderId,
        operationNo: "22222222",
        proofPath: first,
    });
    await call(
        reviewOperation,
        "validator",
        {
            orderId: row.orderId,
            expectedRevision: 1,
            requestId: randomUUID(),
            action: "request_proof",
            note: "Imagen incompleta",
        },
        "validator"
    );
    await call(submitProof, customer, {
        orderId: row.orderId,
        operationNo: "22222222",
        proofPath: second,
    });
    const saved = (
        await db()
            .doc("orders/" + row.orderId)
            .get()
    ).data();
    assert.equal(saved.revision, 3);
    assert.equal(saved.paymentProofPath, second);
    assert.equal((await db().collection(`orders/${row.orderId}/events`).get()).size, 4);
});
await test("Upstream manual orders preserve the seller, permissions and our audited worklists", async () => {
    const data = {
        ...input("unused"),
        sendCurrency: "PEN",
        receiveCurrency: "BRL",
        sendAmount: 100,
        rate: 1.4,
        commission: 2,
    };
    await assert.rejects(() => call(createManualOrder, customer, data));
    await assert.rejects(() =>
        call(createManualOrder, "supabase:unassigned", data, "admin")
    );
    const row = await call(createManualOrder, "seller", data, "operator");
    assert.equal(row.uid, "seller");
    assert.equal(row.createdBy, "seller");
    assert.equal(row.channel, "human");
    assert.equal(row.workflowStatus, "awaiting_payment");
    assert.equal(row.revision, 0);
    const audit = await db().collection(`orders/${row.orderId}/events`).get();
    assert.equal(audit.docs[0].data().action, "created_manual");
    const path = `proofs/seller/${row.orderId}/manual.pdf`;
    await bucket().file(path).save("%PDF-1.7\nmanual", {contentType: "application/pdf"});
    await call(submitProof, "seller", {
        orderId: row.orderId,
        operationNo: "33333333",
        proofPath: path,
    });
    const detail = (await db().doc(`orders/${row.orderId}`).get()).data();
    await call(
        reviewOperation,
        "validator",
        {
            orderId: row.orderId,
            action: "verify",
            expectedRevision: detail.revision,
            requestId: randomUUID(),
            note: "Bank checked",
        },
        "validator"
    );
    assert.equal(
        (await db().doc(`orders/${row.orderId}`).get()).data().workflowStatus,
        "verified"
    );
    await assert.rejects(() =>
        call(createManualOrder, "seller", {...data, rate: 0.000001}, "operator")
    );
});
// Client SDK + Auth emulator exercise deployed Rules, not Admin's bypass.
const {initializeApp} = await import("firebase/app");
const {getAuth, connectAuthEmulator, signInAnonymously} = await import("firebase/auth");
const {getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc} = await import(
    "firebase/firestore"
);
const {getStorage, connectStorageEmulator, ref, uploadBytes, getBytes} = await import(
    "firebase/storage"
);
const app = initializeApp(
    {
        apiKey: "fake",
        projectId: process.env.GCLOUD_PROJECT,
        storageBucket: process.env.GCLOUD_PROJECT + ".appspot.com",
    },
    "rules-test"
);
const auth = getAuth(app);
connectAuthEmulator(auth, "http://" + process.env.FIREBASE_AUTH_EMULATOR_HOST, {
    disableWarnings: true,
});
const fs = getFirestore(app);
const [fh, fp] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
connectFirestoreEmulator(fs, fh, Number(fp));
const storage = getStorage(app);
const [sh, sp] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
connectStorageEmulator(storage, sh, Number(sp));
await signInAnonymously(auth);
const uid = auth.currentUser.uid;
await test("Firestore rules deny financial writes, role self-grants and foreign reads", async () => {
    await assert.rejects(() => getDoc(doc(fs, "orders/" + order.orderId)));
    await assert.rejects(() =>
        setDoc(doc(fs, "orders/BR-9999"), {uid, status: "approved"})
    );
    await assert.rejects(() => setDoc(doc(fs, "supabaseStaff/" + uid), {role: "admin"}));
});
await test("Storage rules bind uploads to an owned pending order and deny updates/payouts", async () => {
    const ownId = "BR-9998";
    await db()
        .doc("orders/" + ownId)
        .set({uid, status: "pending"});
    const path = `proofs/${uid}/${ownId}/proof.pdf`,
        bytes = new TextEncoder().encode("%PDF-1.7\ntest");
    await uploadBytes(ref(storage, path), bytes, {contentType: "application/pdf"});
    await assert.rejects(() =>
        uploadBytes(ref(storage, path), bytes, {contentType: "application/pdf"})
    );
    await assert.rejects(() =>
        uploadBytes(ref(storage, `payouts/${ownId}/out.pdf`), bytes, {
            contentType: "application/pdf",
        })
    );
    await assert.rejects(() => getBytes(ref(storage, proof)));
});
await test("VIEW staff reads and bridged-role revocation are enforced by Firestore Rules", async () => {
    const {getAuth: adminAuth} = require("firebase-admin/auth");
    const {signInWithCustomToken} = await import("firebase/auth");
    const {getDocFromServer} = await import("firebase/firestore");
    await signInWithCustomToken(
        auth,
        await adminAuth().createCustomToken("view-staff", {role: "validator"})
    );
    assert.equal(
        (await getDocFromServer(doc(fs, "orders/" + order.orderId))).exists(),
        true
    );
    const events = await db().collection(`orders/${order.orderId}/events`).get();
    assert.equal(
        (
            await getDocFromServer(
                doc(fs, `orders/${order.orderId}/events/${events.docs[0].id}`)
            )
        ).exists(),
        true
    );
    await assert.rejects(() =>
        setDoc(doc(fs, "orders/BR-9999"), {uid, status: "approved"})
    );
    await signInWithCustomToken(
        auth,
        await adminAuth().createCustomToken("supabase:view-staff", {role: "admin"})
    );
    await assert.rejects(() => getDocFromServer(doc(fs, "orders/" + order.orderId)));
    await db().doc("supabaseStaff/supabase:view-staff").set({role: "validator"});
    assert.equal(
        (await getDocFromServer(doc(fs, "orders/" + order.orderId))).exists(),
        true
    );
    await db().doc("supabaseStaff/supabase:view-staff").delete();
    await assert.rejects(() => getDocFromServer(doc(fs, "orders/" + order.orderId)));
});
console.log(`${passed} integration scenarios passed against real local emulators.`);
process.exit(0);
