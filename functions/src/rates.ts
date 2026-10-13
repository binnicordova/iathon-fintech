import {HttpsError, onCall} from "firebase-functions/https";
import {requireAuth} from "./lib/guards";
import {RatesUnavailableError, loadMarketRates} from "./lib/rates";
import {loadMinutesPerQueuedClient, loadPricing} from "./lib/settings";

/**
 * Market reference + Brasper's pricing, so the app can price live as the client
 * types. The server re-prices on `createQuote`; the app's numbers are never
 * trusted.
 */
export const getRates = onCall(async (request) => {
    requireAuth(request);
    const pricing = await loadPricing();
    try {
        const market = await loadMarketRates(pricing.ratesRefreshMinutes);
        return {
            market,
            pricing,
            minutesPerQueuedClient: await loadMinutesPerQueuedClient(),
        };
    } catch (error) {
        if (error instanceof RatesUnavailableError) {
            throw new HttpsError("unavailable", "rates-unavailable");
        }
        throw error;
    }
});
