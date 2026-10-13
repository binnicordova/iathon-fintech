import {STORAGE_KEYS} from "@/constants/storage";
import type {QueueInfo} from "@/models/handoff";
import {persistedAtom} from "@/stores/persisted";

/** The client's place in line, so reopening the app keeps it. */
export const queueAtom = persistedAtom<QueueInfo | null>(
    STORAGE_KEYS.queue,
    null
);
