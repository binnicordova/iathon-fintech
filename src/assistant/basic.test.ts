import {
    askNext,
    basicTurn,
    parseFundsSource,
    parseQuoteIntent,
} from "@/assistant/basic";
import type {AssistantDeps} from "@/assistant/deps";
import {type ClientDraft, EMPTY_CLIENT_DRAFT} from "@/models/draft";
import type {Quote} from "@/models/quote";

describe("parseQuoteIntent", () => {
    it.each([
        [
            "quiero enviar 500 reales a Perú",
            {amount: 500, sendCurrency: "BRL", receiveCurrency: "PEN"},
        ],
        [
            "envío 1.000 soles a Brasil",
            {amount: 1000, sendCurrency: "PEN", receiveCurrency: "BRL"},
        ],
        [
            "cambiar 200 dólares a reales",
            {amount: 200, sendCurrency: "USD", receiveCurrency: "BRL"},
        ],
        [
            "R$ 2.500 para PEN",
            {amount: 2500, sendCurrency: "BRL", receiveCurrency: "PEN"},
        ],
        [
            "5,000 USD",
            {amount: 5000, sendCurrency: "USD", receiveCurrency: "PEN"},
        ],
        [
            "I want to send 300 BRL",
            {amount: 300, sendCurrency: "BRL", receiveCurrency: "PEN"},
        ],
    ])("reads %s", (text, expected) => {
        expect(parseQuoteIntent(text)).toEqual(expected);
    });

    it("returns null without an amount or a currency", () => {
        expect(parseQuoteIntent("hola")).toBeNull();
        expect(parseQuoteIntent("quiero enviar dinero a Perú")).toBeNull();
        expect(parseQuoteIntent("500")).toBeNull();
    });
});

describe("parseFundsSource", () => {
    it("maps everyday words in three languages", () => {
        expect(parseFundsSource("mis ahorros")).toBe("savings");
        expect(parseFundsSource("meu salário")).toBe("salary");
        expect(parseFundsSource("business income")).toBe("business");
        expect(parseFundsSource("venta de un auto")).toBe("asset_sale");
        expect(parseFundsSource("xyz")).toBeNull();
    });
});

const QUOTE = {
    id: "q",
    sendCurrency: "BRL",
    receiveCurrency: "PEN",
    sendAmount: 500,
} as Quote;

const makeDeps = (quote: Quote | null = null) => {
    let draft: ClientDraft = {...EMPTY_CLIENT_DRAFT};
    return {
        now: () => new Date(),
        language: () => "es",
        channel: "assistant",
        getDraft: () => draft,
        updateDraft: (update: Partial<ClientDraft>) => {
            draft = {...draft, ...update};
        },
        getProfile: () => null,
        getLockedQuote: () => quote,
        lockQuote: jest.fn(async () => QUOTE),
        getActiveOrderId: () => null,
        fetchOrder: jest.fn(async () => null),
    } as unknown as AssistantDeps;
};

describe("basicTurn", () => {
    it("quotes from a plain sentence", async () => {
        const deps = makeDeps();
        const reply = await basicTurn("500 reales a Perú", deps);
        expect(reply.cards).toEqual([{kind: "quote", quote: QUOTE}]);
        expect(reply.actions).toContain("continue");
    });

    it("greets when it cannot read an amount", async () => {
        const reply = await basicTurn("hola", makeDeps());
        expect(reply.text).toContain("¿Cuánto quieres enviar");
    });

    it("walks the data fields one question at a time", async () => {
        const deps = makeDeps(QUOTE);
        expect(askNext(deps).text).toBe("¿Cuál es tu DNI o CPF?");

        let reply = await basicTurn("529.982.247-25", deps);
        expect(deps.getDraft().docNumber).toBe("52998224725");
        expect(reply.text).toBe("¿Cuál es tu nombre completo?");

        reply = await basicTurn("Ana Paula Souza", deps);
        reply = await basicTurn("ana@example.com", deps);
        expect(reply.text).toContain("¿De dónde provienen los fondos?");

        reply = await basicTurn("mis ahorros", deps);
        expect(deps.getDraft().fundsSource).toBe("savings");
    });

    it("re-asks when an answer is invalid", async () => {
        const deps = makeDeps(QUOTE);
        const reply = await basicTurn("123", deps);
        expect(reply.text).toContain("no parece válido");
        expect(reply.text).toContain("¿Cuál es tu DNI o CPF?");
        expect(deps.getDraft().docNumber).toBe("");
    });

    it("finishes with the review card", async () => {
        const deps = makeDeps(QUOTE);
        deps.updateDraft({
            clientName: "Ana Paula Souza",
            email: "ana@example.com",
            docType: "CPF",
            docNumber: "52998224725",
            fundsSource: "savings",
            sourceBank: "Nubank",
            sourceAccount: "0001 12345-6",
            destinationBank: "BCP",
        });
        const reply = await basicTurn("191-12345678-0-12", deps);
        expect(reply.cards).toEqual([{kind: "review", quote: QUOTE}]);
        expect(reply.actions).toEqual(["review", "form", "human"]);
    });
});
