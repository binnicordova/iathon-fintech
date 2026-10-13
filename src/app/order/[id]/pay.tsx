import {Column} from "@expo/ui";
import {useLocalSearchParams, useRouter} from "expo-router";
import {useSetAtom} from "jotai";
import {useEffect, useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Text} from "@/components/atoms/Text/Text";
import {Notice} from "@/components/molecules/Notice/Notice";
import {StepHeader} from "@/components/molecules/StepHeader/StepHeader";
import {PaymentInstructions} from "@/components/organisms/PaymentInstructions/PaymentInstructions";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {useOrder} from "@/hooks/useOrder";
import {useT} from "@/hooks/useT";
import {api, toApiError} from "@/services/api";
import {reportError} from "@/services/monitoring";
import {activeOrderIdAtom} from "@/stores/order";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export default function PayScreen() {
    const t = useT();
    const router = useRouter();
    const {muted} = useTheme();
    const {id} = useLocalSearchParams<{id: string}>();
    const {data: order, loading} = useOrder(id ?? null);
    const setActive = useSetAtom(activeOrderIdAtom);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Once proof is in (or the order ended) the payment step is behind us.
    useEffect(() => {
        if (order && order.status !== "pending") {
            router.replace(PATHS.status(order.orderId));
        }
    }, [order, router]);

    if (loading || !order) {
        return (
            <Screen header={<StepHeader title={t("pay.title")} step={2} />}>
                <Text type="label" color={muted}>
                    {loading ? t("common.loading") : t("status.notFound")}
                </Text>
            </Screen>
        );
    }

    const cancel = async () => {
        setBusy(true);
        try {
            await api.cancelOrder({orderId: order.orderId});
            setActive(null);
            router.replace(PATHS.QUOTE);
        } catch (caught) {
            reportError(caught, "cancelOrder");
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
        <Screen
            header={<StepHeader title={t("pay.title")} step={2} />}
            footer={
                <Column spacing={SPACING[2]}>
                    <Button
                        testID="pay-done"
                        title={t("pay.done")}
                        disabled={busy}
                        onPress={() => router.push(PATHS.proof(order.orderId))}
                    />
                    <Button
                        testID="pay-cancel"
                        variant="text"
                        title={t("pay.cancel")}
                        disabled={busy}
                        onPress={cancel}
                    />
                </Column>
            }
        >
            <Text type="label" color={muted}>
                {order.orderId}
            </Text>
            <PaymentInstructions order={order} />
            {error && <Notice tone="error">{error}</Notice>}
            <Chip
                testID="pay-ask-assistant"
                icon="assistant"
                tone="ai"
                label={t("pay.askAssistant")}
                onPress={() => router.navigate(PATHS.ASSISTANT)}
            />
        </Screen>
    );
}
