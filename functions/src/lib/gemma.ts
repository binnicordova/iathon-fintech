import {HttpsError} from "firebase-functions/https";
import {z} from "zod";

/**
 * Wire format between the app's LangGraph agent and the Gemini API. We accept
 * only these shapes, so a modified client cannot smuggle in other models,
 * safety settings, huge prompts or tool access.
 */
const Args = z.record(z.string(), z.unknown());

const Part = z.object({
    text: z.string().max(8000).optional(),
    functionCall: z.object({name: z.string().max(64), args: Args}).optional(),
    functionResponse: z.object({name: z.string().max(64), response: Args}).optional(),
    thoughtSignature: z.string().max(4000).optional(),
});

const Content = z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(Part).min(1).max(8),
});

const FunctionDeclaration = z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]{0,48}$/),
    description: z.string().max(800),
    parameters: z.record(z.string(), z.unknown()).optional(),
});

const AssistantRequest = z.object({
    systemInstruction: z.string().max(14000),
    contents: z.array(Content).min(1).max(60),
    functionDeclarations: z.array(FunctionDeclaration).max(16).default([]),
    temperature: z.number().min(0).max(1).default(0.3),
    maxOutputTokens: z.number().int().min(16).max(1024).default(600),
});

export type AssistantRequest = z.infer<typeof AssistantRequest>;

export const parseAssistantRequest = (data: unknown): AssistantRequest => {
    const result = AssistantRequest.safeParse(data);
    if (!result.success) {
        throw new HttpsError("invalid-argument", "invalid-assistant-request");
    }
    return result.data;
};

export const buildGeminiRequest = (input: AssistantRequest) => ({
    systemInstruction: {parts: [{text: input.systemInstruction}]},
    contents: input.contents,
    ...(input.functionDeclarations.length > 0
        ? {tools: [{functionDeclarations: input.functionDeclarations}]}
        : {}),
    generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
    },
});

type GeminiResponse = {
    candidates?: Array<{
        content?: {parts?: Array<Record<string, unknown>>};
        finishReason?: string;
    }>;
    usageMetadata?: {promptTokenCount?: number; candidatesTokenCount?: number};
};

/** Keeps the parts the agent needs and drops internal "thought" text. */
export const parseGeminiResponse = (json: unknown) => {
    const body = json as GeminiResponse;
    const candidate = body.candidates?.[0];
    const parts = (candidate?.content?.parts ?? [])
        .filter((part) => part.thought !== true)
        .map((part) => ({
            ...(typeof part.text === "string" ? {text: part.text} : {}),
            ...(part.functionCall ? {functionCall: part.functionCall} : {}),
            ...(typeof part.thoughtSignature === "string"
                ? {thoughtSignature: part.thoughtSignature}
                : {}),
        }))
        .filter((part) => Object.keys(part).length > 0);
    return {
        parts,
        finishReason: candidate?.finishReason ?? "UNKNOWN",
        usage: {
            promptTokens: body.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        },
    };
};
