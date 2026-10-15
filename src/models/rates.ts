import type {Currency} from "./currency";

export type RateSource =
    | "open.er-api.com"
    | "fawazahmed0"
    | "stale-cache"
    | "manual";

/**
 * Market reference rates, expressed as units of each currency per 1 USD.
 * The Brasper rate (what the client pays) is derived from this in
 * `domain/pricing`; it is never taken from the API directly.
 */
export type MarketRates = {
    base: "USD";
    rates: Record<Currency, number>;
    source: RateSource;
    /** Last refresh by Brasper's own server (ISO, UTC). */
    fetchedAt: string;
    /** `fetchedAt` + refresh interval: the "may update at 17:18" message. */
    nextUpdateAt: string;
    /** The provider's own timestamp, when it gives one. */
    providerUpdatedAt: string | null;
};
