// End-to-end check of the whole back office against the local emulators:
//   quote -> order -> proof -> validate -> export -> Fact (test mode) -> receipt
// Run with the emulators up:  node scripts/e2e-emulator.mjs
// (STOP_AFTER=proof stops once the order is waiting for a validator.)
import {strict as assert} from "node:assert";

const PROJECT = "aibrasper";
const REGION = "southamerica-east1";
// TARGET=prod runs the client-side half against the deployed project (no staff
// steps: create a staff user first with grant-staff.mjs to cover those).
const PROD = process.env.TARGET === "prod";
const API_KEY = process.env.FIREBASE_API_KEY ?? "x";
const FUNCTIONS = PROD
    ? `https://${REGION}-${PROJECT}.cloudfunctions.net`
    : `http://localhost:5001/${PROJECT}/${REGION}`;
const AUTH = PROD
    ? "https://identitytoolkit.googleapis.com/v1"
    : "http://localhost:9099/identitytoolkit.googleapis.com/v1";
const STORAGE = PROD
    ? `https://firebasestorage.googleapis.com/v0/b/${PROJECT}.firebasestorage.app/o`
    : `http://localhost:9199/v0/b/${PROJECT}.firebasestorage.app/o`;

const post = async (url, body, headers = {}) => {
    const response = await fetch(url, {
        method: "POST",
        headers: {"content-type": "application/json", ...headers},
        body: JSON.stringify(body),
    });
    return {status: response.status, json: await response.json().catch(() => null)};
};

const call = async (name, data, token) => {
    const {status, json} = await post(`${FUNCTIONS}/${name}`, {data}, token ? {authorization: `Bearer ${token}`} : {});
    if (status !== 200) {
        const error = new Error(`${name} -> ${json?.error?.message ?? status}`);
        error.code = json?.error?.message;
        throw error;
    }
    return json.result;
};

const signUpAnonymous = async () => {
    const {json} = await post(`${AUTH}/accounts:signUp?key=${API_KEY}`, {returnSecureToken: true});
    return {token: json.idToken, uid: json.localId};
};

const signIn = async (email, password) => {
    const {json} = await post(`${AUTH}/accounts:signInWithPassword?key=${API_KEY}`, {email, password, returnSecureToken: true});
    assert.ok(json?.idToken, `could not sign in ${email} (run scripts/grant-staff.mjs first)`);
    return json.idToken;
};

const step = (label) => console.log(`  ✓ ${label}`);

const client = await signUpAnonymous();
console.log(`client ${client.uid}`);

const rates = await call("getRates", {}, client.token);
assert.ok(rates.market.rates.BRL > 0 && rates.market.rates.PEN > 0, "rates");
step(`rates ${rates.market.source}: 1 USD = ${rates.market.rates.BRL} BRL / ${rates.market.rates.PEN} PEN`);

const quote = await call("createQuote", {sendCurrency: "BRL", receiveCurrency: "PEN", sendAmount: 500, channel: "form"}, client.token);
assert.equal(quote.total, Number((quote.sendAmount + quote.commission + quote.tax).toFixed(2)));
step(`quote ${quote.id}: ${quote.sendAmount} BRL -> ${quote.receiveAmount} PEN at ${quote.rate}`);

await assert.rejects(
    call("createQuote", {sendCurrency: "USD", receiveCurrency: "BRL", sendAmount: 5000, channel: "form"}, client.token),
    /requires-human/
);
step("a 5,000 USD quote is refused and sent to a person");

const order = await call(
    "createOrder",
    {
        quoteId: quote.id,
        language: "es",
        clientName: "Ana Paula Souza",
        docType: "CPF",
        docNumber: "529.982.247-25",
        email: "ana@example.com",
        fundsSource: "savings",
        sourceBank: "Nubank",
        sourceAccount: "0001 12345-6",
        destinationBank: "BCP",
        destinationAccount: "191-12345678-0-12",
    },
    client.token
);
assert.match(order.orderId, /^BR-\d{4}$/);
assert.equal(order.status, "pending");
assert.equal(order.rate, quote.rate, "the rate is frozen from the quote");
step(`order ${order.orderId} created, rate frozen at ${order.rate}`);

