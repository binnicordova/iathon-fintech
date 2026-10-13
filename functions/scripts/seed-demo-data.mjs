// Fills Firestore (and Storage, for proof photos) with SYNTHETIC orders so the
// team VIEW, the filters, the CSV export and the funnel counts have something to
// show. Every record uses example.com emails and made-up people, and carries
// `synthetic: true`.
//
//   node scripts/seed-demo-data.mjs            # production (needs ADC)
//   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 node scripts/seed-demo-data.mjs
//
// Orders continue the real counter (counters/orders). Run `functions:build`
// first: the pricing rules are read from lib/shared. Refuses to run twice
// unless --force is passed. Invoices are left out on purpose: run Fact from the
// Team tab on the approved orders to produce them.
import {deflateSync, crc32} from "node:zlib";
import {createRequire} from "node:module";
import {applicationDefault, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

const require = createRequire(import.meta.url);
const {computeQuote} = require("../lib/shared/domain/pricing.js");
const {DEFAULT_PRICING} = require("../lib/shared/domain/pricing.js");
const {formatOrderId} = require("../lib/shared/domain/orders.js");

const projectId = process.env.GCLOUD_PROJECT ?? "aibrasper";
const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
initializeApp({
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    ...(emulated ? {} : {credential: applicationDefault()}),
});
const db = getFirestore();
const bucket = getStorage().bucket();

const already = await db
    .collection("orders")
    .where("synthetic", "==", true)
    .limit(1)
    .get();
if (!already.empty && !process.argv.includes("--force")) {
    console.error("Synthetic orders already exist. Pass --force to add more.");
    process.exit(1);
}

const ratesSnap = await db.doc("config/rates").get();
if (!ratesSnap.exists) {
    console.error("config/rates is empty: open the app once so getRates fills it.");
    process.exit(1);
}
const market = ratesSnap.data();

const BANKS = {
    BRL: ["Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Inter"],
    PEN: ["BCP", "Interbank", "BBVA", "Scotiabank", "Yape"],
};
const CPFS = ["52998224725", "11144477735", "39053344705", "86288366757"];
const PEOPLE = [
    {name: "Ana Paula Souza", doc: ["CPF", CPFS[0]], side: "BRL"},
    {name: "Lucas Ferreira Lima", doc: ["CPF", CPFS[1]], side: "BRL"},
    {name: "Mariana Costa Alves", doc: ["CPF", CPFS[2]], side: "BRL"},
    {name: "Rafael Gomes Pinto", doc: ["CPF", CPFS[3]], side: "BRL"},
    {name: "Camila Rojas Quispe", doc: ["DNI", "45821937"], side: "PEN"},
    {name: "Diego Paredes Huamán", doc: ["DNI", "70234518"], side: "PEN"},
    {name: "Valeria Mendoza Ríos", doc: ["DNI", "46127380"], side: "PEN"},
    {name: "Jorge Salazar Vega", doc: ["CE", "001234567"], side: "PEN"},
];
const FUNDS = ["salary", "savings", "business", "salary", "asset_sale"];
// [person index, send amount, status]
const PLAN = [
    [0, 500, "exported"],
    [4, 800, "exported"],
    [1, 1200, "approved"],
    [5, 350, "approved"],
    [2, 2000, "approved"],
    [6, 600, "validating"],
    [3, 150, "validating"],
    [7, 1500, "validating"],
    [0, 900, "pending"],
    [4, 250, "pending"],
    [1, 400, "rejected"],
    [5, 700, "cancelled"],
];

const png = () => {
    const [w, h] = [360, 240];
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y += 1) {
        const row = y * (w * 3 + 1);
        for (let x = 0; x < w; x += 1) {
            const band = y < 48 || (y > 90 && y < 100 && x > 24 && x < 240);
            raw[row + 1 + x * 3] = band ? 130 : 245;
            raw[row + 2 + x * 3] = band ? 36 : 247;
            raw[row + 3 + x * 3] = band ? 227 : 250;
        }
    }
    const chunk = (type, data) => {
        const body = Buffer.concat([Buffer.from(type), data]);
        const head = Buffer.alloc(4);
        head.writeUInt32BE(data.length);
        const tail = Buffer.alloc(4);
        tail.writeUInt32BE(crc32(body));
        return Buffer.concat([head, body, tail]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ]);
};
const proofPng = png();

const digits = (n, seed) =>
    String(Math.abs(Math.sin(seed) * 1e12)).replace(".", "").slice(0, n).padEnd(n, "7");
const account = (side, seed) =>
    side === "BRL"
        ? `${digits(4, seed)}-${digits(8, seed + 1)}-${digits(1, seed + 2)}`
        : `${digits(3, seed)}-${digits(10, seed + 1)}`;
const iso = (offsetMinutes) =>
    new Date(Date.now() - offsetMinutes * 60_000).toISOString();

const counter = db.doc("counters/orders");
let seq = ((await counter.get()).data()?.seq ?? 0);

const pay = {
    BRL: {currency: "BRL", holder: "BrasPer (DEMO)", bank: "Nubank (DEMO)", accountNumber: "0000-0000-0000-DEMO", pixKey: "demo@brasper.example", demo: true},
    PEN: {currency: "PEN", holder: "BrasPer (DEMO)", bank: "BCP (DEMO)", accountNumber: "000-0000000-0-00 DEMO", demo: true},
};

