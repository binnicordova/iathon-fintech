import {
    guessDocType,
    isValidAccount,
    isValidCpf,
    isValidDocNumber,
    isValidEmail,
    isValidName,
    isValidOperationNo,
    isValidRuc,
    maskAccount,
    normalizeDocNumber,
} from "./validators";

describe("isValidCpf", () => {
    it("accepts a valid CPF with or without punctuation", () => {
        expect(isValidCpf("529.982.247-25")).toBe(true);
        expect(isValidCpf("52998224725")).toBe(true);
    });

    it("rejects wrong check digits and repeated digits", () => {
        expect(isValidCpf("529.982.247-24")).toBe(false);
        expect(isValidCpf("111.111.111-11")).toBe(false);
        expect(isValidCpf("123")).toBe(false);
    });
});

describe("isValidRuc", () => {
    it("checks the verification digit", () => {
        expect(isValidRuc("20100070970")).toBe(true);
        expect(isValidRuc("20100070971")).toBe(false);
        expect(isValidRuc("30100070970")).toBe(false);
    });
});

describe("isValidDocNumber", () => {
    it("validates each document type", () => {
        expect(isValidDocNumber("DNI", "12345678")).toBe(true);
        expect(isValidDocNumber("DNI", "1234567")).toBe(false);
        expect(isValidDocNumber("CE", "ab1234567")).toBe(true);
        expect(isValidDocNumber("CE", "123")).toBe(false);
        expect(isValidDocNumber("CPF", "529.982.247-25")).toBe(true);
        expect(isValidDocNumber("RUC", "20100070970")).toBe(true);
    });
});

describe("normalizeDocNumber", () => {
    it("strips punctuation except for CE", () => {
        expect(normalizeDocNumber("CPF", "529.982.247-25")).toBe("52998224725");
        expect(normalizeDocNumber("CE", " ab1234567 ")).toBe("AB1234567");
    });
});

describe("guessDocType", () => {
    it("infers the type from the number", () => {
        expect(guessDocType("12345678")).toBe("DNI");
        expect(guessDocType("529.982.247-25")).toBe("CPF");
        expect(guessDocType("20100070970")).toBe("RUC");
        expect(guessDocType("X1234567")).toBe("CE");
        expect(guessDocType("12")).toBeNull();
    });
});

describe("contact and payment fields", () => {
    it("validates email, name, operation number and account", () => {
        expect(isValidEmail("ana@correo.pe")).toBe(true);
        expect(isValidEmail("ana@correo")).toBe(false);
        expect(isValidName("Ana Torres")).toBe(true);
        expect(isValidName("Ana")).toBe(false);
        expect(isValidOperationNo("000123")).toBe(true);
        expect(isValidOperationNo("12")).toBe(false);
        expect(isValidAccount("0011 2233")).toBe(true);
        expect(isValidAccount("12")).toBe(false);
    });
});

describe("maskAccount", () => {
    it("keeps only the last four characters", () => {
        expect(maskAccount("0011 2233 4455 9956")).toBe("•••9956");
        expect(maskAccount("123")).toBe("123");
    });
});
