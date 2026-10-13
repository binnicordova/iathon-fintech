import {
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    signOut,
    type User,
} from "firebase/auth";
import type {StaffRole} from "@/models/staff";
import {STAFF_ROLES} from "@/models/staff";
import {auth} from "@/services/firebase/auth";

export type Session = {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
    role: StaffRole | null;
};

const toSession = async (user: User): Promise<Session> => {
    const token = await user.getIdTokenResult();
    const claim = token.claims.role;
    const role =
        typeof claim === "string" &&
        (STAFF_ROLES as readonly string[]).includes(claim)
            ? (claim as StaffRole)
            : null;
    return {
        uid: user.uid,
        email: user.email,
        isAnonymous: user.isAnonymous,
        role,
    };
};

/**
 * Every client gets a silent anonymous account, so they can quote, pay and
 * come back to their orders without a sign-up step. Staff sign in with email.
 */
export const watchSession = (
    onSession: (session: Session | null) => void,
    onError: (error: unknown) => void
): (() => void) => {
    let started = false;
    return onAuthStateChanged(
        auth,
        async (user) => {
            try {
                if (user) {
                    onSession(await toSession(user));
                    return;
                }
                if (!started) {
                    started = true;
                    await signInAnonymously(auth);
                }
            } catch (error) {
                onError(error);
            }
        },
        onError
    );
};

export const signInStaff = async (
    email: string,
    password: string
): Promise<Session> => {
    const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
    );
    // Claims are baked into the ID token: force a refresh to see a new role.
    await credential.user.getIdToken(true);
    return toSession(credential.user);
};

/** Back to a fresh anonymous client session. */
export const signOutStaff = async (): Promise<void> => {
    await signOut(auth);
    await signInAnonymously(auth);
};
