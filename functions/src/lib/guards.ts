import {type CallableRequest, HttpsError} from "firebase-functions/https";
import type {ZodType} from "zod";

export const requireAuth = (request: CallableRequest): string => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "sign-in-required");
    }
    return request.auth.uid;
};

export const parse = <T>(schema: ZodType<T>, data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new HttpsError(
            "invalid-argument",
            "invalid-input",
            result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }))
        );
    }
    return result.data;
};

export const nowIso = (): string => new Date().toISOString();
