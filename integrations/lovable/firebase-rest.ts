/** Fetch-only adapter for existing Supabase Edge Functions / WhatsApp Flow.
 * Keep signature checking, encrypted session storage and media validation in the
 * existing handler. This adapter never approves a bank deposit or a payout.
 */
export type FirebaseBridgeConfig = {
    projectId: string;
    apiKey: string; // Firebase web key: not an Admin credential.
    storageBucket: string;
    exchangeUrl: string;
};
export async function firebaseForSupabaseSession(
    config: FirebaseBridgeConfig,
    supabaseUserJWT: string
) {
    if (!/^[a-z][a-z0-9-]{3,62}$/.test(config.projectId))
        throw new Error("Invalid Firebase project");
    const exchange = new URL(config.exchangeUrl);
    if (exchange.protocol !== "https:")
        throw new Error("HTTPS bridge required");
    const response = await fetch(exchange, {
        method: "POST",
        headers: {Authorization: `Bearer ${supabaseUserJWT}`},
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Identity bridge rejected session");
    const {customToken, uid} = await response.json();
    const signed = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(config.apiKey)}`,
        {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({token: customToken, returnSecureToken: true}),
            signal: AbortSignal.timeout(10000),
        }
    );
    if (!signed.ok) throw new Error("Firebase sign-in failed");
    const session = await signed.json();
    if (!session.idToken || session.localId !== uid)
        throw new Error("Firebase identity mismatch");
    const base = `https://southamerica-east1-${config.projectId}.cloudfunctions.net/`;
    async function call<T>(name: string, data: unknown): Promise<T> {
        if (!/^[a-zA-Z]+$/.test(name)) throw new Error("Invalid function name");
        const r = await fetch(base + name, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${session.idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({data}),
            signal: AbortSignal.timeout(25000),
        });
        const body = await r.json();
        if (!r.ok || body.error)
            throw new Error(
                `Firebase operation rejected: ${body.error?.status ?? r.status}`
            );
        return body.result as T;
    }
    return {
        uid: uid as string,
        quote: (data: unknown) => call("createWebQuote", data),
        create: (data: unknown) => call("createWebOrder", data),
        submitProof: (data: {
            orderId: string;
            operationNo: string;
            proofPath: string;
        }) => call("submitProof", data),
        async uploadDeposit(
            orderId: string,
            bytes: Uint8Array,
            mime: string,
            uploadId: string
        ) {
            if (
                !/^BR-\d{4,}$/.test(orderId) ||
                !/^[a-zA-Z0-9-]{16,80}$/.test(uploadId)
            )
                throw new Error("Invalid upload reference");
            if (
                !bytes.length ||
                bytes.length > 8 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "application/pdf"].includes(mime)
            )
                throw new Error("Invalid proof");
            const ext =
                mime === "application/pdf"
                    ? "pdf"
                    : mime === "image/png"
                      ? "png"
                      : "jpg";
            const path = `proofs/${uid}/${orderId}/${uploadId}.${ext}`;
            const url = new URL(
                `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(config.storageBucket)}/o`
            );
            url.searchParams.set("name", path);
            url.searchParams.set("uploadType", "media");
            const r = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Firebase ${session.idToken}`,
                    "Content-Type": mime,
                },
                body: bytes as BodyInit,
                signal: AbortSignal.timeout(25000),
            });
            if (!r.ok) throw new Error("Private proof upload failed");
            return path;
        },
    };
}
