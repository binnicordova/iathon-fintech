import {z} from "zod";
import type {AssistantRequest} from "@/services/api";

type JsonSchema = Record<string, unknown>;

/**
 * The Gemini API accepts a small OpenAPI-style subset and rejects the whole
 * request on any other keyword (`$schema`, `additionalProperties`,
 * `exclusiveMinimum`, ...). Keep only what it documents.
 */
const SCHEMA_KEYS = new Set([
    "type",
    "format",
    "description",
    "nullable",
    "enum",
    "maxItems",
    "minItems",
    "required",
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "default",
]);

const sanitize = (node: unknown): JsonSchema => {
    const source = (node ?? {}) as JsonSchema;
    const out: JsonSchema = {};
    for (const [key, value] of Object.entries(source)) {
        if (SCHEMA_KEYS.has(key)) {
            out[key] = value;
        }
    }
    if (source.properties && typeof source.properties === "object") {
        out.properties = Object.fromEntries(
            Object.entries(source.properties as JsonSchema).map(
                ([name, child]) => [name, sanitize(child)]
            )
        );
    }
    if (source.items) {
        out.items = sanitize(source.items);
    }
    if (Array.isArray(source.anyOf)) {
        out.anyOf = source.anyOf.map(sanitize);
    }
    return out;
};

export const toFunctionDeclaration = (
    name: string,
    description: string,
    schema: z.ZodType
): AssistantRequest["functionDeclarations"][number] => ({
    name,
    description,
    parameters: sanitize(z.toJSONSchema(schema)),
});
