import * as ExpoCrypto from "expo-crypto";

/**
 * LangGraph / LangChain generate run ids with `uuid`, which reads
 * `globalThis.crypto.getRandomValues`. Hermes ships no `crypto`, so we wire the
 * Expo implementation in before any of that code is evaluated.
 */
const globalWithCrypto = globalThis as {crypto?: Partial<Crypto>};

if (typeof globalWithCrypto.crypto?.getRandomValues !== "function") {
    globalWithCrypto.crypto = {
        ...globalWithCrypto.crypto,
        getRandomValues: ExpoCrypto.getRandomValues,
        randomUUID: ExpoCrypto.randomUUID,
    } as Crypto;
}

/**
 * `langsmith` (pulled in by LangChain core) sniffs `navigator.userAgent` while
 * building its default client. React Native leaves it undefined.
 */
const nav = (globalThis as {navigator?: {userAgent?: string}}).navigator;

if (nav && typeof nav.userAgent !== "string") {
    Object.defineProperty(nav, "userAgent", {
        value: "ReactNative",
        configurable: true,
    });
}

/**
 * React Native's `AbortSignal` predates `throwIfAborted()`, which LangChain
 * calls between stream steps.
 */
type AbortSignalLike = {aborted: boolean; reason?: unknown};
const AbortSignalProto = (
    globalThis as {AbortSignal?: {prototype: AbortSignalLike}}
).AbortSignal?.prototype as
    | (AbortSignalLike & {throwIfAborted?: () => void})
    | undefined;

if (AbortSignalProto && typeof AbortSignalProto.throwIfAborted !== "function") {
    AbortSignalProto.throwIfAborted = function throwIfAborted(
        this: AbortSignalLike
    ) {
        if (this.aborted) {
            throw this.reason ?? new Error("Aborted");
        }
    };
}
