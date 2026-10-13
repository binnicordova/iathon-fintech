import {
    AIMessage,
    type BaseMessage,
    HumanMessage,
    ToolMessage,
} from "@langchain/core/messages";
import type {
    AssistantContent,
    AssistantPart,
    AssistantResponse,
} from "@/services/api";

export type Generate = (request: {
    systemInstruction: string;
    contents: AssistantContent[];
    functionDeclarations: Array<{
        name: string;
        description: string;
        parameters?: Record<string, unknown>;
    }>;
    temperature?: number;
    maxOutputTokens?: number;
}) => Promise<AssistantResponse>;

const textOf = (message: BaseMessage): string =>
    typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

const parseJson = (value: string): Record<string, unknown> => {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : {result: parsed};
    } catch {
        return {result: value};
    }
};

/**
 * LangChain messages → the Gemini wire format. The model's own parts (including
 * any thought signature) are replayed exactly as received, and the tool results
 * for one model turn are grouped into a single user turn, as the API expects.
 */
export const toContents = (messages: BaseMessage[]): AssistantContent[] => {
    const contents: AssistantContent[] = [];
    for (const message of messages) {
        if (message instanceof HumanMessage) {
            contents.push({role: "user", parts: [{text: textOf(message)}]});
        } else if (message instanceof AIMessage) {
            const replay = message.additional_kwargs.parts as
                | AssistantPart[]
                | undefined;
            const parts: AssistantPart[] = replay ?? [
                ...(textOf(message) ? [{text: textOf(message)}] : []),
                ...(message.tool_calls ?? []).map((call) => ({
                    functionCall: {
                        name: call.name,
                        args: call.args as Record<string, unknown>,
                    },
                })),
            ];
            if (parts.length > 0) {
                contents.push({role: "model", parts});
            }
        } else if (message instanceof ToolMessage) {
            const part: AssistantPart = {
                functionResponse: {
                    name: message.name ?? "tool",
                    response: parseJson(textOf(message)),
                },
            };
            const last = contents.at(-1);
            if (
                last &&
                last.role === "user" &&
                last.parts.every((p) => p.functionResponse)
            ) {
                last.parts.push(part);
            } else {
                contents.push({role: "user", parts: [part]});
            }
        }
    }
    return contents;
};

let callCounter = 0;
const nextCallId = (): string => {
    callCounter += 1;
    return `call_${callCounter}`;
};

/** Gemini parts → one AIMessage, with real tool calls LangGraph can route on. */
export const fromParts = (parts: AssistantPart[]): AIMessage => {
    const text = parts
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    const tool_calls = parts.flatMap((part) =>
        part.functionCall
            ? [
                  {
                      name: part.functionCall.name,
                      args: part.functionCall.args ?? {},
                      id: nextCallId(),
                      type: "tool_call" as const,
                  },
              ]
            : []
    );
    return new AIMessage({
        content: text,
        tool_calls,
        additional_kwargs: {parts},
    });
};
