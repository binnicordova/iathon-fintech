import {atom, type SetStateAction} from "jotai";
import {atomWithStorage, loadable, unwrap} from "jotai/utils";
import {storage} from "@/utils/storage";

/**
 * AsyncStorage is async, so a plain `atomWithStorage` reads as `T | Promise<T>`.
 * This keeps the persistence but reads synchronously: the initial value shows
 * until storage answers, then the saved one replaces it. `ready` flips to true
 * once the saved value has been read, for code that must not act on the
 * initial value (e.g. redirecting because "nothing is saved").
 */
export const persistedAtom = <T>(key: string, initial: T) => {
    const stored = atomWithStorage<T>(key, initial, storage, {getOnInit: true});
    const value = unwrap(stored, (previous) => previous ?? initial);
    const ready = atom((get) => get(loadable(stored)).state !== "loading");

    const state = atom(
        (get) => get(value),
        (get, set, update: SetStateAction<T>) => {
            const next =
                typeof update === "function"
                    ? (update as (previous: T) => T)(get(value))
                    : update;
            set(stored, next);
        }
    );

    return Object.assign(state, {ready});
};
