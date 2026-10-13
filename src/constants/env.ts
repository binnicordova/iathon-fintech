export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/** 0–1. Default is full sampling, which suits an MVP with little traffic. */
export const SENTRY_TRACES_SAMPLE_RATE = Number(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "1"
);

/**
 * Sends the assistant's prompts and replies to Sentry's AI spans. Off by
 * default: the chat carries ID numbers and bank accounts.
 */
export const SENTRY_RECORD_AI_CONTENT =
    process.env.EXPO_PUBLIC_SENTRY_RECORD_AI_CONTENT === "true";
