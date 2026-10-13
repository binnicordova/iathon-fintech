import {HttpsError, onCall} from "firebase-functions/https";
import {z} from "zod";
import {LANGUAGES} from "./shared/models/currency";
import type {Handoff, QueueInfo} from "./shared/models/handoff";
import type {Order} from "./shared/models/order";
import {db} from "./lib/firebase";
import {nowIso, parse, requireAuth} from "./lib/guards";
import {loadMinutesPerQueuedClient} from "./lib/settings";

const queueFor = async (handoff: Handoff): Promise<QueueInfo> => {
    const ahead = await db()
        .collection("handoffs")
        .where("status", "==", "waiting")
        .where("createdAt", "<", handoff.createdAt)
        .count()
        .get();
    const position = ahead.data().count + 1;
    const perClient = await loadMinutesPerQueuedClient();
    return {
        handoffId: handoff.id,
        position,
        estimatedWaitMinutes: Math.max(1, Math.round(position * perClient)),
    };
};

const RequestHumanInput = z.object({
    orderId: z.string().trim().max(32).nullable().default(null),
    summary: z.string().trim().min(1).max(1500),
    language: z.enum(LANGUAGES).default("es"),
    channel: z.enum(["form", "assistant", "whatsapp", "human"]).default("assistant"),
});

/**
 * "Hablar con una persona": queues the client for a seller with the context
 * the assistant already gathered, so nothing has to be retyped.
 */
export const requestHuman = onCall(async (request) => {
    const uid = requireAuth(request);
    const input = parse(RequestHumanInput, request.data);

    if (input.orderId) {
        const order = (await db().doc(`orders/${input.orderId}`).get()).data() as
            | Order
            | undefined;
        if (!order || order.uid !== uid) {
            throw new HttpsError("not-found", "order-not-found");
        }
    }

    // One live ticket per client: asking twice keeps the original place.
    const existing = await db()
        .collection("handoffs")
        .where("uid", "==", uid)
        .where("status", "==", "waiting")
        .limit(1)
        .get();
    if (!existing.empty) {
        return queueFor(existing.docs[0].data() as Handoff);
    }

    const ref = db().collection("handoffs").doc();
    const handoff: Handoff = {
        id: ref.id,
        uid,
        orderId: input.orderId,
        status: "waiting",
        channel: input.channel,
        language: input.language,
        summary: input.summary,
        createdAt: nowIso(),
        assignedTo: null,
    };
    await ref.set(handoff);
    return queueFor(handoff);
});

export const getQueueInfo = onCall(async (request) => {
    const uid = requireAuth(request);
    const {handoffId} = parse(
        z.object({handoffId: z.string().trim().min(1).max(64)}),
        request.data
    );
    const handoff = (await db().doc(`handoffs/${handoffId}`).get()).data() as
        | Handoff
        | undefined;
    if (!handoff || handoff.uid !== uid) {
        throw new HttpsError("not-found", "handoff-not-found");
    }
    if (handoff.status !== "waiting") {
        return {handoffId, position: 0, estimatedWaitMinutes: 0, status: handoff.status};
    }
    return {...(await queueFor(handoff)), status: handoff.status};
});

export const leaveQueue = onCall(async (request) => {
    const uid = requireAuth(request);
    const {handoffId} = parse(
        z.object({handoffId: z.string().trim().min(1).max(64)}),
        request.data
    );
    const ref = db().doc(`handoffs/${handoffId}`);
    const handoff = (await ref.get()).data() as Handoff | undefined;
    if (!handoff || handoff.uid !== uid) {
        throw new HttpsError("not-found", "handoff-not-found");
    }
    await ref.update({status: "closed"});
    return {ok: true};
});
