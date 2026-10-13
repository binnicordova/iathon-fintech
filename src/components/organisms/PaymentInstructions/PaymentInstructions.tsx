import {Column} from "@expo/ui";
import {Text} from "@/components/atoms/Text/Text";
import {Card} from "@/components/molecules/Card/Card";
import {CopyRow} from "@/components/molecules/CopyRow/CopyRow";
import {Notice} from "@/components/molecules/Notice/Notice";
import {formatLimaClock} from "@/domain/hours";
import {formatMoney} from "@/domain/money";
import {useLanguage, useT} from "@/hooks/useT";
import type {Order} from "@/models/order";
import {SPACING} from "@/theme/spacing";
import {describeVerificationSlot} from "@/utils/verification";

export type PaymentInstructionsProps = {
    order: Order;
    now?: Date;
};

/**
 * "Transfiere a BrasPer": where to pay, with copy buttons and the reminder to
 * use the account of the right currency. Every value comes from the order, never
 * from the assistant's wording.
 */
export const PaymentInstructions = ({
    order,
    now = new Date(),
}: PaymentInstructionsProps) => {
    const t = useT();
    const language = useLanguage();
    const account = order.paymentAccount;
    const lockExpired =
        now.getTime() > new Date(order.rateLockedUntil).getTime();
    const afterHours = describeVerificationSlot(now, t);

    return (
        <Column spacing={SPACING[4]}>
            {account.demo && (
                <Notice tone="warning" testID="demo-account-notice">
                    {t("pay.demo")}
                </Notice>
            )}

            <Card spacing={SPACING[4]}>
                <CopyRow
                    label={t("pay.holder")}
                    value={account.holder}
                    copyable={false}
                />
                <CopyRow
                    emphasis
                    testID="pay-amount"
                    label={t("pay.amount")}
                    value={formatMoney(
                        order.total,
                        order.sendCurrency,
                        language
                    )}
                    copyValue={order.total.toFixed(2)}
                />
                <CopyRow
                    label={t("pay.bank")}
                    value={account.bank}
                    copyable={false}
                />
                <CopyRow
                    testID="pay-account"
                    label={t("pay.account")}
                    value={account.accountNumber}
                />
                {account.pixKey && (
                    <CopyRow
                        testID="pay-pix"
                        label={t("pay.pix")}
                        value={account.pixKey}
                    />
                )}
            </Card>

            <Text type="label">
                {t("pay.currencyHint", {currency: order.sendCurrency})}
            </Text>

            {lockExpired ? (
                <Notice tone="warning" icon="clock">
                    {t("pay.lockExpired")}
                </Notice>
            ) : (
                <Notice tone="info" icon="clock" testID="rate-lock">
                    {t("pay.lockedUntil", {
                        time: formatLimaClock(new Date(order.rateLockedUntil)),
                    })}
                </Notice>
            )}
            <Notice tone={afterHours ? "warning" : "success"} icon="clock">
                {afterHours
                    ? t("pay.afterHours", {when: afterHours})
                    : t("pay.inHours")}
            </Notice>
        </Column>
    );
};
