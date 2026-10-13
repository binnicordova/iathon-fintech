import {atom} from "jotai";
import {api, type RatesPayload} from "@/services/api";
import {reportError} from "@/services/monitoring";

export const ratesAtom = atom<RatesPayload | null>(null);
export const ratesStatusAtom = atom<"idle" | "loading" | "ready" | "error">(
    "idle"
);

export const loadRatesAtom = atom(null, async (get, set) => {
    if (get(ratesStatusAtom) === "loading") {
        return;
    }
    set(ratesStatusAtom, "loading");
    try {
        set(ratesAtom, await api.getRates());
        set(ratesStatusAtom, "ready");
    } catch (error) {
        reportError(error, "rates");
        // Keep showing the last rates we had: the server re-prices anyway.
        set(ratesStatusAtom, "error");
    }
});
