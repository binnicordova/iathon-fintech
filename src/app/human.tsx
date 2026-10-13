import {useRouter} from "expo-router";
import {useAtom, useAtomValue} from "jotai";
import {useEffect, useRef, useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Text} from "@/components/atoms/Text/Text";
import {AppBar} from "@/components/molecules/AppBar/AppBar";
import {Notice} from "@/components/molecules/Notice/Notice";
import {QueueCard} from "@/components/organisms/QueueCard/QueueCard";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {useLanguage, useT} from "@/hooks/useT";
import {track} from "@/services/analytics";
import {api, toApiError} from "@/services/api";
import {reportError} from "@/services/monitoring";
import {queueAtom} from "@/stores/handoff";
import {activeOrderIdAtom} from "@/stores/order";
import {lockedQuoteAtom} from "@/stores/quote";
import {sessionAtom} from "@/stores/session";
import {useTheme} from "@/theme/useTheme";

/**
 * The current human flow, kept: large or negotiated amounts queue for a seller.
 * The difference is that the client can leave the line for the assistant or the
 * form at any time, and the seller starts with the context already attached.
 */
export default function HumanScreen() {
    const t = useT();
    const language = useLanguage();
    const router = useRouter();
    const {muted} = useTheme();
    const uid = useAtomValue(sessionAtom)?.uid ?? null;
    const orderId = useAtomValue(activeOrderIdAtom);
    const quote = useAtomValue(lockedQuoteAtom);
    const [queue, setQueue] = useAtom(queueAtom);
    const queueReady = useAtomValue(queueAtom.ready);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const checked = useRef(false);

    // A saved place may have been closed or served meanwhile: ask the server once.
    useEffect(() => {
        if (!queueReady || !queue || checked.current) {
            return;
        }
        checked.current = true;
        api.getQueueInfo({handoffId: queue.handoffId})
            .then((status) => {
                if (status.status !== "waiting") {
                    setQueue(null);
                }
            })
            .catch(() => setQueue(null));
    }, [queueReady, queue, setQueue]);

    const join = async () => {
        setBusy(true);
        setError(null);
        try {
            const summary = quote
                ? `Quote: ${quote.sendAmount} ${quote.sendCurrency} -> ${quote.receiveCurrency}, locked rate ${quote.rate}.`
                : "The client asked for a person from the quote screen.";
            const info = await api.requestHuman({
                orderId,
                summary,
                language,
                channel: "human",
            });
            track(uid, "human_requested", "human");
            setQueue(info);
        } catch (caught) {
            reportError(caught, "requestHuman");
            setError(
                toApiError(caught).code === "network"
                    ? t("common.offline")
                    : t("common.error")
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen header={<AppBar title={t("human.title")} />}>
            <Text type="label" color={muted}>
                {t("human.intro")}
            </Text>
            {queue ? (
                <QueueCard
                    queue={queue}
                    onLeft={() => setQueue(null)}
                    onUseAssistantInstead={() =>
                        router.navigate(PATHS.ASSISTANT)
                    }
                />
            ) : (
                <Button
                    testID="human-join"
                    title={busy ? t("human.joining") : t("human.join")}
                    disabled={busy}
                    onPress={join}
                />
            )}
            {error && <Notice tone="error">{error}</Notice>}
        </Screen>
    );
}
