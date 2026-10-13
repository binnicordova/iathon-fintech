// End-to-end check of the client path against the local emulators:
//   quote -> order -> proof -> human queue, plus the access checks
// Run with the emulators up:  node scripts/e2e-emulator.mjs
// (STOP_AFTER=proof stops once the order is waiting for validation.)
import {strict as assert} from "node:assert";

const PROJECT = "aibrasper";
const REGION = "southamerica-east1";
// TARGET=prod runs the same checks against the deployed project.
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
    console.log(`\nstopped after proof: ${order.orderId} is waiting for validation`);
    process.exit(0);
}

const intruder = await signUpAnonymous();
const stolen = await fetch(`${STORAGE}/${encodeURIComponent(proofPath)}?alt=media`, {headers: {authorization: `Firebase ${intruder.token}`}});
assert.equal(stolen.status, 403, "another client must not read the proof");
step("another client cannot read the proof photo");

const queue = await call("requestHuman", {orderId: null, summary: "wants a better rate", language: "es", channel: "assistant"}, client.token);
assert.ok(queue.position >= 1 && queue.estimatedWaitMinutes >= 1);
const again = await call("requestHuman", {orderId: null, summary: "again", language: "es", channel: "assistant"}, client.token);
assert.equal(again.handoffId, queue.handoffId, "one ticket per client");
step(`human queue #${queue.position}, ≈ ${queue.estimatedWaitMinutes} min`);

console.log("\nall checks passed");
