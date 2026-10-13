import {type FirebaseApp, getApp, getApps, initializeApp} from "firebase/app";
import {
    connectFirestoreEmulator,
    type Firestore,
    initializeFirestore,
} from "firebase/firestore";
import {
    connectFunctionsEmulator,
    type Functions,
    getFunctions,
} from "firebase/functions";
import {
    connectStorageEmulator,
    type FirebaseStorage,
    getStorage,
} from "firebase/storage";
import {
    EMULATOR_HOST,
    EMULATOR_PORTS,
    FIREBASE_CONFIG,
    FUNCTIONS_REGION,
} from "@/constants/firebase";

export const app: FirebaseApp =
    getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);

type Services = {db: Firestore; functions: Functions; storage: FirebaseStorage};

// Fast Refresh re-evaluates modules: keep one instance per service, or the
// emulator connections and Firestore settings throw on the second pass.
const holder = globalThis as {__brasperFirebase?: Services};

const create = (): Services => {
    // React Native has no WebChannel streaming guarantee; auto-detect falls back
    // to long polling where it is needed.
    const db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
    });
    const functions = getFunctions(app, FUNCTIONS_REGION);
    const storage = getStorage(app);

    if (EMULATOR_HOST) {
        connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
        connectFunctionsEmulator(
            functions,
            EMULATOR_HOST,
            EMULATOR_PORTS.functions
        );
        connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
    }
    return {db, functions, storage};
};

holder.__brasperFirebase ??= create();
const services = holder.__brasperFirebase;

export const {db, functions, storage} = services;
