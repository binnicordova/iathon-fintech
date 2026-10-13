// Gives a Firebase Auth user a team role (custom claim `role`), creating the user
// first when --password is passed.
//
//   node scripts/grant-staff.mjs <email> <admin|validator|operator|billing> [--password <pw>]
//
// Against the emulators: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 node scripts/...
// Against production it needs Application Default Credentials for the project:
//   gcloud auth application-default login
import {applicationDefault, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";

const ROLES = ["admin", "validator", "operator", "billing"];
const [email, role, ...rest] = process.argv.slice(2);
const passwordAt = rest.indexOf("--password");
const password = passwordAt === -1 ? undefined : rest[passwordAt + 1];

if (!email || !ROLES.includes(role)) {
    console.error(`Usage: node scripts/grant-staff.mjs <email> <${ROLES.join("|")}> [--password <pw>]`);
    process.exit(1);
}

const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? "aibrasper",
    ...(emulator ? {} : {credential: applicationDefault()}),
});
const auth = getAuth();

let user;
try {
    user = await auth.getUserByEmail(email);
} catch {
    if (!password) {
        console.error(`No user ${email}. Create it in the Firebase console or pass --password.`);
        process.exit(1);
    }
    user = await auth.createUser({email, password, emailVerified: true});
    console.log(`Created ${email}`);
}

await auth.setCustomUserClaims(user.uid, {role});
console.log(`${email} is now ${role}${emulator ? " (emulator)" : ""}. Sign out and in again to refresh the token.`);
