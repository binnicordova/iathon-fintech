import {
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import {getDownloadURL, ref, uploadBytes} from "firebase/storage";
import type {Order} from "@/models/order";
import {db, storage} from "@/services/firebase/app";

type Unsubscribe = () => void;
type ErrorHandler = (error: unknown) => void;

export const watchOrder = (
    orderId: string,
    onOrder: (order: Order | null) => void,
    onError: ErrorHandler
): Unsubscribe =>
    onSnapshot(
        doc(db, "orders", orderId),
        (snap) => onOrder(snap.exists() ? (snap.data() as Order) : null),
        onError
    );

export const watchMyOrders = (
    uid: string,
    onOrders: (orders: Order[]) => void,
    onError: ErrorHandler
): Unsubscribe =>
    onSnapshot(
        query(
            collection(db, "orders"),
            where("uid", "==", uid),
            orderBy("createdAt", "desc"),
            limit(50)
        ),
        (snap) => onOrders(snap.docs.map((d) => d.data() as Order)),
        onError
    );

const extensionFor = (contentType: string): string => {
    if (contentType === "application/pdf") return "pdf";
    if (contentType === "image/png") return "png";
    return "jpg";
};

/** Uploads the proof straight to private Storage; the order stores only the path. */
export const uploadProof = async (
    uid: string,
    orderId: string,
    localUri: string,
    contentType: string
): Promise<string> => {
    const path = `proofs/${uid}/${orderId}/proof-${Date.now()}.${extensionFor(contentType)}`;
    const blob = await (await fetch(localUri)).blob();
    await uploadBytes(ref(storage, path), blob, {contentType});
    return path;
};

export const proofDownloadUrl = (path: string): Promise<string> =>
    getDownloadURL(ref(storage, path));
