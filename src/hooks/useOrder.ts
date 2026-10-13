import {useAtomValue} from "jotai";
import {useEffect, useState} from "react";
import type {Order} from "@/models/order";
import {reportError} from "@/services/monitoring";
import {watchMyOrders, watchOrder} from "@/services/orders";
import {sessionAtom} from "@/stores/session";

type Loadable<T> = {data: T; loading: boolean};

/** Live order: the form's timeline and the assistant read the same document. */
export const useOrder = (orderId: string | null): Loadable<Order | null> => {
    const [state, setState] = useState<Loadable<Order | null>>({
        data: null,
        loading: true,
    });
    const uid = useAtomValue(sessionAtom)?.uid;

    useEffect(() => {
        if (!orderId || !uid) {
            setState({data: null, loading: Boolean(orderId)});
            return;
        }
        setState((prev) => ({...prev, loading: true}));
        return watchOrder(
            orderId,
            (data) => setState({data, loading: false}),
            (error) => {
                reportError(error, "watchOrder");
                setState({data: null, loading: false});
            }
        );
    }, [orderId, uid]);

    return state;
};

export const useMyOrders = (): Loadable<Order[]> => {
    const [state, setState] = useState<Loadable<Order[]>>({
        data: [],
        loading: true,
    });
    const uid = useAtomValue(sessionAtom)?.uid;

    useEffect(() => {
        if (!uid) {
            return;
        }
        return watchMyOrders(
            uid,
            (data) => setState({data, loading: false}),
            (error) => {
                reportError(error, "watchMyOrders");
                setState({data: [], loading: false});
            }
        );
    }, [uid]);

    return state;
};
