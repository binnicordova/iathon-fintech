import {z} from "zod";
import type {AssistantDeps} from "@/assistant/deps";
import {toFunctionDeclaration} from "@/assistant/schema";
import type {ChatCard, QuickActionId} from "@/assistant/types";
import {QuoteError} from "@/domain/pricing";
import {
    guessDocType,
    isValidAccount,
    isValidDocNumber,
    isValidEmail,
    isValidName,
    maskAccount,
    normalizeDocNumber,
} from "@/domain/validators";
import {CURRENCIES} from "@/models/currency";
import type {ClientDraft} from "@/models/draft";
import {FUNDS_SOURCES} from "@/models/order";
import {ApiError, toApiError} from "@/services/apiError";
import {nextMissingField, validateClientDraft} from "@/utils/clientDraft";

export type ToolOutcome = {
    /** What the model sees. Deliberately free of amounts, rates and accounts. */
    result: Record<string, unknown>;
    cards?: ChatCard[];
    /** Quick replies to offer; the last tool to set any wins. */
    actions?: QuickActionId[];
};

type ToolDefinition<S extends z.ZodType> = {
    name: string;
    description: string;
    schema: S;
    execute(args: z.infer<S>, deps: AssistantDeps): Promise<ToolOutcome>;
};

const defineTool = <S extends z.ZodType>(tool: ToolDefinition<S>) => tool;

const FIELDS = [
    "docNumber",
    "clientName",
    "email",
    "fundsSource",
    "sourceBank",
    "sourceAccount",
    "destinationBank",
    "destinationAccount",
] as const;

const collectedFields = (draft: ClientDraft): string[] => {
    const errors = validateClientDraft(draft);
    return FIELDS.filter((field) => !errors[field]);
};

const getQuote = defineTool({
    name: "get_quote",
    description:
        "Price a transfer and lock the rate. Call it when the client gives an amount and currencies. The app shows the figures in a card.",
    schema: z.object({
        amount: z
            .number()
            .positive()
            .describe("The amount the client mentioned."),
        send_currency: z
            .enum(CURRENCIES)
            .describe("Currency the client sends."),
        receive_currency: z
            .enum(CURRENCIES)
            .describe("Currency the recipient receives."),
        amount_kind: z
            .enum(["send", "receive"])
            .default("send")
            .describe(
                "Whether the amount is what the client sends or what the recipient gets."
            ),
    }),
    async execute(args, deps) {
        if (args.send_currency === args.receive_currency) {
            return {
                result: {status: "invalid", problem: "Currencies must differ."},
            };
        }
        try {
            const quote = await deps.lockQuote({
                amount: args.amount,
                amountKind: args.amount_kind,
                sendCurrency: args.send_currency,
                receiveCurrency: args.receive_currency,
            });
            return {
                result: {
                    status: "quote_shown",
                    note: "A rate card with every figure is on screen. Do not repeat any numbers.",
                },
                cards: [{kind: "quote", quote}],
                actions: ["continue", "changeAmount", "human"],
            };
        } catch (error) {
            const failure =
                error instanceof QuoteError
                    ? error.code
                    : toApiError(error).code;
            if (failure === "requires-human") {
                return {
                    result: {
                        status: "requires_human",
                        note: "Large amounts are negotiated by a person. Offer to connect them.",
                    },
                    actions: ["human", "form"],
                };
            }
            if (failure === "rates-unavailable") {
                return {
                    result: {
                        status: "unavailable",
                        note: "Rates are not available right now.",
                    },
                    actions: ["human", "form"],
                };
            }
            return {
                result: {status: "error", code: failure},
                actions: ["changeAmount", "human"],
            };
        }
    },
});

type SaveResult =
    | {ok: true; update: Partial<ClientDraft>}
    | {ok: false; problem: string};

