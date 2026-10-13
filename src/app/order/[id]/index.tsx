import {useLocalSearchParams, useRouter} from "expo-router";
import {Button} from "@/components/atoms/Button/Button";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Text} from "@/components/atoms/Text/Text";
import {AppBar} from "@/components/molecules/AppBar/AppBar";
import {Card} from "@/components/molecules/Card/Card";
import {Notice} from "@/components/molecules/Notice/Notice";
import {StatusTimeline} from "@/components/molecules/StatusTimeline/StatusTimeline";
import {SummaryRow} from "@/components/molecules/SummaryRow/SummaryRow";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {formatMoney, formatRate} from "@/domain/money";
import {maskAccount} from "@/domain/validators";
import {useOrder} from "@/hooks/useOrder";
import {useLanguage, useT} from "@/hooks/useT";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export default function StatusScreen() {
    const t = useT();
    const language = useLanguage();
    const router = useRouter();
    const {muted} = useTheme();
    const {id} = useLocalSearchParams<{id: string}>();
    const {data: order, loading} = useOrder(id ?? null);

    if (!order) {
        return (
            <Screen header={<AppBar title={id} />}>
                <Text type="label" color={muted}>
                    {loading ? t("common.loading") : t("status.notFound")}
                </Text>
            </Screen>
        );
    }

    return (
        <Screen
            header={<AppBar title={t("status.title", {id: order.orderId})} />}
        >
            <Card spacing={SPACING[2]}>
                <SummaryRow
                    label={t("status.sent")}
                    value={formatMoney(
                        order.sendAmount,
                        order.sendCurrency,
                        language
                    )}
                    testID="status-sent"
                />
                <SummaryRow
                    label={t("status.receives")}
                    value={formatMoney(
                        order.receiveAmount,
                        order.receiveCurrency,
                        language
                    )}
                    testID="status-receives"
                />
                <SummaryRow
                    label={t("status.rate")}
                    value={t("quote.rateLine", {
                        from: order.sendCurrency,
                        to: order.receiveCurrency,
                        rate: formatRate(order.rate, language),
                    })}
                />
                <SummaryRow
                    label={t("status.destination")}
                    value={`${order.destinationBank} ${maskAccount(order.destinationAccount)}`}
                />
            </Card>

            {order.status === "rejected" && (
                <Notice tone="error" testID="status-rejected">
                    {order.rejectionReason
                        ? `${t("status.rejected")} ${t("status.rejectedReason", {reason: order.rejectionReason})}`
                        : t("status.rejected")}
                </Notice>
            )}
            {order.status === "cancelled" && (
                <Notice tone="error">{t("status.cancelled")}</Notice>
            )}
            {order.status === "pending" && (
                <Notice tone="warning" icon="clock">
                    {t("status.stepNote.pending")}
                </Notice>
            )}

            <Card>
                <StatusTimeline order={order} />
            </Card>

            {order.status === "pending" && (
                <Button
                    testID="status-finish-payment"
                    title={t("status.finishPayment")}
                    onPress={() => router.push(PATHS.pay(order.orderId))}
                />
            )}

            <Chip
                testID="status-ask-assistant"
                icon="assistant"
                tone="ai"
                label={t("status.askAssistant")}
                onPress={() => router.navigate(PATHS.ASSISTANT)}
            />
        </Screen>
    );
}
