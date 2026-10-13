import {Checkbox, RNHostView, Row, Spacer} from "@expo/ui";
import {Image} from "expo-image";
import {useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Pill} from "@/components/atoms/Pill/Pill";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {TextField} from "@/components/atoms/TextField/TextField";
import {Card} from "@/components/molecules/Card/Card";
import {useStatusTone} from "@/components/molecules/OrderListItem/OrderListItem";
import {formatLimaDateTime} from "@/domain/hours";
import {formatMoney} from "@/domain/money";
import {maskAccount} from "@/domain/validators";
import {useLanguage, useT} from "@/hooks/useT";
import type {Order} from "@/models/order";
import type {StaffRole} from "@/models/staff";
import {reportError} from "@/services/monitoring";
import {proofDownloadUrl} from "@/services/orders";
import {RADIUS} from "@/theme/border";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type TeamOrderCardProps = {
    order: Order;
    role: StaffRole;
    selected: boolean;
    busy: boolean;
    onToggle: (orderId: string) => void;
    onReview: (
        orderId: string,
        decision: "approve" | "reject",
        reason?: string
    ) => void;
    onReceipt: (orderId: string) => void;
};

const PROOF_HEIGHT = 260;

/** One row of the VIEW: the data to check, the proof photo and the actions. */
export const TeamOrderCard = ({
    order,
    role,
    selected,
    busy,
    onToggle,
    onReview,
    onReceipt,
}: TeamOrderCardProps) => {
    const t = useT();
    const language = useLanguage();
    const {muted, line, lightness} = useTheme();
    const tone = useStatusTone()(order.status);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [proofOpen, setProofOpen] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState("");

    const canValidate =
        (role === "validator" || role === "admin") &&
        order.status === "validating";
    const canSelect =
        (role === "operator" || role === "admin") &&
        order.status === "approved";

    const toggleProof = async () => {
        if (proofOpen) {
            setProofOpen(false);
            return;
        }
        setProofOpen(true);
        if (!proofUrl && order.paymentProofPath) {
            try {
                setProofUrl(await proofDownloadUrl(order.paymentProofPath));
            } catch (error) {
                reportError(error, "proofUrl");
            }
        }
    };

    return (
        <Card spacing={SPACING[2]} testID={`team-order-${order.orderId}`}>
            <Row
                alignment="center"
                spacing={SPACING[2]}
                style={{width: "100%"}}
            >
                {canSelect && (
                    <Checkbox
                        value={selected}
                        onValueChange={() => onToggle(order.orderId)}
                        testID={`select-${order.orderId}`}
                    />
                )}
                <Text type="subtitle">{order.orderId}</Text>
                <Spacer flexible />
                <Pill
                    label={t(`orderStatus.${order.status}`)}
                    tone={tone.fg}
                    backgroundColor={tone.bg}
                />
            </Row>

            <Text type="default">{order.clientName}</Text>
            <Text type="caption" color={muted}>
                {`${order.docType} ${order.docNumber} · ${order.email}`}
            </Text>
            <Text type="default" testID={`pair-${order.orderId}`}>
                {`${formatMoney(order.sendAmount, order.sendCurrency, language)} → ${formatMoney(order.receiveAmount, order.receiveCurrency, language)}`}
            </Text>
            <Text type="caption" color={muted}>
                {`${t(`funds.${order.fundsSource}`)} · ${order.sourceBank} ${maskAccount(order.sourceAccount)} → ${order.destinationBank} ${maskAccount(order.destinationAccount)}`}
            </Text>
            <Text type="caption" color={muted}>
                {`${t("team.col.opNo")}: ${order.operationNo ?? "—"} · ${formatLimaDateTime(new Date(order.createdAt))}`}
            </Text>
            {order.validatedBy && (
                <Text type="caption" color={muted}>
                    {t("team.validatedBy", {who: order.validatedBy})}
                </Text>
            )}
            {order.rejectionReason && (
                <Text type="caption" color={muted}>
                    {order.rejectionReason}
                </Text>
            )}
            {order.invoiceStatus && (
                <Text type="caption" color={muted}>
                    {`${t("team.col.invoice")}: ${order.invoiceStatus}`}
                </Text>
            )}

            <Row spacing={SPACING[2]} alignment="center">
                {order.paymentProofPath ? (
                    <Chip
                        testID={`proof-${order.orderId}`}
                        icon="eye"
                        tone="accent"
                        label={t("team.viewProof")}
                        onPress={toggleProof}
                    />
                ) : (
                    <Text type="caption" color={muted}>
                        {t("team.noProof")}
                    </Text>
                )}
                {order.invoiceStatus === "accepted" && (
                    <Chip
                        testID={`receipt-${order.orderId}`}
                        icon="download"
                        tone="neutral"
                        label={t("status.receipt")}
                        onPress={() => onReceipt(order.orderId)}
                    />
                )}
            </Row>

            {proofOpen && proofUrl && (
                <Surface
                    fill
                    radius={RADIUS[5] * 1.5}
                    backgroundColor={lightness}
                    borderColor={line}
                    borderWidth={1}
                >
                    <RNHostView matchContents={false}>
                        <Image
                            testID={`proof-image-${order.orderId}`}
                            source={{uri: proofUrl}}
                            contentFit="contain"
                            style={{width: "100%", height: PROOF_HEIGHT}}
                        />
                    </RNHostView>
                </Surface>
            )}

            {canValidate && !rejecting && (
                <Row spacing={SPACING[2]} alignment="center">
                    <Chip
                        testID={`approve-${order.orderId}`}
                        icon="success"
                        tone="success"
                        selected
                        disabled={busy}
                        label={t("team.approve")}
                        onPress={() => onReview(order.orderId, "approve")}
                    />
                    <Chip
                        testID={`reject-${order.orderId}`}
                        icon="failure"
                        tone="warning"
                        disabled={busy}
                        label={t("team.reject")}
                        onPress={() => setRejecting(true)}
                    />
                </Row>
            )}
            {canValidate && rejecting && (
                <Surface fill spacing={SPACING[2]}>
                    <TextField
                        testID={`reason-${order.orderId}`}
                        value={reason}
                        placeholder={t("team.rejectReason")}
                        onChangeText={setReason}
                    />
                    <Row spacing={SPACING[2]} alignment="center">
                        <Button
                            testID={`confirm-reject-${order.orderId}`}
                            title={t("team.reject")}
                            disabled={busy || reason.trim().length < 3}
                            onPress={() => {
                                onReview(
                                    order.orderId,
                                    "reject",
                                    reason.trim()
                                );
                                setRejecting(false);
                            }}
                        />
                    </Row>
                </Surface>
            )}
        </Card>
    );
};