const validateField = (
    field: (typeof FIELDS)[number],
    raw: string,
    draft: ClientDraft
): SaveResult => {
    const value = raw.trim();
    switch (field) {
        case "docNumber": {
            const docType = guessDocType(value) ?? draft.docType;
            if (!isValidDocNumber(docType, value)) {
                return {
                    ok: false,
                    problem: "Not a valid DNI, CE, RUC or CPF number.",
                };
            }
            return {
                ok: true,
                update: {
                    docType,
                    docNumber: normalizeDocNumber(docType, value),
                },
            };
        }
        case "clientName":
            return isValidName(value)
                ? {ok: true, update: {clientName: value}}
                : {ok: false, problem: "Need first and last name."};
        case "email":
            return isValidEmail(value)
                ? {ok: true, update: {email: value.toLowerCase()}}
                : {ok: false, problem: "That email does not look valid."};
        case "fundsSource": {
            const match = FUNDS_SOURCES.find((source) => source === value);
            return match
                ? {ok: true, update: {fundsSource: match}}
                : {
                      ok: false,
                      problem: `Must be one of: ${FUNDS_SOURCES.join(", ")}.`,
                  };
        }
        case "sourceBank":
        case "destinationBank":
            return value.length >= 2
                ? {ok: true, update: {[field]: value}}
                : {ok: false, problem: "Need the bank name."};
        case "sourceAccount":
        case "destinationAccount":
            return isValidAccount(value)
                ? {ok: true, update: {[field]: value}}
                : {ok: false, problem: "Account number looks too short."};
    }
};

const afterSave = (deps: AssistantDeps): ToolOutcome => {
    const draft = deps.getDraft();
    const next = nextMissingField(draft);
    const quote = deps.getLockedQuote();
    if (next === null && quote) {
        return {
            result: {
                status: "saved",
                complete: true,
                note: "Everything is collected; a review card is shown.",
            },
            cards: [{kind: "review", quote}],
            actions: ["review", "form", "human"],
        };
    }
    return {
        result: {status: "saved", complete: false, next_missing_field: next},
        actions: ["human"],
    };
};

const saveClientData = defineTool({
    name: "save_client_data",
    description:
        "Save one field the client just told you. Returns whether it was valid and which field is still missing.",
    schema: z.object({
        field: z.enum(FIELDS),
        value: z
            .string()
            .min(1)
            .max(120)
            .describe(
                `The value as the client said it. For fundsSource it must be one of: ${FUNDS_SOURCES.join(", ")}.`
            ),
    }),
    async execute({field, value}, deps) {
        const checked = validateField(field, value, deps.getDraft());
        if (!checked.ok) {
            return {
                result: {status: "invalid", field, problem: checked.problem},
            };
        }
        deps.updateDraft(checked.update);
        return afterSave(deps);
    },
});

const listSavedAccounts = defineTool({
    name: "list_saved_accounts",
    description:
        "List the client's saved accounts (masked) that match the currency needed for the source or destination.",
    schema: z.object({role: z.enum(["source", "destination"])}),
    async execute({role}, deps) {
        const quote = deps.getLockedQuote();
        const currency = quote
            ? role === "source"
                ? quote.sendCurrency
                : quote.receiveCurrency
            : null;
        const accounts = (deps.getProfile()?.accounts ?? []).filter(
            (account) => currency === null || account.currency === currency
        );
        return {
            result: {
                accounts: accounts.map((account, index) => ({
                    index,
                    bank: account.bank,
                    masked: maskAccount(account.accountNumber),
                })),
            },
        };
    },
});

const useSavedAccount = defineTool({
    name: "use_saved_account",
    description:
        "Use one of the saved accounts (by index from list_saved_accounts) after the client confirms it.",
    schema: z.object({
        role: z.enum(["source", "destination"]),
        index: z.number().int().min(0),
    }),
    async execute({role, index}, deps) {
        const quote = deps.getLockedQuote();
        const currency = quote
            ? role === "source"
                ? quote.sendCurrency
                : quote.receiveCurrency
            : null;
        const accounts = (deps.getProfile()?.accounts ?? []).filter(
            (account) => currency === null || account.currency === currency
        );
        const account = accounts[index];
        if (!account) {
            return {
                result: {status: "invalid", problem: "No such saved account."},
            };
        }
        deps.updateDraft(
            role === "source"
                ? {
                      sourceBank: account.bank,
                      sourceAccount: account.accountNumber,
                  }
                : {
                      destinationBank: account.bank,
                      destinationAccount: account.accountNumber,
                  }
        );
        return afterSave(deps);
    },
});

