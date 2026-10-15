import {onCall} from "firebase-functions/https";
import {z} from "zod";
import {db} from "./lib/firebase";
import {parse, requireStaff} from "./lib/guards";
import {loadPricing} from "./lib/settings";
const Payment = z
    .object({
        currency: z.enum(["PEN", "BRL"]),
        holder: z.string().trim().min(2).max(160),
        bank: z.string().trim().min(2).max(80),
        accountNumber: z.string().trim().min(5).max(80),
        pixKey: z.string().trim().max(160).optional(),
        demo: z.boolean().default(true),
    })
    .strict();
const Pricing = z
    .object({
        spreadBps: z.number().int().min(0).max(5000),
        commissionBps: z.number().int().min(0).max(10000),
        taxBps: z.number().int().min(0).max(10000),
        quoteTtlMinutes: z.number().int().min(1).max(60),
        rateLockMinutes: z.number().int().min(1).max(60),
        ratesRefreshMinutes: z.number().int().min(1).max(1440),
        largeAmountUsd: z.number().positive().max(10000000),
        minSendUsd: z.number().positive().max(1000000),
    })
    .strict()
    .refine((v) => v.minSendUsd <= v.largeAmountUsd);
export const getOperationsConfig = onCall(async (request) => {
    await requireStaff(request, ["validator", "operator", "billing"]);
    const [payment, manual] = await Promise.all([
        db().doc("config/payment").get(),
        db().doc("config/manualRates").get(),
    ]);
    return {
        pricing: await loadPricing(),
        payment: payment.data()?.accounts ?? {},
        manualRates: manual.data() ?? null,
    };
});
export const updateOperationsConfig = onCall(async (request) => {
    const actor = await requireStaff(request, []); // admin only
    const input = parse(
        z
            .object({
                pricing: Pricing.optional(),
                accounts: z.array(Payment).max(2).optional(),
                manualRates: z
                    .object({
                        active: z.boolean(),
                        penPerUsd: z.number().positive().max(1000),
                        brlPerUsd: z.number().positive().max(1000),
                        validUntil: z.string().datetime(),
                    })
                    .strict()
                    .optional(),
            })
            .strict(),
        request.data
    );
    if (
        input.accounts &&
        new Set(input.accounts.map((a) => a.currency)).size !== input.accounts.length
    )
        throw new Error("duplicate-currency");
    const now = new Date().toISOString(),
        batch = db().batch();
    if (input.pricing)
        batch.set(db().doc("config/public"), {pricing: input.pricing}, {merge: true});
    if (input.accounts)
        batch.set(
            db().doc("config/payment"),
            {accounts: Object.fromEntries(input.accounts.map((a) => [a.currency, a]))},
            {merge: true}
        );
    if (input.manualRates)
        batch.set(db().doc("config/manualRates"), {...input.manualRates, updatedAt: now});
    batch.set(db().collection("configurationEvents").doc(), {
        actor: actor.uid,
        at: now,
        changed: Object.keys(input),
    });
    await batch.commit();
    return {ok: true};
});
