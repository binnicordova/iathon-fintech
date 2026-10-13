import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    type Auth,
    connectAuthEmulator,
    getReactNativePersistence,
    initializeAuth,
} from "firebase/auth";
import {EMULATOR_HOST, EMULATOR_PORTS} from "@/constants/firebase";
import {app} from "./app";

const holder = globalThis as {__brasperAuth?: Auth};

const create = (): Auth => {
    const instance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
    if (EMULATOR_HOST) {
        connectAuthEmulator(
            instance,
            `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`,
            {disableWarnings: true}
        );
    }
    return instance;
};

/** iOS / Android: keep the anonymous session across app restarts. */
holder.__brasperAuth ??= create();
export const auth: Auth = holder.__brasperAuth;
