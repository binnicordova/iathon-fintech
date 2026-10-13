import type {Currency, Language} from "./currency";
import type {DocType} from "./order";

export type SavedAccount = {
    id: string;
    bank: string;
    accountNumber: string;
    currency: Currency;
};

/** `clients/{uid}`: saved so returning clients do not retype. */
export type ClientProfile = {
    clientName: string;
    email: string;
    docType: DocType;
    docNumber: string;
    language: Language;
    accounts: SavedAccount[];
    updatedAt: string;
};
