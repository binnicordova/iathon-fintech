import {DEFAULT_PRICING} from "../shared/domain/pricing";
import type {Currency} from "../shared/models/currency";
import type {PaymentAccount, Pricing} from "../shared/models/settings";
import {db} from "./firebase";

export const DEFAULT_MINUTES_PER_QUEUED_CLIENT = 2.5;

/**
 * Placeholder destination accounts so the flow can be demonstrated. Real
 * accounts go in `config/payment` ({accounts: {BRL: {...}, PEN: {...}}}).
 */
const DEMO_ACCOUNTS: Record<Currency, PaymentAccount> = {
    BRL: {
        currency: "BRL",
        holder: "BrasPer (DEMO)",
        bank: "Nubank (DEMO)",
        accountNumber: "0000-0000-0000-DEMO",
        pixKey: "demo@brasper.example",
        demo: true,
    },
    PEN: {
        currency: "PEN",
        holder: "BrasPer (DEMO)",
        bank: "BCP (DEMO)",
        accountNumber: "000-0000000-0-00 DEMO",
        demo: true,
    },
    USD: {
        currency: "USD",
        holder: "BrasPer (DEMO)",
        bank: "Interbank (DEMO)",
        accountNumber: "000-0000000000 DEMO",
        demo: true,
    },
};

export const loadPricing = async (): Promise<Pricing> => {
    const snap = await db().doc("config/public").get();
    const override = (snap.data()?.pricing ?? {}) as Partial<Pricing>;
    return {...DEFAULT_PRICING, ...override};
};

export const loadMinutesPerQueuedClient = async (): Promise<number> => {
    const snap = await db().doc("config/public").get();
    const value = snap.data()?.minutesPerQueuedClient;
    return typeof value === "number" && value > 0
        ? value
        : DEFAULT_MINUTES_PER_QUEUED_CLIENT;
};

export const loadPaymentAccount = async (
    currency: Currency
): Promise<PaymentAccount> => {
    const snap = await db().doc("config/payment").get();
    const configured = snap.data()?.accounts?.[currency] as
        | PaymentAccount
        | undefined;
    return configured ?? DEMO_ACCOUNTS[currency];
};
