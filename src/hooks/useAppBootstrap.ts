import {useAtomValue, useSetAtom} from "jotai";
import {useEffect} from "react";
import {AppState} from "react-native";
import {reportError, setMonitoringUser} from "@/services/monitoring";
import {watchSession} from "@/services/session";
import {loadProfileAtom} from "@/stores/order";
import {loadRatesAtom, ratesAtom} from "@/stores/rates";
import {sessionAtom, sessionErrorAtom} from "@/stores/session";

/**
 * Starts the silent sign-in and keeps the rates fresh: on launch, when the app
 * returns to the foreground, and when Brasper's own "next update" time passes.
 */
export const useAppBootstrap = () => {
    const session = useAtomValue(sessionAtom);
    const setSession = useSetAtom(sessionAtom);
    const setSessionError = useSetAtom(sessionErrorAtom);
    const loadRates = useSetAtom(loadRatesAtom);
    const loadProfile = useSetAtom(loadProfileAtom);
    const rates = useAtomValue(ratesAtom);

    useEffect(
        () =>
            watchSession(
                (next) => {
                    setSession(next);
                    setSessionError(null);
                    setMonitoringUser(next?.uid ?? null);
                },
                (error) => {
                    reportError(error, "session");
                    setSessionError(error);
                }
            ),
        [setSession, setSessionError]
    );

    const uid = session?.uid;
    useEffect(() => {
        if (!uid) {
            return;
        }
        void loadRates();
        loadProfile().catch((error) => reportError(error, "profile"));
    }, [uid, loadRates, loadProfile]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active" && uid) {
                void loadRates();
            }
        });
        return () => subscription.remove();
    }, [uid, loadRates]);

    const nextUpdateAt = rates?.market.nextUpdateAt;
    useEffect(() => {
        if (!nextUpdateAt || !uid) {
            return;
        }
        const wait = Math.max(
            30_000,
            new Date(nextUpdateAt).getTime() - Date.now()
        );
        const timer = setTimeout(
            () => void loadRates(),
            Math.min(wait, 2 ** 31 - 1)
        );
        return () => clearTimeout(timer);
    }, [nextUpdateAt, uid, loadRates]);
};
