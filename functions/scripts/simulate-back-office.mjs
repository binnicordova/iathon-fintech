// Plays the back office for ONE order, so a client can watch it finish in the
// app and download its receipt. It makes the same writes as the staff
// functions, in the same order:
//
//   validating --reviewOrder(approve)--> approved --exportOrders--> exported
//   --runFact--> invoices/{id} accepted + PDF in Storage (order.invoiceStatus)
//
// The Fact step runs the real billing code (issueInvoice from lib/fact.js), not a copy.
//
//   node scripts/simulate-back-office.mjs BR-0023           # approve, export, bill
//   node scripts/simulate-back-office.mjs BR-0023 --reject  # reject instead
//   node scripts/simulate-back-office.mjs BR-0023 --pdf out.pdf   # also save the receipt
//   node scripts/simulate-back-office.mjs BR-0023 --delay 10      # wait 10 s between steps, to watch the app update
//
// Run `bun run functions:build` first. Uses Application Default Credentials
// (gcloud auth application-default login) and writes to production unless the
// emulator variables are set.
import {writeFileSync} from "node:fs";
import {createRequire} from "node:module";

const [orderId, ...flags] = process.argv.slice(2);
const delayAt = flags.indexOf("--delay");
const delayMs = delayAt === -1 ? 0 : Number(flags[delayAt + 1]) * 1000;
const pause = (label) => {
    if (delayMs > 0) {
        console.log(`   ...waiting ${delayMs / 1000}s (${label})`);
    }
    return new Promise((resolve) => setTimeout(resolve, delayMs));
};
if (!orderId) {
    console.error("Usage: node scripts/simulate-back-office.mjs <orderId> [--reject] [--delay seconds] [--pdf file]");
    process.exit(1);
}
const project = process.env.GCLOUD_PROJECT ?? "aibrasper";
process.env.GCLOUD_PROJECT = project;
process.env.GOOGLE_CLOUD_PROJECT = project;
process.env.FIREBASE_CONFIG ??= JSON.stringify({projectId: project, storageBucket: `${project}.firebasestorage.app`});

const require = createRequire(import.meta.url);
const {db, bucket} = require("../lib/lib/firebase.js");
const {issueInvoice} = require("../lib/fact.js");

const ref = () => db().doc(`orders/${orderId}`);
const read = async () => (await ref().get()).data();
const pick = (order, keys) => Object.fromEntries(keys.map((key) => [key, order[key] ?? null]));
const show = (label, order, keys) => console.log(`\n${label}\n${JSON.stringify(pick(order, keys), null, 2)}`);
const now = () => new Date().toISOString();

const KEYS = ["status", "validatedBy", "validatedAt", "rejectionReason", "exportBatchId", "exportedAt", "invoiceStatus", "updatedAt"];
const who = "back-office-simulation@brasper.test";

let order = await read();
if (!order) {
    console.error(`${orderId} does not exist`);
    process.exit(1);
}
show(`0. before (${orderId})`, order, KEYS);
if (order.status !== "validating") {
    console.error(`\nExpected status "validating", found "${order.status}". Nothing changed.`);
    process.exit(1);
}

// 1. The validator checked the bank statement and the proof photo.
const reject = flags.includes("--reject");
await ref().update({
    status: reject ? "rejected" : "approved",
    validatedBy: who,
    validatedAt: now(),
    rejectionReason: reject ? "Rejected by the back-office simulation." : null,
    updatedAt: now(),
});
order = await read();
show(`1. reviewOrder → ${order.status}`, order, KEYS);
if (reject) {
    process.exit(0);
}
await pause("approved");

// 2. The operator exports the approved order for the Dashboard.
const batch = db().collection("batches").doc();
const stamp = now();
await batch.set({id: batch.id, type: "export", orderIds: [orderId], createdBy: who, createdAt: stamp});
await ref().update({status: "exported", exportBatchId: batch.id, exportedAt: stamp, updatedAt: stamp});
order = await read();
show("2. exportOrders → exported", order, KEYS);
await pause("exported");

// 3. Billing (Fact, test mode): reserve a number, XML, PDF, result on the order.
const result = await issueInvoice(order);
console.log("\n3. runFact →", JSON.stringify(result));
order = await read();
show("   order after Fact", order, KEYS);
const invoice = (await db().doc(`invoices/${orderId}`).get()).data();
console.log("\n   invoices/" + orderId + "\n" + JSON.stringify(invoice, null, 2));

// 4. What the client's "Download receipt" button gets back.
const pdfAt = flags.indexOf("--pdf");
if (pdfAt !== -1 && invoice) {
    const [bytes] = await bucket().file(invoice.pdfPath).download();
    writeFileSync(flags[pdfAt + 1], bytes);
    console.log(`\n4. receipt saved: ${flags[pdfAt + 1]} (${bytes.length} bytes, starts ${bytes.subarray(0, 4)})`);
}
