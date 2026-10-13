import {atom} from "jotai";
import type {Session} from "@/services/session";

export const sessionAtom = atom<Session | null>(null);
export const sessionErrorAtom = atom<unknown>(null);
