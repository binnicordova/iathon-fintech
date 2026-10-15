import {
    AIMessage,
    type BaseMessage,
    HumanMessage,
    ToolMessage,
} from "@langchain/core/messages";
import {
    Annotation,
    END,
    MessagesAnnotation,
    START,
    StateGraph,
} from "@langchain/langgraph/web";
import type {AssistantDeps} from "@/assistant/deps";
import {fromParts, type Generate, toContents} from "@/assistant/model";
import {buildSystemPrompt, type PromptContext} from "@/assistant/prompt";
import {runTool, TOOL_DECLARATIONS} from "@/assistant/tools";
import type {ChatCard, QuickActionId} from "@/assistant/types";
import {type TranslationKey, translate} from "@/i18n";
import {nextMissingField, validateClientDraft} from "@/utils/clientDraft";

const FIELDS = [
    "docNumber",
    "clientName",
    "email",
    "fundsSource",
    "sourceBank",
    "destinationBank",
    "destinationAccount",
] as const;

/**
 * Messages plus what the UI needs to draw: cards made from system data and the
 * quick replies to offer. Each run starts with empty cards/actions.
 */
const AssistantState = Annotation.Root({
    ...MessagesAnnotation.spec,
    cards: Annotation<ChatCard[]>({
        reducer: (left, right) => left.concat(right),
        default: () => [],
    }),
    actions: Annotation<QuickActionId[]>({
        reducer: (left, right) => (right.length > 0 ? right : left),
        default: () => [],
    }),
    /** True when the model could not be reached and the app answered itself. */
    degraded: Annotation<boolean>({
        reducer: (_left, right) => right,
        default: () => false,
    }),
});

export type AssistantState = typeof AssistantState.State;

/** Never more than a few tool rounds per client message. */
const RECURSION_LIMIT = 10;
const MAX_HISTORY = 30;

export type Span = <T>(
    options: {
        name: string;
        op: string;
        attributes?: Record<string, string | number | boolean>;
    },
    callback: () => Promise<T>
) => Promise<T>;

export type GraphOptions = {
    deps: AssistantDeps;
    generate: Generate;
    /** Sentry's `instrumentStateGraph`, injected so tests need no SDK. */
    instrument?: (
        builder: unknown,
        options: {recordInputs: boolean; recordOutputs: boolean}
    ) => unknown;
    recordContent?: boolean;
    span?: Span;
    model?: string;
};

const passthroughSpan: Span = (_options, callback) => callback();

export const buildPromptContext = async (
    deps: AssistantDeps
): Promise<PromptContext> => {
    const draft = deps.getDraft();
    const errors = validateClientDraft(draft);
    const order = await deps
        .fetchOrder(deps.getActiveOrderId())
        .catch(() => null);
    return {
        language: deps.language(),
        now: deps.now().toISOString(),
        hasQuote: deps.getLockedQuote() !== null,
        collectedFields: FIELDS.filter((field) => !errors[field]),
        nextField: nextMissingField(draft),
        activeOrder: order
            ? {orderId: order.orderId, status: order.status}
            : null,
        savedAccounts: deps.getProfile()?.accounts.length ?? 0,
    };
};

