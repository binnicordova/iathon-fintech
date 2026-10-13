import {
    isValidAccount,
    isValidDocNumber,
    isValidEmail,
    isValidName,
} from "@/domain/validators";
import type {TranslationKey} from "@/i18n";
import type {ClientDraft} from "@/models/draft";

export type DraftField = keyof ClientDraft;

export type DraftErrors = Partial<Record<DraftField, TranslationKey>>;

/** One message per invalid field; an empty object means ready to continue. */
export const validateClientDraft = (draft: ClientDraft): DraftErrors => {
    const errors: DraftErrors = {};
    if (!isValidName(draft.clientName)) {
        errors.clientName = "data.err.name";
    }
    if (!isValidEmail(draft.email)) {
        errors.email = "data.err.email";
    }
    if (!isValidDocNumber(draft.docType, draft.docNumber)) {
        errors.docNumber = "data.err.doc";
    }
    if (!draft.fundsSource) {
        errors.fundsSource = "data.err.funds";
    }
    if (draft.sourceBank.trim().length < 2) {
        errors.sourceBank = "data.err.bank";
    }
    if (!isValidAccount(draft.sourceAccount)) {
        errors.sourceAccount = "data.err.account";
    }
    if (draft.destinationBank.trim().length < 2) {
        errors.destinationBank = "data.err.bank";
    }
    if (!isValidAccount(draft.destinationAccount)) {
        errors.destinationAccount = "data.err.account";
    }
    return errors;
};

/** The first question the assistant still has to ask, in the order of the form. */
export const nextMissingField = (draft: ClientDraft): DraftField | null => {
    const order: DraftField[] = [
        "docNumber",
        "clientName",
        "email",
        "fundsSource",
        "sourceBank",
        "sourceAccount",
        "destinationBank",
        "destinationAccount",
    ];
    const errors = validateClientDraft(draft);
    return order.find((field) => errors[field]) ?? null;
};
