import {addDoc, collection} from "firebase/firestore";
import {Platform} from "react-native";
import type {Channel} from "@/models/currency";
import {db} from "@/services/firebase/app";
import {Sentry} from "@/services/monitoring";

export type FunnelStep =
    | "quote_viewed"
    | "quote_continue"
    | "data_completed"
    | "pay_viewed"
    | "paid_tapped"
    | "proof_submitted"
    | "status_viewed"
    | "assistant_opened"
    | "human_requested"
    | "receipt_downloaded";

/**
 * The plan asks to count sessions and completion per step from day one: one
 * tiny event per step in Firestore, plus a Sentry breadcrumb so a crash report
 * shows where the client was.
 */
export const track = (
    uid: string | null,
    name: FunnelStep,
    channel: Channel = "form",
    props: Record<string, string | number | boolean> = {}
): void => {
    Sentry.addBreadcrumb({category: "funnel", message: name, data: props});
    if (!uid) {
        return;
    }
    addDoc(collection(db, "events"), {
        uid,
        name,
        channel,
        platform: Platform.OS,
        at: new Date().toISOString(),
        props,
    }).catch(() => {
        // Analytics must never get in the way of the client.
    });
};
