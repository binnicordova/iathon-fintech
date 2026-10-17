import type {Currency} from "../shared/models/currency";
import {CURRENCIES} from "../shared/models/currency";
import type {MarketRates, RateSource} from "../shared/models/rates";
import {db} from "./firebase";

const PRIMARY_URL = "https://open.er-api.com/v6/latest/USD";
const BACKUP_URLS = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
];
const FETCH_TIMEOUT_MS = 6000;
/** Past this age a cached rate is too old to quote: better to ask for a person. */
const MAX_STALE_MS = 36 * 3_600_000;
/** A day-to-day move above this is treated as bad data, not a market event. */
const MAX_JUMP = 0.25;

type RawRates = {
    rates: Record<Currency, number>;
    providerUpdatedAt: string | null;
};

const isPositive = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;

const pickRates = (source: Record<string, unknown>, lowercase: boolean) => {
    const rates = {} as Record<Currency, number>;
    for (const currency of CURRENCIES) {
        const value = source[lowercase ? currency.toLowerCase() : currency];
        if (!isPositive(value)) {
            return null;
        }
        rates[currency] = value;
    }
    return rates;
};

/** open.er-api.com: `{result, time_last_update_utc, rates: {BRL, PEN, USD}}`. */
export const parseOpenErApi = (json: unknown): RawRates | null => {
    const body = json as {
        result?: string;
        time_last_update_utc?: string;
        rates?: Record<string, unknown>;
    } | null;
    if (!body || body.result !== "success" || !body.rates) {
        return null;
    }
    const rates = pickRates(body.rates, false);
    if (!rates) {
        return null;
    }
    const updated = body.time_last_update_utc
        ? new Date(body.time_last_update_utc)
        : null;
    return {
        rates,
        providerUpdatedAt:
            updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : null,
    };
};

/** fawazahmed0: `{date: "2026-10-11", usd: {brl, pen, usd}}`. */
export const parseFawazahmed0 = (json: unknown): RawRates | null => {
    const body = json as {date?: string; usd?: Record<string, unknown>} | null;
    if (!body?.usd) {
        return null;
    }
    const lower = {...body.usd, usd: body.usd.usd ?? 1};
    const rates = pickRates(lower, true);
    if (!rates) {
        return null;
    }
    const date = body.date ? new Date(`${body.date}T00:00:00Z`) : null;
    return {
        rates,
        providerUpdatedAt:
            date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    };
};

/** Rejects a refresh that swings far from the last known good rates. */
export const isSaneAgainst = (
    next: Record<Currency, number>,
    previous: Record<Currency, number> | null
): boolean => {
    if (!previous) {
        return true;
    }
    return CURRENCIES.every((currency) => {
        if (currency === "USD") {
            return true;
        }
        const change = Math.abs(next[currency] / previous[currency] - 1);
        return change <= MAX_JUMP;
    });
};

const fetchJson = async (url: string): Promise<unknown> => {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {accept: "application/json"},
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

const fromProviders = async (): Promise<(RawRates & {source: RateSource}) | null> => {
    try {
        const parsed = parseOpenErApi(await fetchJson(PRIMARY_URL));
        if (parsed) {
            return {...parsed, source: "open.er-api.com"};
        }
    } catch {
        // fall through to the backup provider
    }
    for (const url of BACKUP_URLS) {
        try {
            const parsed = parseFawazahmed0(await fetchJson(url));
            if (parsed) {
                return {...parsed, source: "fawazahmed0"};
            }
        } catch {
            // try the next mirror
        }
    }
    return null;
};

export const buildMarketRates = (
    raw: RawRates & {source: RateSource},
    now: Date,
    refreshMinutes: number
): MarketRates => ({
    base: "USD",
    rates: raw.rates,
    source: raw.source,
    fetchedAt: now.toISOString(),
    nextUpdateAt: new Date(now.getTime() + refreshMinutes * 60_000).toISOString(),
    providerUpdatedAt: raw.providerUpdatedAt,
});

export class RatesUnavailableError extends Error {
    constructor() {
        super("rates-unavailable");
        this.name = "RatesUnavailableError";
    }
}

/**
 * Brasper's own rate cache: refresh at most once per interval, so "next update"
 * is last refresh + interval (a daily API cannot give an intraday time).
 * Falls back to the last good rates for up to 36h, then refuses to quote.
 */
export const loadMarketRates = async (
    refreshMinutes: number,
    now: Date = new Date()
): Promise<MarketRates> => {
    const manual = (await db().doc("config/manualRates").get()).data();
    if (manual?.active) {
        if (
            !isPositive(manual.penPerUsd) ||
            !isPositive(manual.brlPerUsd) ||
            !Number.isFinite(Date.parse(manual.validUntil)) ||
            Date.parse(manual.validUntil) <= now.getTime()
        )
            throw new RatesUnavailableError();
        return {
            base: "USD",
            rates: {USD: 1, PEN: manual.penPerUsd, BRL: manual.brlPerUsd},
            source: "manual",
            fetchedAt: manual.updatedAt ?? now.toISOString(),
            nextUpdateAt: manual.validUntil,
            providerUpdatedAt: null,
        };
    }
    const ref = db().doc("config/rates");
    const cached = (await ref.get()).data() as MarketRates | undefined;

    if (cached && now.getTime() < new Date(cached.nextUpdateAt).getTime()) {
        return cached;
    }

    const fresh = await fromProviders();
    if (fresh && isSaneAgainst(fresh.rates, cached?.rates ?? null)) {
        const market = buildMarketRates(fresh, now, refreshMinutes);
        await ref.set(market);
        return market;
    }

    if (cached && now.getTime() - new Date(cached.fetchedAt).getTime() < MAX_STALE_MS) {
        return {...cached, source: "stale-cache"};
    }
    throw new RatesUnavailableError();
};
