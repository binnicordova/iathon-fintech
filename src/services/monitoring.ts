import * as Sentry from "@sentry/react-native";
import {
    SENTRY_DSN,
    SENTRY_RECORD_AI_CONTENT,
    SENTRY_TRACES_SAMPLE_RATE,
} from "@/constants/env";

/**
 * Sentry is optional: with no DSN every call below is a cheap no-op, so the app
 * runs the same in Expo Go with nothing configured.
 */
export const initMonitoring = () => {
    Sentry.init({
        dsn: SENTRY_DSN || undefined,
        enabled: Boolean(SENTRY_DSN),
        environment: __DEV__ ? "development" : "production",
        // Needed for the LangGraph `gen_ai.*` spans.
        tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
        // The chat and forms carry ID numbers and bank accounts.
        sendDefaultPii: false,
    });
};

export const RECORD_AI_CONTENT = SENTRY_RECORD_AI_CONTENT;

export const reportError = (error: unknown, context: string) => {
    Sentry.captureException(error, {tags: {context}});
    if (__DEV__) {
        console.warn(
            `[${context}]`,
            error,
            error instanceof Error ? error.stack : ""
        );
    }
};

export const setMonitoringUser = (uid: string | null) => {
    Sentry.setUser(uid ? {id: uid} : null);
};

export {Sentry};
