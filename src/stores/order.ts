import {doc, getDoc} from "firebase/firestore";
import {atom} from "jotai";
import {STORAGE_KEYS} from "@/constants/storage";
import {normalizeDocNumber} from "@/domain/validators";
import type {ClientProfile} from "@/models/client";
import {type ClientDraft, EMPTY_CLIENT_DRAFT} from "@/models/draft";
import type {Order} from "@/models/order";
import {api} from "@/services/api";
import {db} from "@/services/firebase/app";
import {languageAtom} from "@/stores/language";
import {persistedAtom} from "@/stores/persisted";
import {lockedQuoteAtom} from "@/stores/quote";
import {sessionAtom} from "@/stores/session";
import {validateClientDraft} from "@/utils/clientDraft";

export const clientDraftAtom = persistedAtom<ClientDraft>(
    STORAGE_KEYS.clientDraft,
    EMPTY_CLIENT_DRAFT
);

export const activeOrderIdAtom = persistedAtom<string | null>(
    STORAGE_KEYS.activeOrderId,
    null
);

export const profileAtom = atom<ClientProfile | null>(null);

/** Saved name, document and accounts, so a returning client does not retype. */
export const loadProfileAtom = atom(null, async (get, set) => {
    const session = get(sessionAtom);
    if (!session) {
        return;
    }
    const snap = await getDoc(doc(db, "clients", session.uid));
    if (!snap.exists()) {
        return;
    }
    const profile = snap.data() as ClientProfile;
    set(profileAtom, profile);
    const draft = get(clientDraftAtom);
    set(clientDraftAtom, {
        ...draft,
        clientName: draft.clientName || profile.clientName,
        email: draft.email || profile.email,
        docType: draft.docNumber ? draft.docType : profile.docType,
        docNumber: draft.docNumber || profile.docNumber,
    });
});

export class DraftIncompleteError extends Error {
    constructor() {
        super("draft-incomplete");
        this.name = "DraftIncompleteError";
    }
}

/**
 * Creates the order from the locked quote plus what the client typed. Shared by
 * the form and the assistant, so both leave exactly the same record behind.
 */
export const createOrderAtom = atom(null, async (get, set): Promise<Order> => {
    const quote = get(lockedQuoteAtom);
    const draft = get(clientDraftAtom);
    if (
        !quote ||
        Object.keys(validateClientDraft(draft)).length > 0 ||
        !draft.fundsSource
    ) {
        throw new DraftIncompleteError();
    }
    const order = await api.createOrder({
        quoteId: quote.id,
        language: get(languageAtom),
        clientName: draft.clientName.trim(),
        email: draft.email.trim(),
        docType: draft.docType,
        docNumber: normalizeDocNumber(draft.docType, draft.docNumber),
        fundsSource: draft.fundsSource,
        sourceBank: draft.sourceBank.trim(),
        sourceAccount: draft.sourceAccount.trim(),
        destinationBank: draft.destinationBank.trim(),
        destinationAccount: draft.destinationAccount.trim(),
    });
    set(activeOrderIdAtom, order.orderId);
    set(lockedQuoteAtom, null);
    // Account details are per-order; keep identity but start the next draft clean.
    set(clientDraftAtom, {
        ...EMPTY_CLIENT_DRAFT,
        clientName: draft.clientName,
        email: draft.email,
        docType: draft.docType,
        docNumber: draft.docNumber,
    });
    return order;
});