await assert.rejects(
    call("createOrder", {quoteId: quote.id, language: "es", clientName: "X Y", docType: "DNI", docNumber: "1", email: "x", fundsSource: "savings", sourceBank: "a", sourceAccount: "1", destinationBank: "b", destinationAccount: "2"}, client.token)
);
step("a used quote cannot create a second order");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const proofPath = `proofs/${client.uid}/${order.orderId}/proof-1.png`;
const upload = await fetch(`${STORAGE}?name=${encodeURIComponent(proofPath)}`, {
    method: "POST",
    headers: {"content-type": "image/png", authorization: `Firebase ${client.token}`},
    body: png,
});
assert.equal(upload.status, 200, `proof upload ${upload.status}`);
const operationNo = `E2E${Date.now().toString().slice(-8)}`;
await call("submitProof", {orderId: order.orderId, operationNo, proofPath}, client.token);
step(`proof uploaded and order is validating (op ${operationNo})`);

if (process.env.STOP_AFTER === "proof") {
    // Handy to seed a "validating" order for trying the team's VIEW by hand.
    console.log(`\nstopped after proof: ${order.orderId} is waiting for validation`);
    process.exit(0);
}

const intruder = await signUpAnonymous();
const stolen = await fetch(`${STORAGE}/${encodeURIComponent(proofPath)}?alt=media`, {headers: {authorization: `Firebase ${intruder.token}`}});
assert.equal(stolen.status, 403, "another client must not read the proof");
step("another client cannot read the proof photo");

await assert.rejects(call("reviewOrder", {orderId: order.orderId, decision: "approve"}, client.token), /staff-only/);
step("a client cannot approve their own payment");

if (PROD) {
    console.log("\nclient-side checks against production passed (staff steps skipped)");
    process.exit(0);
}

const staff = await signIn("staff@brasper.test", "test-pass-123");
await call("reviewOrder", {orderId: order.orderId, decision: "approve"}, staff);
step("validator approved");

const exported = await call("exportOrders", {orderIds: [order.orderId]}, staff);
assert.match(exported.csv.split("\n")[0], /^order_id,created_at/);
assert.ok(exported.csv.includes(order.orderId));
step(`exported ${exported.count} order(s): ${exported.filename}`);

await assert.rejects(call("exportOrders", {orderIds: [order.orderId]}, staff), /only-approved-orders/);
step("an order cannot be exported twice");

const first = await call("runFact", {orderIds: [order.orderId]}, staff);
assert.equal(first.results[0].outcome, "accepted");
step(`Fact (test mode) accepted ${first.results[0].invoice}`);
const second = await call("runFact", {orderIds: [order.orderId]}, staff);
assert.equal(second.results[0].outcome, "skipped");
assert.equal(second.results[0].invoice, first.results[0].invoice);
step("running Fact again is idempotent: same invoice, no new number");

const receipt = await call("getReceipt", {orderId: order.orderId}, client.token);
assert.equal(Buffer.from(receipt.base64, "base64").subarray(0, 4).toString(), "%PDF");
step(`client downloaded ${receipt.filename} (${receipt.base64.length} base64 chars)`);

await assert.rejects(call("getReceipt", {orderId: order.orderId}, intruder.token), /not-your-order/);
step("another client cannot download the receipt");

const queue = await call("requestHuman", {orderId: null, summary: "wants a better rate", language: "es", channel: "assistant"}, client.token);
assert.ok(queue.position >= 1 && queue.estimatedWaitMinutes >= 1);
const again = await call("requestHuman", {orderId: null, summary: "again", language: "es", channel: "assistant"}, client.token);
assert.equal(again.handoffId, queue.handoffId, "one ticket per client");
step(`human queue #${queue.position}, ≈ ${queue.estimatedWaitMinutes} min`);

console.log("\nall back-office checks passed");
