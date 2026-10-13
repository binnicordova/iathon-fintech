import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {requireAuth} from "./lib/guards";
import {
    buildGeminiRequest,
    parseGeminiResponse,
    parseAssistantRequest,
} from "./lib/gemma";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
/** Gemma 4 through the Gemini API; override with GEMMA_MODEL in functions/.env. */
const gemmaModel = () => process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it";
/** Override only to point local tests at a mock (see scripts/mock-gemma.mjs). */
const geminiBaseUrl = () =>
    process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta";

/**
 * Proxy to Gemma (Google's open model, served by the Gemini API). The API key
 * stays here; the app only ever holds a Firebase session. The assistant graph
 * runs in the app and calls this for each model turn.
 */
export const assistantGenerate = onCall(
    {secrets: [GEMINI_API_KEY], timeoutSeconds: 60, memory: "256MiB", maxInstances: 5},
    async (request) => {
        requireAuth(request);
        const input = parseAssistantRequest(request.data);

        const model = gemmaModel();
        const response = await fetch(
            `${geminiBaseUrl()}/models/${model}:generateContent`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY.value(),
                },
                body: JSON.stringify(buildGeminiRequest(input)),
                signal: AbortSignal.timeout(50_000),
            }
        );

        if (!response.ok) {
            const detail = (await response.text()).slice(0, 300);
            logger.error("Gemma request failed", {status: response.status, detail});
            throw new HttpsError(
                response.status === 429 ? "resource-exhausted" : "unavailable",
                "model-unavailable"
            );
        }
        return {model, ...parseGeminiResponse(await response.json())};
    }
);
