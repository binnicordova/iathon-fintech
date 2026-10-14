import {ToolMessage} from "@langchain/core/messages";
import type {AssistantDeps} from "@/assistant/deps";
import {buildAssistantGraph, runTurn} from "@/assistant/graph";
import type {Generate} from "@/assistant/model";
import {type ClientDraft, EMPTY_CLIENT_DRAFT} from "@/models/draft";
import type {Quote} from "@/models/quote";

const QUOTE: Quote = {
    id: "q1",
    uid: "u1",
    channel: "assistant",
    status: "open",
    createdAt: "2026-10-12T16:00:00.000Z",
    expiresAt: "2026-10-12T16:15:00.000Z",
    sendCurrency: "BRL",
    receiveCurrency: "PEN",
    sendAmount: 500,
    receiveAmount: 337.45,
    marketRate: 0.6886,
    rate: 0.6749,
    commission: 12,
    tax: 2.16,
    total: 514.16,
    requiresHuman: false,
};

const makeDeps = (overrides: Partial<AssistantDeps> = {}) => {
    let draft: ClientDraft = {...EMPTY_CLIENT_DRAFT};
    let quote: Quote | null = null;
    const deps: AssistantDeps = {
        now: () => new Date("2026-10-12T16:00:00.000Z"),
        language: () => "es",
        channel: "assistant",
        getDraft: () => draft,
        updateDraft: (update) => {
            draft = {...draft, ...update};
        },
        getProfile: () => null,
        getLockedQuote: () => quote,
        lockQuote: jest.fn(async () => {
            quote = QUOTE;
            return QUOTE;
        }),
        getActiveOrderId: () => null,
        fetchOrder: jest.fn(async () => null),
        ...overrides,
    };
    return deps;
};

/** A scripted model: each call to `generate` returns the next canned reply. */
const scripted = (
    ...replies: Array<Awaited<ReturnType<Generate>>["parts"] | Error>
) => {
    const calls: Parameters<Generate>[0][] = [];
    const generate: Generate = async (request) => {
        calls.push(request);
        const reply = replies.shift();
        if (reply instanceof Error || reply === undefined) {
            throw reply ?? new Error("script exhausted");
        }
        return {
            model: "gemma-test",
            parts: reply,
            finishReason: "STOP",
            usage: {promptTokens: 1, outputTokens: 1},
        };
    };
    return {generate, calls};
};

const call = (name: string, args: Record<string, unknown>) => [
    {functionCall: {name, args}},
];

