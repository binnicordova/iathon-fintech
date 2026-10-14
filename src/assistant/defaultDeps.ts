import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import {getDefaultStore} from "jotai";
import type {AssistantDeps} from "@/assistant/deps";
import type {Order} from "@/models/order";
import {db} from "@/services/firebase/app";
import {languageAtom} from "@/stores/language";
import {activeOrderIdAtom, clientDraftAtom, profileAtom} from "@/stores/order";
import {lockedQuoteAtom, lockQuoteAtom, quoteDraftAtom} from "@/stores/quote";
import {sessionAtom} from "@/stores/session";

/** The real stores and Cloud Functions behind the assistant's tools. */
export const createDefaultDeps = (): AssistantDeps => {
    const store = getDefaultStore();

    return {
        now: () => new Date(),
        language: () => store.get(languageAtom),
        channel: "assistant",
        getDraft: () => store.get(clientDraftAtom),
        updateDraft: (update) =>
            store.set(clientDraftAtom, (previous) => ({
                ...previous,
                ...update,
            })),
        getProfile: () => store.get(profileAtom),
        getLockedQuote: () => {
            const quote = store.get(lockedQuoteAtom);
            return quote && new Date(quote.expiresAt).getTime() > Date.now()
                ? quote
                : null;
        },
        lockQuote: ({amount, amountKind, sendCurrency, receiveCurrency}) => {
            // Mirror the chat into the calculator, so the form shows the same quote.
            store.set(quoteDraftAtom, {
                sendCurrency,
                receiveCurrency,
                editing: amountKind,
                sendText: amountKind === "send" ? String(amount) : "",
                receiveText: amountKind === "receive" ? String(amount) : "",
            });
            return store.set(lockQuoteAtom, "assistant");
        },
        getActiveOrderId: () => store.get(activeOrderIdAtom),
        fetchOrder: async (orderId) => {
            if (orderId) {
                const snap = await getDoc(doc(db, "orders", orderId));
                return snap.exists() ? (snap.data() as Order) : null;
            }
            const uid = store.get(sessionAtom)?.uid;
            if (!uid) {
                return null;
            }
            const latest = await getDocs(
                query(
                    collection(db, "orders"),
                    where("uid", "==", uid),
                    orderBy("createdAt", "desc"),
                    limit(1)
                )
            );
            return latest.empty ? null : (latest.docs[0].data() as Order);
        },
    };
};