let index = 0;
for (const [personIndex, amount, status] of PLAN) {
    index += 1;
    seq += 1;
    const person = PEOPLE[personIndex];
    const sendCurrency = person.side;
    const receiveCurrency = sendCurrency === "BRL" ? "PEN" : "BRL";
    const uid = `seed-client-${personIndex + 1}`;
    const orderId = formatOrderId(seq);
    const created = iso((PLAN.length - index) * 330 + 40);
    const amounts = computeQuote(market, DEFAULT_PRICING, {
        sendCurrency,
        receiveCurrency,
        sendAmount: amount,
    });
    const quoteRef = db.collection("quotes").doc();
    const channel = index % 3 === 0 ? "assistant" : "form";
    const hasProof = ["validating", "approved", "exported", "rejected"].includes(status);
    const proofPath = `proofs/${uid}/${orderId}/proof.png`;
    const afterProof = (minutes) => new Date(new Date(created).getTime() + minutes * 60_000).toISOString();
    if (hasProof) {
        await bucket.file(proofPath).save(proofPng, {contentType: "image/png"});
    }
    const reviewed = ["approved", "exported", "rejected"].includes(status);
    const order = {
        orderId,
        seq,
        uid,
        channel,
        language: person.side === "BRL" ? "pt" : "es",
        status,
        createdAt: created,
        updatedAt: afterProof(reviewed ? 40 : hasProof ? 12 : 0),
        quoteId: quoteRef.id,
        clientName: person.name,
        docType: person.doc[0],
        docNumber: person.doc[1],
        email: `${person.name.split(" ")[0].toLowerCase()}.demo@example.com`,
        fundsSource: FUNDS[index % FUNDS.length],
        sourceBank: BANKS[sendCurrency][index % 5],
        sourceAccount: account(sendCurrency, index * 3),
        destinationBank: BANKS[receiveCurrency][(index + 2) % 5],
        destinationAccount: account(receiveCurrency, index * 7),
        ...amounts,
        rateLockedUntil: afterProof(30),
        paymentAccount: pay[sendCurrency],
        operationNo: hasProof ? `DEMO${String(100000 + seq * 137)}` : null,
        paymentProofPath: hasProof ? proofPath : null,
        proofSubmittedAt: hasProof ? afterProof(12) : null,
        validatedBy: reviewed ? "seed-validator" : null,
        validatedAt: reviewed ? afterProof(40) : null,
        rejectionReason: status === "rejected" ? "Operation number does not match the bank statement (demo)." : null,
        exportBatchId: status === "exported" ? "BATCH-DEMO-1" : null,
        exportedAt: status === "exported" ? afterProof(90) : null,
        invoiceStatus: null,
        synthetic: true,
    };
    delete order.requiresHuman;
    await db.doc(`orders/${orderId}`).set(order);
    await quoteRef.set({
        id: quoteRef.id,
        uid,
        channel,
        status: "consumed",
        orderId,
        createdAt: created,
        expiresAt: afterProof(15),
        ...amounts,
        synthetic: true,
    });
    await db.doc(`clients/${uid}`).set({
        clientName: person.name,
        email: order.email,
        docType: person.doc[0],
        docNumber: person.doc[1],
        language: order.language,
        accounts: [],
        updatedAt: created,
        synthetic: true,
    });
    console.log(`  ${orderId}  ${status.padEnd(10)} ${sendCurrency} ${amount} → ${amounts.receiveAmount} ${receiveCurrency}`);
}
await counter.set({seq}, {merge: true});

// Funnel events: each step loses a few clients, as a real funnel does.
const FUNNEL = [
    ["quote_viewed", 40],
    ["quote_continue", 26],
    ["data_completed", 19],
    ["pay_viewed", 16],
    ["paid_tapped", 13],
    ["proof_submitted", 10],
    ["status_viewed", 9],
    ["assistant_opened", 14],
    ["human_requested", 3],
];
const batch = db.batch();
let events = 0;
for (const [name, count] of FUNNEL) {
    for (let i = 0; i < count; i += 1) {
        batch.set(db.collection("events").doc(), {
            uid: `seed-visitor-${(i % 18) + 1}`,
            name,
            channel: name === "assistant_opened" || i % 3 === 0 ? "assistant" : "form",
            platform: ["web", "ios", "android"][i % 3],
            at: iso(Math.floor(Math.random() * 6 * 24 * 60)),
            props: {},
            synthetic: true,
        });
        events += 1;
    }
}
await batch.commit();

const HANDOFFS = [
    ["waiting", 14, "Client wants to send R$ 18,000 and asks for a better rate."],
    ["waiting", 6, "Doubt about the bank that receives in Peru; has a saved quote."],
    ["closed", 300, "Asked for the proof status of an order paid yesterday."],
];
for (const [status, minutesAgo, summary] of HANDOFFS) {
    const ref = db.collection("handoffs").doc();
    await ref.set({
        id: ref.id,
        uid: `seed-visitor-${HANDOFFS.findIndex((h) => h[2] === summary) + 1}`,
        orderId: null,
        status,
        channel: "assistant",
        language: "pt",
        summary,
        createdAt: iso(minutesAgo),
        assignedTo: status === "closed" ? "seed-validator" : null,
        synthetic: true,
    });
}

console.log(`Seeded ${PLAN.length} orders (counter now ${seq}), ${events} events, ${HANDOFFS.length} handoffs${emulated ? " (emulator)" : ""}.`);