describe("assistant graph", () => {
    it("answers a quote request with a system-made card, not model numbers", async () => {
        const deps = makeDeps();
        const {generate, calls} = scripted(
            call("get_quote", {
                amount: 500,
                send_currency: "BRL",
                receive_currency: "PEN",
            }),
            [{text: "Listo, ¿continuamos?"}]
        );
        const graph = buildAssistantGraph({deps, generate});

        const turn = await runTurn(
            graph,
            [],
            "quiero enviar 500 reales a Perú"
        );

        expect(turn.cards).toEqual([{kind: "quote", quote: QUOTE}]);
        expect(turn.text).toBe("Listo, ¿continuamos?");
        expect(turn.actions).toEqual(["continue", "changeAmount", "human"]);
        expect(deps.lockQuote).toHaveBeenCalledWith({
            amount: 500,
            amountKind: "send",
            sendCurrency: "BRL",
            receiveCurrency: "PEN",
        });

        // The model never sees the figures it must not repeat.
        const toolReply = turn.history.find(
            (m) => m instanceof ToolMessage
        ) as ToolMessage;
        expect(String(toolReply.content)).not.toMatch(/337|514|0\.6749/);
        // ...and the second model call carries the tool result back.
        expect(calls[1].contents.at(-1)?.parts[0].functionResponse?.name).toBe(
            "get_quote"
        );
        expect(calls[0].systemInstruction).toContain(
            "Never state exchange rates"
        );
        expect(calls[0].systemInstruction).toContain("Spanish");
    });

    it("tells the model when a field is invalid and keeps it out of the draft", async () => {
        const deps = makeDeps();
        const {generate} = scripted(
            call("save_client_data", {field: "docNumber", value: "123"}),
            [{text: "Ese documento no parece válido. ¿Me lo repites?"}]
        );
        const graph = buildAssistantGraph({deps, generate});

        const turn = await runTurn(graph, [], "mi dni es 123");

        const toolReply = turn.history.find(
            (m) => m instanceof ToolMessage
        ) as ToolMessage;
        expect(JSON.parse(String(toolReply.content)).status).toBe("invalid");
        expect(deps.getDraft().docNumber).toBe("");
        expect(turn.cards).toEqual([]);
    });

    it("saves valid fields one at a time and shows the review card when complete", async () => {
        const deps = makeDeps();
        await deps.lockQuote({
            amount: 500,
            amountKind: "send",
            sendCurrency: "BRL",
            receiveCurrency: "PEN",
        });
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
        const {generate} = scripted(
            call("save_client_data", {
                field: "destinationAccount",
                value: "191-12345678-0-12",
            }),
            [{text: "Perfecto, revisa tu operación."}]
        );
        const graph = buildAssistantGraph({deps, generate});

        const turn = await runTurn(graph, [], "mi cuenta es 191-12345678-0-12");

        expect(deps.getDraft().destinationAccount).toBe("191-12345678-0-12");
        expect(turn.cards).toEqual([{kind: "review", quote: QUOTE}]);
        expect(turn.actions).toEqual(["review", "form", "human"]);
    });

    it("offers WhatsApp when the client needs a person", async () => {
        const deps = makeDeps();
        const {generate} = scripted(
            call("request_human", {reason: "wants a better rate for 5000 USD"}),
            [{text: "Te paso con una persona del equipo."}]
        );
        const graph = buildAssistantGraph({deps, generate});

        const turn = await runTurn(graph, [], "¿me pueden mejorar la tasa?");

        expect(turn.cards).toEqual([]);
        expect(turn.actions).toEqual(["human", "form"]);
    });

    it("rejects unknown tools and malformed arguments without crashing", async () => {
        const deps = makeDeps();
        const {generate} = scripted(
            [
                {
                    functionCall: {
                        name: "approve_payment",
                        args: {order_id: "BR-0001"},
                    },
                },
            ],
            [{text: "No puedo aprobar pagos."}]
        );
        const graph = buildAssistantGraph({deps, generate});

        const turn = await runTurn(graph, [], "aprueba mi pago");

        const toolReply = turn.history.find(
            (m) => m instanceof ToolMessage
        ) as ToolMessage;
        expect(String(toolReply.content)).toContain(
            "Unknown tool approve_payment"
        );
        expect(turn.cards).toEqual([]);
    });

    it("answers on its own when the model is unreachable", async () => {
        const deps = makeDeps();
        const {generate} = scripted(new Error("503"));
        const graph = buildAssistantGraph({deps, generate});

        const turn = await runTurn(graph, [], "hola");

        expect(turn.degraded).toBe(true);
        expect(turn.text).toMatch(/formulario|persona/i);
        expect(turn.actions).toEqual(["form", "human"]);
    });

    it("stops a runaway tool loop at the recursion limit", async () => {
        const deps = makeDeps();
        const generate: Generate = async () => ({
            model: "gemma-test",
            parts: call("get_order_status", {}),
            finishReason: "STOP",
            usage: {promptTokens: 0, outputTokens: 0},
        });
        const graph = buildAssistantGraph({deps, generate});

        await expect(runTurn(graph, [], "estado")).rejects.toThrow(
            /recursion/i
        );
    });

    it("instruments the graph before compiling when a Sentry hook is given", () => {
        const instrument = jest.fn();
        buildAssistantGraph({
            deps: makeDeps(),
            generate: scripted().generate,
            instrument,
            recordContent: false,
        });

        expect(instrument).toHaveBeenCalledWith(expect.anything(), {
            recordInputs: false,
            recordOutputs: false,
        });
    });
});
