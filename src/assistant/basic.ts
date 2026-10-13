import type {AssistantDeps} from "@/assistant/deps";
import {runTool} from "@/assistant/tools";
import type {ChatCard, QuickActionId} from "@/assistant/types";
import {parseAmount} from "@/domain/money";
import {type TranslationKey, translate} from "@/i18n";
import type {Currency} from "@/models/currency";
import type {FundsSource} from "@/models/order";
import {type DraftField, nextMissingField} from "@/utils/clientDraft";

export type QuoteIntent = {
    amount: number;
    sendCurrency: Currency;
    receiveCurrency: Currency;
};

const CURRENCY_WORDS: Array<[Currency, RegExp]> = [
    ["BRL", /\b(brl|reais|real|reales|r\$)/gi],
    ["PEN", /\b(pen|soles?|nuevos soles)\b|\bs\//gi],
    ["USD", /\b(usd|d[oó]lares?|dollars?|us\$)/gi],
];

const COUNTRY_TARGET: Array<[RegExp, Currency]> = [
    [/\bper[uú]\b/i, "PEN"],
    [/\bbras(il)?\b|\bbrazil\b/i, "BRL"],
];

/**
 * A rough reading of "500 reales a Perú", for when the language model is out of
 * reach. Not a replacement for the assistant: it only needs to start a quote.
 */
export const parseQuoteIntent = (text: string): QuoteIntent | null => {
    const number = /\d[\d.,]*/.exec(text);
    const amount = number ? parseAmount(number[0]) : null;
    if (amount === null || amount <= 0) {
        return null;
    }

    const found: Array<{currency: Currency; at: number}> = [];
    for (const [currency, pattern] of CURRENCY_WORDS) {
        for (const match of text.matchAll(pattern)) {
            found.push({currency, at: match.index ?? 0});
        }
    }
    found.sort((a, b) => a.at - b.at);
    const order = found
        .map((entry) => entry.currency)
        .filter((currency, index, all) => all.indexOf(currency) === index);
    if (order.length === 0) {
        return null;
    }

    const sendCurrency = order[0];
    let receiveCurrency: Currency | undefined = order[1];
    if (!receiveCurrency) {
        receiveCurrency = COUNTRY_TARGET.find(
            ([pattern, currency]) =>
                pattern.test(text) && currency !== sendCurrency
        )?.[1];
    }
    receiveCurrency ??= sendCurrency === "PEN" ? "BRL" : "PEN";
    return {amount, sendCurrency, receiveCurrency};
};

const FUNDS_WORDS: Array<[RegExp, FundsSource]> = [
    [/ahorro|poupan|saving/i, "savings"],
    [/sueldo|salario|salary|sal[aá]rio|wage/i, "salary"],
    [/negocio|neg[oó]cio|business|empresa/i, "business"],
    [/venta|venda|sale|vend/i, "asset_sale"],
    [/donaci|doa[cç]|donation/i, "donation"],
    [/otro|outro|other/i, "other"],
];

export const parseFundsSource = (text: string): FundsSource | null =>
    FUNDS_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;

export type BasicReply = {
    text: string;
    cards: ChatCard[];
    actions: QuickActionId[];
};

const askKey = (field: DraftField): TranslationKey =>
    `assistant.ask.${field}` as TranslationKey;

/** The next question, in the client's language: one at a time, as in the plan. */
export const askNext = (deps: AssistantDeps): BasicReply => {
    const language = deps.language();
    const next = nextMissingField(deps.getDraft());
    const quote = deps.getLockedQuote();
    if (next === null && quote) {
        return {
            text: translate(language, "assistant.reviewReady"),
            cards: [{kind: "review", quote}],
            actions: ["review", "form", "human"],
        };
    }
    return {
        text: next
            ? translate(language, askKey(next))
            : translate(language, "assistant.greeting"),
        cards: [],
        actions: ["human"],
    };
};

/**
 * "Basic mode": a scripted conversation over the same tools, used when the
 * model is unreachable, so a client can still finish a transfer by chat.
 */
export const basicTurn = async (
    text: string,
    deps: AssistantDeps
): Promise<BasicReply> => {
    const language = deps.language();
    const quote = deps.getLockedQuote();

    // A new amount with a currency always means "quote this", even mid-way.
    const intent = parseQuoteIntent(text);
    if (intent) {
        const outcome = await runTool(
            "get_quote",
            {
                amount: intent.amount,
                send_currency: intent.sendCurrency,
                receive_currency: intent.receiveCurrency,
                amount_kind: "send",
            },
            deps
        );
        if (outcome.result.status === "requires_human") {
            return {
                text: translate(language, "quote.large"),
                cards: [],
                actions: outcome.actions ?? ["human"],
            };
        }
        if (outcome.cards?.length) {
            return {
                text: "",
                cards: outcome.cards,
                actions: outcome.actions ?? [],
            };
        }
        return {
            text: translate(language, "assistant.cannotQuote"),
            cards: [],
            actions: outcome.actions ?? ["human", "form"],
        };
    }

    if (!quote) {
        return {
            text: translate(language, "assistant.greeting"),
            cards: [],
            actions: ["human", "form"],
        };
    }

    const next = nextMissingField(deps.getDraft());
    if (next === null) {
        return askNext(deps);
    }

    const value = next === "fundsSource" ? parseFundsSource(text) : text.trim();
    const outcome = value
        ? await runTool("save_client_data", {field: next, value}, deps)
        : {result: {status: "invalid"}, cards: undefined, actions: undefined};

    if (outcome.result.status === "invalid") {
        return {
            text: `${translate(language, "assistant.invalid")} ${translate(language, askKey(next))}`,
            cards: [],
            actions: ["human"],
        };
    }
    if (outcome.cards?.length) {
        return {
            text: translate(language, "assistant.reviewReady"),
            cards: outcome.cards,
            actions: outcome.actions ?? [],
        };
    }
    return askNext(deps);
};
