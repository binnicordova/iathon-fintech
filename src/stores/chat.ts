import type {BaseMessage} from "@langchain/core/messages";
import {atom} from "jotai";
import {askNext, basicTurn} from "@/assistant/basic";
import {createDefaultDeps} from "@/assistant/defaultDeps";
import {
    type AssistantGraph,
    buildAssistantGraph,
    runTurn,
} from "@/assistant/graph";
import {runTool} from "@/assistant/tools";
import type {ChatCard, ChatMessage, QuickActionId} from "@/assistant/types";
import {translate} from "@/i18n";
import {track} from "@/services/analytics";
import {api} from "@/services/api";
import {RECORD_AI_CONTENT, reportError, Sentry} from "@/services/monitoring";
import {languageAtom} from "@/stores/language";
import {
    activeOrderIdAtom,
    createOrderAtom,
    DraftIncompleteError,
} from "@/stores/order";
import {lockedQuoteAtom} from "@/stores/quote";
import {sessionAtom} from "@/stores/session";

export const chatMessagesAtom = atom<ChatMessage[]>([]);
export const chatHistoryAtom = atom<BaseMessage[]>([]);
export const chatBusyAtom = atom(false);
/** True once a turn fell back to the scripted "basic mode". */
export const chatDegradedAtom = atom(false);

let graph: AssistantGraph | null = null;

/** After a failed model call, answer in basic mode for a while before retrying it. */
const MODEL_RETRY_AFTER_MS = 60_000;
let degradedAt = 0;
const modelRecentlyDown = () => Date.now() - degradedAt < MODEL_RETRY_AFTER_MS;

const getGraph = (): AssistantGraph => {
    graph ??= buildAssistantGraph({
        deps: createDefaultDeps(),
        generate: (request) => api.assistantGenerate(request),
        // Manual instrumentation: the OpenTelemetry integration used on Node
        // does not run in React Native.
        instrument: (builder, options) =>
            Sentry.instrumentStateGraph(builder as never, options),
        recordContent: RECORD_AI_CONTENT,
        span: (options, callback) => Sentry.startSpan(options, callback),
        model: "gemma-4",
    });
    return graph;
};

let counter = 0;
const nextId = (): string => {
    counter += 1;
    return `m${counter}`;
};
const message = (
    role: ChatMessage["role"],
    text: string,
    cards: ChatCard[] = [],
    actions: QuickActionId[] = []
): ChatMessage => ({
    id: nextId(),
    role,
    text,
    cards,
    actions,
    at: Date.now(),
});

/** Only the latest assistant message keeps its quick replies. */
const withoutActions = (messages: ChatMessage[]): ChatMessage[] =>
    messages.map((entry) =>
        entry.actions.length > 0 ? {...entry, actions: []} : entry
    );

const append = (messages: ChatMessage[], ...next: ChatMessage[]) => [
    ...withoutActions(messages),
    ...next,
];

/**
 * One client turn through the LangGraph agent. If the model is unreachable the
 * same tools drive a scripted "basic mode", so the transfer can still finish.
 */
export const sendMessageAtom = atom(null, async (get, set, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get(chatBusyAtom)) {
        return;
    }
    const language = get(languageAtom);
    set(chatMessagesAtom, (previous) =>
        append(previous, message("user", trimmed))
    );
    set(chatBusyAtom, true);
    try {
        const turn = modelRecentlyDown()
            ? null
            : await runTurn(getGraph(), get(chatHistoryAtom), trimmed);

        if (turn) {
            set(chatHistoryAtom, turn.history);
        }
        if (!turn || turn.degraded) {
            degradedAt = Date.now();
            set(chatDegradedAtom, true);
            const basic = await basicTurn(trimmed, createDefaultDeps());
            set(chatMessagesAtom, (previous) =>
                append(
                    previous,
                    message("assistant", basic.text, basic.cards, basic.actions)
                )
            );
            return;
        }
        degradedAt = 0;
        set(chatDegradedAtom, false);
        set(chatMessagesAtom, (previous) =>
            append(
                previous,
                message("assistant", turn.text, turn.cards, turn.actions)
            )
        );
    } catch (error) {
        reportError(error, "assistant");
        set(chatMessagesAtom, (previous) =>
            append(
                previous,
                message(
                    "assistant",
                    translate(language, "assistant.errorSend"),
                    [],
                    ["form", "human"]
                )
            )
        );
    } finally {
        set(chatBusyAtom, false);
    }
});

const say = (
    set: (
        atom: typeof chatMessagesAtom,
        update: (previous: ChatMessage[]) => ChatMessage[]
    ) => void,
    text: string,
    cards: ChatCard[] = [],
    actions: QuickActionId[] = []
) =>
    set(chatMessagesAtom, (previous) =>
        append(previous, message("assistant", text, cards, actions))
    );

