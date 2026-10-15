import {type CallableRequest, HttpsError} from "firebase-functions/https";
import type {ZodType} from "zod";
import {db} from "./firebase";
import {STAFF_ROLES, type StaffRole} from "../shared/models/staff";

export const requireAuth = (request: CallableRequest): string => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "sign-in-required");
    }
    return request.auth.uid;
};

export type StaffIdentity = {uid: string; email: string; role: StaffRole};

/** Admin passes every check; otherwise the caller's role must be listed. */
export const requireStaff = async (
    request: CallableRequest,
    allowed: StaffRole[]
): Promise<StaffIdentity> => {
    const uid = requireAuth(request);
    // Grants for bridged identities are server-only, read on every staff action.
    const role = (
        uid.startsWith("supabase:")
            ? (await db().doc(`supabaseStaff/${uid}`).get()).data()?.role
            : request.auth?.token.role
    ) as StaffRole | undefined;
    if (!role || !STAFF_ROLES.includes(role)) {
        throw new HttpsError("permission-denied", "staff-only");
    }
    if (role !== "admin" && !allowed.includes(role)) {
        throw new HttpsError("permission-denied", "role-not-allowed");
    }
    return {uid, email: request.auth?.token.email ?? uid, role};
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
