import {Platform} from "react-native";

/**
 * Firebase *web* config for the `aibrasper` project. These values identify the
 * project, they are not secrets: access is enforced by Firestore/Storage rules
 * and by the Cloud Functions. Override per environment with EXPO_PUBLIC_*.
 */
export const FIREBASE_CONFIG = {
    apiKey:
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
        "AIzaSyBw9nZZ_9GvYIyK0E3e0ffHU_6PvW2q7kA",
    authDomain:
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
        "aibrasper.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "aibrasper",
    storageBucket:
        process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
        "aibrasper.firebasestorage.app",
    messagingSenderId:
        process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "176546887174",
    appId:
        process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
        "1:176546887174:web:7442da5ed0674c6aed7587",
};

/** Same region as Firestore: São Paulo, closest to both Brazil and Peru. */
export const FUNCTIONS_REGION = "southamerica-east1";

/**
 * Point the app at the Firebase emulators (`bun run emulators`) by setting this
 * to the host running them: `localhost` for web and the iOS simulator, `10.0.2.2`
 * for the Android emulator, or your LAN IP for a real device.
 */
const configuredHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? null;

export const EMULATOR_HOST =
    // The Android emulator reaches the computer's localhost at 10.0.2.2.
    configuredHost === "localhost" && Platform.OS === "android"
        ? "10.0.2.2"
        : configuredHost;

export const EMULATOR_PORTS = {
    auth: 9099,
    firestore: 8080,
    functions: 5001,
    storage: 9199,
} as const;
