import {onAuthStateChanged, signInAnonymously, type User} from "firebase/auth";
import {auth} from "@/services/firebase/auth";

export type Session = {
    uid: string;
    email: string | null;
    isAnonymous: boolean;
};

const toSession = (user: User): Session => ({
    uid: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
});

/**
 * Every client gets a silent anonymous account, so they can quote, pay and
 * come back to their orders without a sign-up step.
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
                    onSession(toSession(user));
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
