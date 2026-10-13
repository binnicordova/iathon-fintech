// Empties the data that testing leaves behind, so a launch starts at BR-0001.
// It lists what it would remove and deletes nothing unless --yes is passed.
//
//   node scripts/reset-test-data.mjs                 # dry run
//   node scripts/reset-test-data.mjs --yes           # Firestore + proof photos
//   node scripts/reset-test-data.mjs --yes --anonymous-users
//
// Kept on purpose: config/* (prices, payment accounts, the rate cache) and every
// staff user (users with an email). Against production it needs Application
// Default Credentials for the project: gcloud auth application-default login
import {applicationDefault, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";

const COLLECTIONS = [
    "orders",
    "quotes",
    "invoices",
    "handoffs",
    "clients",
    "counters",
];
const args = new Set(process.argv.slice(2));
const apply = args.has("--yes");
const withAnonymousUsers = args.has("--anonymous-users");
const projectId = process.env.GCLOUD_PROJECT ?? "aibrasper";

const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
initializeApp({
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    ...(emulated ? {} : {credential: applicationDefault()}),
});
const db = getFirestore();

console.log(
    `${apply ? "DELETING" : "Dry run, nothing is deleted"} in project ${projectId}${emulated ? " (emulator)" : ""}`
);

for (const name of COLLECTIONS) {
    const ref = db.collection(name);
    const count = (await ref.count().get()).data().count;
    console.log(`  ${name}: ${count} documents`);
    if (apply && count > 0) {
        // recursiveDelete also removes sub-collections.
        await db.recursiveDelete(ref);
    }
}

const [proofs] = await getStorage()
    .bucket()
    .getFiles({prefix: "proofs/"})
    .catch(() => [[]]);
console.log(`  storage proofs/: ${proofs.length} files`);
if (apply) {
    await Promise.all(proofs.map((file) => file.delete()));
}

if (withAnonymousUsers) {
    const anonymous = [];
    let page = await getAuth().listUsers(1000);
    for (;;) {
        // Only users with no email and no provider: staff and any signed-up user stay.
        anonymous.push(
            ...page.users.filter(
                (user) => !user.email && user.providerData.length === 0
            )
        );
        if (!page.pageToken) {
            break;
        }
        page = await getAuth().listUsers(1000, page.pageToken);
    }
    console.log(`  anonymous auth users: ${anonymous.length}`);
    if (apply && anonymous.length > 0) {
        await getAuth().deleteUsers(anonymous.map((user) => user.uid));
    }
}

console.log(apply ? "Done." : "Re-run with --yes to delete.");
