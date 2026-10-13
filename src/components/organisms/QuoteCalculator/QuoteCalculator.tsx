import {Column, Row, Spacer} from "@expo/ui";
import {useAtom, useAtomValue} from "jotai";
import {Button} from "@/components/atoms/Button/Button";
import {IconButton} from "@/components/atoms/IconButton/IconButton";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {TextField} from "@/components/atoms/TextField/TextField";
import {Card} from "@/components/molecules/Card/Card";
import {Notice} from "@/components/molecules/Notice/Notice";
import {SelectField} from "@/components/molecules/SelectField/SelectField";
import {SummaryRow} from "@/components/molecules/SummaryRow/SummaryRow";
import {formatLimaClock} from "@/domain/hours";
import {formatMoney, formatRate} from "@/domain/money";
import {useLanguage, useT} from "@/hooks/useT";
import {CURRENCIES, type Currency} from "@/models/currency";
import {
    derivedAmountTextAtom,
    liveQuoteAtom,
    quoteDraftAtom,
} from "@/stores/quote";
import {ratesAtom, ratesStatusAtom} from "@/stores/rates";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

const CURRENCY_WIDTH = 112;

const CURRENCY_OPTIONS = CURRENCIES.map((code) => ({label: code, value: code}));

export type QuoteCalculatorProps = {
    onContinue: () => void;
    busy?: boolean;
    error?: string | null;
    /** The server says this amount needs a person. */
    requiresHuman?: boolean;
    onHuman: () => void;
};

/**
 * "Cotiza": the same calculator as the site. The numbers are a live preview from
 * the rates the server sent; the server prices again, and freezes the rate, when
 * the client presses Continuar.
 */
export const QuoteCalculator = ({
    onContinue,
    busy,
    error,
    requiresHuman,
    onHuman,
}: QuoteCalculatorProps) => {
    const t = useT();
    const language = useLanguage();
    const {muted} = useTheme();
    const [draft, setDraft] = useAtom(quoteDraftAtom);
    const live = useAtomValue(liveQuoteAtom);
    const derived = useAtomValue(derivedAmountTextAtom);
    const payload = useAtomValue(ratesAtom);
    const ratesStatus = useAtomValue(ratesStatusAtom);

    const sendValue = draft.editing === "send" ? draft.sendText : derived;
    const receiveValue =
        draft.editing === "receive" ? draft.receiveText : derived;

    const setCurrency = (side: "send" | "receive", next: Currency) => {
        setDraft((prev) => {
            const other =
                side === "send" ? prev.receiveCurrency : prev.sendCurrency;
            // Picking the other side's currency swaps them instead of failing.
            const otherNext =
                next === other
                    ? side === "send"
                        ? prev.sendCurrency
                        : prev.receiveCurrency
                    : other;
            return side === "send"
                ? {...prev, sendCurrency: next, receiveCurrency: otherNext}
                : {...prev, receiveCurrency: next, sendCurrency: otherNext};
        });
    };

    const swap = () =>
        setDraft((prev) => ({
            ...prev,
            sendCurrency: prev.receiveCurrency,
            receiveCurrency: prev.sendCurrency,
        }));

    const amounts = live.status === "ready" ? live.amounts : null;
    const noRates = !payload && ratesStatus !== "loading";
    const canContinue =
        live.status === "ready" && !live.amounts.requiresHuman && !busy;
    const largeAmount =
        requiresHuman ||
        (live.status === "ready" && live.amounts.requiresHuman);

    return (
        <Column spacing={SPACING[4]}>
            <Card spacing={SPACING[3]}>
                <Text type="label" color={muted}>
                    {t("quote.send")}
                </Text>
                <Row alignment="center" spacing={SPACING[2]}>
                    <Surface grow>
                        <TextField
                            large
                            testID="send-amount"
                            keyboardType="decimal-pad"
                            value={sendValue}
                            placeholder="0"
                            onChangeText={(text) =>
                                setDraft((prev) => ({
                                    ...prev,
                                    editing: "send",
                                    sendText: text,
                                }))
                            }
                        />
                    </Surface>
                    <SelectField
                        width={CURRENCY_WIDTH}
                        testID="send-currency"
                        value={draft.sendCurrency}
                        options={CURRENCY_OPTIONS}
                        onChange={(code) => setCurrency("send", code)}
                    />
                </Row>

                <Row alignment="center">
                    <Spacer flexible />
                    <IconButton
                        name="swap"
                        testID="swap-currencies"
                        onPress={swap}
                    />
                    <Spacer flexible />
                </Row>

                <Text type="label" color={muted}>
                    {t("quote.receive")}
                </Text>
                <Row alignment="center" spacing={SPACING[2]}>
                    <Surface grow>
                        <TextField
                            large
                            testID="receive-amount"
                            keyboardType="decimal-pad"
                            value={receiveValue}
                            placeholder="—"
                            onChangeText={(text) =>
                                setDraft((prev) => ({
                                    ...prev,
                                    editing: "receive",
                                    receiveText: text,
                                }))
                            }
                        />
                    </Surface>
                    <SelectField
                        width={CURRENCY_WIDTH}
                        testID="receive-currency"
                        value={draft.receiveCurrency}
                        options={CURRENCY_OPTIONS}
                        onChange={(code) => setCurrency("receive", code)}
                    />
                </Row>
            </Card>

            <Card spacing={SPACING[2]}>
                <SummaryRow
                    label={t("quote.commission")}
                    value={
                        amounts
                            ? formatMoney(
                                  amounts.commission,
                                  amounts.sendCurrency,
                                  language
                              )
                            : "—"
                    }
                    testID="quote-commission"
                />
                <SummaryRow
                    label={t("quote.tax")}
                    value={
                        amounts
                            ? formatMoney(
                                  amounts.tax,
                                  amounts.sendCurrency,
                                  language
                              )
                            : "—"
                    }
                />
                <SummaryRow
                    emphasis
                    label={t("quote.total")}
                    value={
                        amounts
                            ? formatMoney(
                                  amounts.total,
                                  amounts.sendCurrency,
                                  language
                              )
                            : "—"
                    }
                    testID="quote-total"
                />
                <SummaryRow
                    label={t("quote.rate")}
                    value={
                        amounts
                            ? t("quote.rateLine", {
                                  from: amounts.sendCurrency,
                                  to: amounts.receiveCurrency,
                                  rate: formatRate(amounts.rate, language),
                              })
                            : "—"
                    }
                    testID="quote-rate"
                />
                {payload && (
                    <Text type="caption" color={muted}>
                        {t("quote.nextUpdate", {
                            time: formatLimaClock(
                                new Date(payload.market.nextUpdateAt)
                            ),
                        })}
                    </Text>
                )}
            </Card>

            {noRates && <Notice tone="error">{t("quote.unavailable")}</Notice>}
            {payload?.market.source === "stale-cache" && (
                <Notice tone="warning">{t("quote.stale")}</Notice>
            )}
            {live.status === "too-small" && (
                <Notice tone="warning">
                    {t("quote.tooSmall", {
                        min: formatMoney(
                            live.minimum,
                            draft.sendCurrency,
                            language
                        ),
                    })}
                </Notice>
            )}
            {largeAmount && (
                <Notice tone="info" icon="person">
                    {t("quote.large")}
                </Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}

            {largeAmount ? (
                <Button
                    testID="quote-human"
                    title={t("quote.askHuman")}
                    onPress={onHuman}
                />
            ) : (
                <Button
                    testID="quote-continue"
                    title={t("quote.continue")}
                    disabled={!canContinue}
                    onPress={onContinue}
                />
            )}
        </Column>
    );
};
