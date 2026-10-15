import {type ClientDraft, EMPTY_CLIENT_DRAFT} from "@/models/draft";
import {nextMissingField, validateClientDraft} from "./clientDraft";

const complete: ClientDraft = {
    clientName: "Ana Torres",
    email: "ana@correo.pe",
    docType: "DNI",
    docNumber: "12345678",
    fundsSource: "savings",
    sourceBank: "Nubank",
    sourceAccount: "0011 2233 4455",
    destinationBank: "BCP",
    destinationAccount: "191-12345678-0-12",
};

describe("validateClientDraft", () => {
    it("accepts a complete draft", () => {
        expect(validateClientDraft(complete)).toEqual({});
    });

    it("flags every empty field of a new draft", () => {
        expect(
            Object.keys(validateClientDraft(EMPTY_CLIENT_DRAFT)).sort()
        ).toEqual([
            "clientName",
            "destinationAccount",
            "destinationBank",
            "docNumber",
            "email",
            "fundsSource",
            "sourceBank",
        ]);
    });

    it("validates the document against its type", () => {
        expect(
            validateClientDraft({...complete, docType: "CPF", docNumber: "123"})
                .docNumber
        ).toBe("data.err.doc");
        expect(
            validateClientDraft({
                ...complete,
                docType: "CPF",
                docNumber: "529.982.247-25",
            })
        ).toEqual({});
    });
});

describe("origin account", () => {
    it("is optional: only the bank you pay from is asked", () => {
        expect(validateClientDraft({...complete, sourceAccount: ""})).toEqual(
            {}
        );
    });
});

describe("nextMissingField", () => {
    it("asks in the order of the form, one at a time", () => {
        expect(nextMissingField(EMPTY_CLIENT_DRAFT)).toBe("docNumber");
        expect(
            nextMissingField({...EMPTY_CLIENT_DRAFT, docNumber: "12345678"})
        ).toBe("clientName");
        expect(nextMissingField({...complete, destinationAccount: ""})).toBe(
            "destinationAccount"
        );
    });

    it("returns null when nothing is missing", () => {
        expect(nextMissingField(complete)).toBeNull();
    });
});