export const buildAssistantGraph = ({
    deps,
    generate,
    instrument,
    recordContent = false,
    span = passthroughSpan,
    model = "gemma",
}: GraphOptions) => {
    const agent = async (state: AssistantState) => {
        try {
            const context = await buildPromptContext(deps);
            const response = await span(
                {
                    name: `chat ${model}`,
                    op: "gen_ai.chat",
                    attributes: {
                        "gen_ai.system": "google",
                        "gen_ai.request.model": model,
                    },
                },
                () =>
                    generate({
                        systemInstruction: buildSystemPrompt(context),
                        contents: toContents(state.messages),
                        functionDeclarations: TOOL_DECLARATIONS,
                        temperature: 0.2,
                        maxOutputTokens: 500,
                    })
            );
            const message = fromParts(response.parts);
            if (
                message.content === "" &&
                (message.tool_calls ?? []).length === 0
            ) {
                throw new Error("empty-model-response");
            }
            return {messages: [message]};
        } catch {
            return {
                messages: [
                    new AIMessage(
                        translate(deps.language(), "assistant.fallback")
                    ),
                ],
                actions: ["form", "human"] as QuickActionId[],
                degraded: true,
            };
        }
    };

    const tools = async (state: AssistantState) => {
        const last = state.messages.at(-1);
        const calls = last instanceof AIMessage ? (last.tool_calls ?? []) : [];
        const messages: ToolMessage[] = [];
        const cards: ChatCard[] = [];
        let actions: QuickActionId[] = [];
        const replies: TranslationKey[] = [];

        for (const call of calls) {
            const outcome = await span(
                {
                    name: `execute_tool ${call.name}`,
                    op: "gen_ai.execute_tool",
                    attributes: {"gen_ai.tool.name": call.name},
                },
                () => runTool(call.name, call.args, deps)
            );
            cards.push(...(outcome.cards ?? []));
            if (outcome.actions?.length) {
                actions = outcome.actions;
            }
            if (outcome.reply) {
                replies.push(outcome.reply);
            }
            messages.push(
                new ToolMessage({
                    content: JSON.stringify(outcome.result),
                    tool_call_id: call.id ?? call.name,
                    name: call.name,
                })
            );
        }
        // Every tool had a canned line: answer now instead of asking the model
        // to put a card into words. Anything else goes back to the model.
        const canned =
            calls.length > 0 && replies.length === calls.length
                ? [new AIMessage(translate(deps.language(), replies[0]))]
                : [];
        return {messages: [...messages, ...canned], cards, actions};
    };

    const route = (state: AssistantState): "tools" | typeof END => {
        const last = state.messages.at(-1);
        return last instanceof AIMessage && (last.tool_calls ?? []).length > 0
            ? "tools"
            : END;
    };

    const afterTools = (state: AssistantState): "agent" | typeof END =>
        state.messages.at(-1) instanceof AIMessage ? END : "agent";

    const builder = new StateGraph(AssistantState)
        .addNode("agent", agent)
        .addNode("tools", tools)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", route, ["tools", END])
        .addConditionalEdges("tools", afterTools, ["agent", END]);

    // Sentry's React Native SDK cannot auto-instrument LangGraph: wrap the graph
    // before compiling to get gen_ai.create_agent / gen_ai.invoke_agent spans.
    instrument?.(builder, {
        recordInputs: recordContent,
        recordOutputs: recordContent,
    });

    return builder.compile({name: "brasper_assistant"});
};

export type AssistantGraph = ReturnType<typeof buildAssistantGraph>;

export type TurnResult = {
    /** The full conversation, ready to be passed back in on the next turn. */
    history: BaseMessage[];
    text: string;
    cards: ChatCard[];
    actions: QuickActionId[];
    degraded: boolean;
};

const lastAssistantText = (messages: BaseMessage[]): string => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (
            message instanceof AIMessage &&
            typeof message.content === "string" &&
            message.content.trim()
        ) {
            return message.content.trim();
        }
        if (message instanceof HumanMessage) {
            break;
        }
    }
    return "";
};

/** Keeps the tail of the conversation, starting on a user turn so tool calls stay paired. */
export const trimHistory = (messages: BaseMessage[]): BaseMessage[] => {
    if (messages.length <= MAX_HISTORY) {
        return messages;
    }
    const tail = messages.slice(-MAX_HISTORY);
    const start = tail.findIndex((message) => message instanceof HumanMessage);
    return start === -1 ? [] : tail.slice(start);
};

export const runTurn = async (
    graph: AssistantGraph,
    history: BaseMessage[],
    userText: string
): Promise<TurnResult> => {
    const input = [...history, new HumanMessage(userText)];
    const state = await graph.invoke(
        {messages: input},
        {recursionLimit: RECURSION_LIMIT}
    );
    return {
        history: trimHistory(state.messages),
        text: lastAssistantText(state.messages),
        cards: state.cards,
        actions: state.actions,
        degraded: state.degraded,
    };
};
