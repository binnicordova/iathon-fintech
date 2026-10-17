import {getAuth} from "firebase-admin/auth";
import {defineString} from "firebase-functions/params";
import {onRequest} from "firebase-functions/https";
const supabaseUrl = defineString("BRASPER_SUPABASE_URL", {
    default: "https://lfjnywpvunfrvkgcfobl.supabase.co",
});
const publicKey = defineString("BRASPER_SUPABASE_PUBLISHABLE_KEY", {default: ""});
const origins = [
    "https://brasper.jordybryan.com",
    "https://brasper-connect-flow.lovable.app",
];
export async function verifiedSupabaseIdentity(token: string, base: string, key: string) {
    const url = new URL(base);
    if (
        url.protocol !== "https:" ||
        url.pathname !== "/" ||
        !url.hostname.endsWith(".supabase.co")
    )
        throw new Error("invalid-auth-issuer");
    if (!key || token.length > 8192 || token.split(".").length !== 3)
        throw new Error("invalid-session");
    const r = await fetch(new URL("/auth/v1/user", url), {
        headers: {Authorization: `Bearer ${token}`, apikey: key},
        signal: AbortSignal.timeout(8000),
        redirect: "error",
    });
    if (!r.ok) throw new Error("invalid-session");
    const user = (await r.json()) as {id?: string; is_anonymous?: boolean};
    if (!user.id || !/^[a-f0-9-]{36}$/i.test(user.id)) throw new Error("invalid-session");
    return {uid: `supabase:${user.id}`, anonymous: user.is_anonymous === true};
}
/** Exchange only. No service-role key or client-assigned role. */
export const exchangeSupabaseSession = onRequest(
    {cors: origins, maxInstances: 5},
    async (req, res) => {
        res.set("Cache-Control", "no-store");
        if (req.method !== "POST") {
            res.status(405).json({error: "method-not-allowed"});
            return;
        }
        if (req.headers.origin && !origins.includes(req.headers.origin)) {
            res.status(403).json({error: "origin-not-allowed"});
            return;
        }
        if (!publicKey.value()) {
            res.status(503).json({error: "identity-bridge-not-configured"});
            return;
        }
        const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? "")?.[1];
        if (!token) {
            res.status(401).json({error: "invalid-session"});
            return;
        }
        try {
            const user = await verifiedSupabaseIdentity(
                token,
                supabaseUrl.value(),
                publicKey.value()
            );
            const customToken = await getAuth().createCustomToken(user.uid, {
                identityProvider: "supabase",
                sourceAnonymous: user.anonymous,
            });
            res.json({customToken, uid: user.uid});
        } catch {
            res.status(401).json({error: "invalid-session"});
        }
    }
);
