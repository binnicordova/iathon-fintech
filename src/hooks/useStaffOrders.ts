import {useAtomValue} from "jotai";
import {useEffect, useState} from "react";
import type {Order, OrderStatus} from "@/models/order";
import {reportError} from "@/services/monitoring";
import {watchAllOrders} from "@/services/orders";
import {sessionAtom} from "@/stores/session";

/** The VIEW's live list, newest first. Only staff roles pass the Firestore rules. */
export const useStaffOrders = (status: OrderStatus | null) => {
    const role = useAtomValue(sessionAtom)?.role ?? null;
    const [state, setState] = useState<{
        orders: Order[];
        loading: boolean;
        failed: boolean;
    }>({
        orders: [],
        loading: true,
        failed: false,
    });

    useEffect(() => {
        if (!role) {
            setState({orders: [], loading: false, failed: false});
            return;
        }
        setState((previous) => ({...previous, loading: true, failed: false}));
        return watchAllOrders(
            (orders) => setState({orders, loading: false, failed: false}),
            (error) => {
                reportError(error, "staffOrders");
                setState({orders: [], loading: false, failed: true});
            },
            status ?? undefined
        );
    }, [role, status]);

    return state;
};