/**
 * The quick-reply buttons. State changes (the quote, the order, the hand-over)
 * run here, in code, never by the model's say-so; the model only talks.
 */
export const runActionAtom = atom(
    null,
    async (get, set, action: QuickActionId) => {
        const language = get(languageAtom);
        const deps = createDefaultDeps();
        const uid = get(sessionAtom)?.uid ?? null;
        const t = (
            key: Parameters<typeof translate>[1],
            params?: Record<string, string | number>
        ) => translate(language, key, params);

        switch (action) {
            case "continue": {
                if (!deps.getLockedQuote()) {
                    say(set, t("assistant.quoteExpired"));
                    return;
                }
                if (get(chatDegradedAtom)) {
                    const next = askNext(deps);
                    say(set, next.text, next.cards, next.actions);
                    return;
                }
                if (modelRecentlyDown()) {
                    const next = askNext(deps);
                    say(set, next.text, next.cards, next.actions);
                    return;
                }
                // Let the model ask the first question; the user sees no extra bubble.
                set(chatBusyAtom, true);
                try {
                    const turn = await runTurn(
                        getGraph(),
                        get(chatHistoryAtom),
                        "(The client pressed Continue on the rate card.)"
                    );
                    set(chatHistoryAtom, turn.history);
                    if (turn.degraded) {
                        degradedAt = Date.now();
                        set(chatDegradedAtom, true);
                        const next = askNext(deps);
                        say(set, next.text, next.cards, next.actions);
                    } else {
                        say(set, turn.text, turn.cards, turn.actions);
                    }
                } finally {
                    set(chatBusyAtom, false);
                }
                return;
            }
            case "changeAmount":
                say(set, t("assistant.greeting"), [], ["human", "form"]);
                return;
            case "human": {
                const outcome = await runTool(
                    "request_human",
                    {reason: "The client asked for a person."},
                    deps
                );
                track(uid, "human_requested", "assistant");
                say(
                    set,
                    t("assistant.humanHandoff"),
                    outcome.cards ?? [],
                    outcome.actions ?? ["form"]
                );
                return;
            }
            case "review": {
                set(chatBusyAtom, true);
                try {
                    const order = await set(createOrderAtom);
                    track(uid, "data_completed", "assistant", {
                        orderId: order.orderId,
                    });
                    say(
                        set,
                        t("assistant.orderCreated", {id: order.orderId}),
                        [{kind: "payment", orderId: order.orderId}],
                        ["paid", "human"]
                    );
                } catch (error) {
                    if (!(error instanceof DraftIncompleteError)) {
                        reportError(error, "assistantCreateOrder");
                    }
                    const quoteExpired = !deps.getLockedQuote();
                    say(
                        set,
                        quoteExpired
                            ? t("assistant.quoteExpired")
                            : t("assistant.invalid"),
                        [],
                        ["human", "form"]
                    );
                } finally {
                    set(chatBusyAtom, false);
                }
                return;
            }
            case "paid":
            case "proof": {
                const orderId = get(activeOrderIdAtom);
                if (!orderId) {
                    say(set, t("assistant.noOrder"), [], ["human"]);
                    return;
                }
                track(uid, "paid_tapped", "assistant", {orderId});
                say(
                    set,
                    t("assistant.proofCard"),
                    [{kind: "proof", orderId}],
                    ["human"]
                );
                return;
            }
            case "status": {
                const outcome = await runTool("get_order_status", {}, deps);
                if (outcome.cards?.length) {
                    say(
                        set,
                        t("assistant.statusIntro"),
                        outcome.cards,
                        outcome.actions ?? ["human"]
                    );
                } else {
                    say(set, t("assistant.noOrder"), [], ["human"]);
                }
                return;
            }
            case "form":
                // Navigation lives in the screen (it owns the router).
                return;
        }
    }
);

/** The proof card reports back here once the photo and number are saved. */
export const proofSubmittedAtom = atom(null, (get, set, orderId: string) => {
    const language = get(languageAtom);
    track(get(sessionAtom)?.uid ?? null, "proof_submitted", "assistant", {
        orderId,
    });
    say(
        set,
        translate(language, "assistant.proofSaved"),
        [{kind: "status", orderId}],
        ["human"]
    );
});

export const resetChatAtom = atom(null, (_get, set) => {
    set(chatMessagesAtom, []);
    set(chatHistoryAtom, []);
    set(chatDegradedAtom, false);
    set(chatBusyAtom, false);
    // A new conversation starts from the quote step, not from yesterday's rate.
    set(lockedQuoteAtom, null);
    degradedAt = 0;
});
