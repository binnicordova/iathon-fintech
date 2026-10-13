import {useEffect, useState} from "react";
import type {QueueInfo} from "@/models/handoff";
import {api, type QueueStatus} from "@/services/api";
import {reportError} from "@/services/monitoring";

const REFRESH_MS = 30_000;

/** Keeps "queue #14, ≈ 35 min" current while the client waits. */
export const useQueuePosition = (initial: QueueInfo | null) => {
    const [queue, setQueue] = useState<QueueStatus | null>(initial);

    useEffect(() => {
        setQueue(initial);
        if (!initial) {
            return;
        }
        let active = true;
        const refresh = () =>
            api
                .getQueueInfo({handoffId: initial.handoffId})
                .then((next) => active && setQueue(next))
                .catch((error) => reportError(error, "queue"));
        const timer = setInterval(refresh, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [initial]);

    return [queue, setQueue] as const;
};
