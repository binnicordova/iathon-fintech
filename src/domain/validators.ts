import type {DocType} from "../models/order";

const onlyDigits = (value: string): string => value.replace(/\D/g, "");

export const normalizeDocNumber = (docType: DocType, value: string): string =>
    docType === "CE" ? value.trim().toUpperCase() : onlyDigits(value);

export const isValidCpf = (value: string): boolean => {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }
    const check = (length: number): number => {
        let sum = 0;
        for (let i = 0; i < length; i += 1) {
            sum += Number(cpf[i]) * (length + 1 - i);
        }
        const rest = (sum * 10) % 11;
        return rest === 10 ? 0 : rest;
    };
    return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
};

export const isValidRuc = (value: string): boolean => {
    const ruc = onlyDigits(value);
    if (ruc.length !== 11 || !/^(10|15|17|20)/.test(ruc)) {
        return false;
    }
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(ruc[i]), 0);
    const digit = (11 - (sum % 11)) % 10;
    return digit === Number(ruc[10]);
};

export const isValidDocNumber = (docType: DocType, value: string): boolean => {
    switch (docType) {
        case "DNI":
            return /^\d{8}$/.test(onlyDigits(value));
        case "CE":
            return /^[A-Z0-9]{9,12}$/.test(value.trim().toUpperCase());
        case "RUC":
            return isValidRuc(value);
        case "CPF":
            return isValidCpf(value);
    }
};

export const isValidEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const isValidName = (value: string): boolean =>
    value.trim().length >= 3 && /\s/.test(value.trim());

export const isValidOperationNo = (value: string): boolean =>
    /^[A-Za-z0-9-]{4,24}$/.test(value.trim());

export const isValidAccount = (value: string): boolean =>
    value.trim().length >= 4;

/** Document type is inferable from the number for the common cases. */
export const guessDocType = (value: string): DocType | null => {
    const digits = onlyDigits(value);
    if (/^[A-Za-z]/.test(value.trim())) {
        return "CE";
    }
    if (digits.length === 8) {
        return "DNI";
    }
    if (digits.length === 11) {
        return isValidCpf(digits) ? "CPF" : isValidRuc(digits) ? "RUC" : null;
    }
    return null;
};

/** Hides all but the last digits, for chat bubbles and receipts. */
export const maskAccount = (value: string): string => {
    const clean = value.replace(/\s/g, "");
    return clean.length <= 4 ? clean : `•••${clean.slice(-4)}`;
};
