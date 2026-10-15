import {Row, Spacer, Button as UIButton} from "@expo/ui";
import {Pill} from "@/components/atoms/Pill/Pill";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {formatLimaDateTime} from "@/domain/hours";
import {formatMoney} from "@/domain/money";
import {useLanguage, useT} from "@/hooks/useT";
import type {Order, OrderStatus} from "@/models/order";
import {RADIUS} from "@/theme/border";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type OrderListItemProps = {
    order: Order;
    onPress: () => void;
};

export const useStatusTone = () => {
    const colors = useTheme();
    return (status: OrderStatus): {fg: string; bg: string} => {
        switch (status) {
            case "approved":
            case "exported":
                return {fg: colors.success, bg: colors.successSurface};
            case "rejected":
            case "cancelled":
                return {fg: colors.error, bg: colors.errorSurface};
            case "validating":
                return {fg: colors.warning, bg: colors.warningSurface};
            default:
                return {fg: colors.accent, bg: colors.lightness};
        }
    };
};

export const OrderListItem = ({order, onPress}: OrderListItemProps) => {
    const t = useT();
    const language = useLanguage();
    const {surface, line, muted} = useTheme();
    const tone = useStatusTone()(order.status);

    return (
        <UIButton
            testID={`order-${order.orderId}`}
            variant="text"
            onPress={onPress}
        >
            <Surface
                fill
                spacing={SPACING[2]}
                padding={SPACING[4]}
                radius={RADIUS[5] * 2}
                backgroundColor={surface}
                borderColor={line}
                borderWidth={1}
                interactive
            >
                <Row alignment="center" {...fullWidth()}>
                    <Text type="subtitle">{order.orderId}</Text>
                    <Spacer flexible />
                    <Pill
                        label={t(`orderStatus.${order.status}`)}
                        tone={tone.fg}
                        backgroundColor={tone.bg}
                    />
                </Row>
                <Text type="default">
                    {`${formatMoney(order.sendAmount, order.sendCurrency, language)} → ${formatMoney(order.receiveAmount, order.receiveCurrency, language)}`}
                </Text>
                <Text type="caption" color={muted}>
                    {formatLimaDateTime(new Date(order.createdAt))}
                </Text>
            </Surface>
        </UIButton>
    );
};
