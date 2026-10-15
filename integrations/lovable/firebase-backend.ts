/** Copy with its types into the Lovable app. Does not import Expo or replace Supabase. */
import type {FirebaseApp} from "firebase/app";
import {getAuth, signInWithCustomToken, signOut} from "firebase/auth";
import {getFunctions, httpsCallable} from "firebase/functions";
import {getStorage, ref, uploadBytes} from "firebase/storage";
import type {Order} from "../../src/models/order";
import type {
    OperationAction,
    OperationAudit,
    WorkflowStatus,
} from "../../src/models/web-operation";

export type WebOrderInput = {
    quoteId: string;
    language: "es" | "pt" | "en";
    clientName: string;
    docType: "DNI" | "CE" | "RUC" | "CPF";
    docNumber: string;
    email: string;
    sourceBank: string;
    sourceAccount: string;
    destinationBank: string;
    destinationAccount: string;
    fundsSource:
        | "savings"
        | "salary"
        | "business"
        | "asset_sale"
        | "donation"
        | "other";
    fundsReason: string;
    recipientName: string;
    recipientDocument: string;
    recipientDocumentType: "DNI" | "CE" | "RUC" | "CPF";
    billingPreference: "boleta" | "factura" | "br_receipt";
    billingEmail: string;
    billingName?: string;
    billingDocument?: string;
    saveAccounts?: boolean;
    customerPhone?: string;
};
export function firebaseBackend(app: FirebaseApp) {
    const auth = getAuth(app);
    const functions = getFunctions(app, "southamerica-east1");
    const storage = getStorage(app);
    const call = async <T>(name: string, data: unknown): Promise<T> =>
        (await httpsCallable<unknown, T>(functions, name)(data)).data;
    return {
        /** Keep this URL in public config; token is the current Supabase user JWT, never service_role. */
        async connectSupabase(exchangeUrl: string, accessToken: string) {
            const url = new URL(exchangeUrl);
            if (url.protocol !== "https:")
                throw new Error("HTTPS identity bridge required");
            const r = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${accessToken}`},
                cache: "no-store",
            });
            if (!r.ok) throw new Error("Firebase identity exchange failed");
            const {customToken, uid} = await r.json();
            if (typeof customToken !== "string" || typeof uid !== "string")
                throw new Error("Invalid identity exchange");
            if (auth.currentUser?.uid !== uid) await signOut(auth);
            await signInWithCustomToken(auth, customToken);
            return uid as string;
        },
        /** Call on Supabase logout/account change too. Never retain another user's Firebase session. */
        disconnect: () => signOut(auth),
        quote: (data: {
            sendCurrency: "PEN" | "BRL";
            receiveCurrency: "PEN" | "BRL";
            sendAmount: number;
            channel?: "form" | "whatsapp";
        }) =>
            call<import("../../src/models/quote").Quote>(
                "createWebQuote",
                data
            ),
        create: (data: WebOrderInput) => call<Order>("createWebOrder", data),
        submitProof: (data: {
            orderId: string;
            operationNo: string;
            proofPath: string;
        }) => call("submitProof", data),
        list: (
            data: {
                status?: WorkflowStatus;
                currency?: "PEN" | "BRL";
                cursor?: string;
                limit?: number;
                search?: {
                    field: "docNumber" | "email" | "customerPhone";
                    value: string;
                };
                fromDate?: string;
                toDate?: string;
            } = {}
        ) =>
            call<{operations: Order[]; nextCursor: string | null}>(
                "listOperations",
                data
            ),
        detail: (orderId: string) =>
            call<{operation: Order; events: OperationAudit[]}>("getOperation", {
                orderId,
            }),
        summary: () =>
            call<{
                total: number;
                counts: Record<WorkflowStatus, number>;
                legacyWithoutWorkflow: number;
            }>("getOperationsSummary", {}),
        review: (data: {
            orderId: string;
            action: OperationAction;
            expectedRevision: number;
            requestId: string;
            note?: string;
            confirmation?: string;
            payoutPath?: string;
            payoutReference?: string;
        }) => call("reviewOperation", data),
        proof: (orderId: string, kind: "deposit" | "payout") =>
            call<{url: string; expiresIn: number}>("getOperationProof", {
                orderId,
                kind,
            }),
        savedRecipients: () => call("listSavedRecipients", {}),
        saveRecipient: (data: {
            label: string;
            name: string;
            document: string;
            bank: string;
            account: string;
            currency: "PEN" | "BRL";
        }) => call("saveRecipient", data),
        deleteRecipient: (id: string) => call("deleteRecipient", {id}),
        async upload(
            orderId: string,
            file: Blob,
            kind: "deposit" | "payout",
            uploadId: string
        ) {
            if (!auth.currentUser) throw new Error("Sign in first");
            if (
                !/^BR-\d{4,}$/.test(orderId) ||
                !/^[a-zA-Z0-9-]{16,80}$/.test(uploadId)
            )
                throw new Error("Invalid upload reference");
            if (
                !file.size ||
                file.size > 8 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "application/pdf"].includes(
                    file.type
                )
            )
                throw new Error("Unsupported proof");
            const ext =
                file.type === "application/pdf"
                    ? "pdf"
                    : file.type === "image/png"
                      ? "png"
                      : "jpg";
            const path =
                kind === "deposit"
                    ? `proofs/${auth.currentUser.uid}/${orderId}/${uploadId}.${ext}`
                    : `payouts/${orderId}/${uploadId}.${ext}`;
            await uploadBytes(ref(storage, path), file, {
                contentType: file.type,
            });
            return path;
        },
    };
}
