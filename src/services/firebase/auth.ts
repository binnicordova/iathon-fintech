import {type Auth, connectAuthEmulator, getAuth} from "firebase/auth";
import {EMULATOR_HOST, EMULATOR_PORTS} from "@/constants/firebase";
import {app} from "./app";

const holder = globalThis as {__brasperAuth?: Auth};

const create = (): Auth => {
    const instance = getAuth(app);
    if (EMULATOR_HOST) {
        connectAuthEmulator(
            instance,
            `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`,
            {disableWarnings: true}
        );
    }
    return instance;
};

/** Web: the SDK persists the session in IndexedDB on its own. */
holder.__brasperAuth ??= create();
export const auth: Auth = holder.__brasperAuth;