const getOrderStatus = defineTool({
    name: "get_order_status",
    description:
        "Look up the client's order (the active one unless an order_id is given) from the database. The app shows the timeline.",
    schema: z.object({order_id: z.string().max(20).optional()}),
    async execute({order_id}, deps) {
        const order = await deps.fetchOrder(
            order_id ?? deps.getActiveOrderId()
        );
        if (!order) {
            return {
                result: {
                    status: "no_order",
                    note: "The client has no order yet.",
                },
            };
        }
        return {
            result: {
                status: "order_shown",
                order_id: order.orderId,
                order_status: order.status,
                note: "A status timeline is on screen. Summarise the status in one sentence without times.",
            },
            cards: [{kind: "status", orderId: order.orderId}],
            actions: order.status === "pending" ? ["paid", "human"] : ["human"],
        };
    },
});

const getPaymentInstructions = defineTool({
    name: "get_payment_instructions",
    description:
        "Show where to pay for the client's active order. Use it when they ask how or where to transfer.",
    schema: z.object({}),
    async execute(_args, deps) {
        const order = await deps.fetchOrder(deps.getActiveOrderId());
        if (order?.status !== "pending") {
            return {result: {status: "no_pending_order"}};
        }
        return {
            result: {
                status: "payment_shown",
                note: "Payment details are on screen.",
            },
            cards: [{kind: "payment", orderId: order.orderId}],
            actions: ["paid", "human"],
        };
    },
});

export const buildHandoffSummary = async (
    deps: AssistantDeps
): Promise<string> => {
    const draft = deps.getDraft();
    const quote = deps.getLockedQuote();
    const order = await deps.fetchOrder(deps.getActiveOrderId());
    const lines = [
        `Channel: ${deps.channel}. Language: ${deps.language()}.`,
        quote
            ? `Quote: ${quote.sendAmount} ${quote.sendCurrency} -> ${quote.receiveAmount} ${quote.receiveCurrency} at ${quote.rate}.`
            : "No quote yet.",
        `Collected: ${collectedFields(draft).join(", ") || "nothing"}.`,
        order ? `Order ${order.orderId} is ${order.status}.` : "No order yet.",
    ];
    return lines.join(" ");
};

const requestHuman = defineTool({
    name: "request_human",
    description:
        "Hand the client to a person on the team, with the context already gathered. Use when asked, for large or negotiated amounts, or when unsure.",
    schema: z.object({
        reason: z.string().max(200).describe("Why the client needs a person."),
    }),
    async execute({reason}, deps) {
        const summary = `${await buildHandoffSummary(deps)} Reason: ${reason}`;
        const orderId = deps.getActiveOrderId();
        try {
            const queue = await deps.requestHuman(summary, orderId);
            return {
                result: {
                    status: "handed_off",
                    note: "The client is in the queue and the summary was shared. Say so in one sentence without numbers.",
                },
                cards: [{kind: "queue", queue}],
                actions: ["form"],
            };
        } catch (error) {
            return {
                result: {
                    status: "error",
                    code: error instanceof ApiError ? error.code : "unknown",
                },
                actions: ["form"],
            };
        }
    },
});

export const TOOLS = [
    getQuote,
    saveClientData,
    listSavedAccounts,
    useSavedAccount,
    getOrderStatus,
    getPaymentInstructions,
    requestHuman,
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

export const TOOL_DECLARATIONS = TOOLS.map((tool) =>
    toFunctionDeclaration(tool.name, tool.description, tool.schema)
);

export const runTool = async (
    name: string,
    rawArgs: unknown,
    deps: AssistantDeps
): Promise<ToolOutcome> => {
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (!tool) {
        return {result: {status: "error", problem: `Unknown tool ${name}.`}};
    }
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
        return {
            result: {
                status: "invalid",
                problem: parsed.error.issues
                    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                    .join("; "),
            },
        };
    }
    // The registry is heterogeneous; each tool validated its own args above.
    return (
        tool.execute as (
            args: unknown,
            deps: AssistantDeps
        ) => Promise<ToolOutcome>
    )(parsed.data, deps);
};
