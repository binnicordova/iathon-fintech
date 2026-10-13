import {Row, Spacer} from "@expo/ui";
import {useAtomValue} from "jotai";
import {Icon} from "@/components/atoms/Icon/Icon";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {formatMoney} from "@/domain/money";
import {useLanguage, useT} from "@/hooks/useT";
import {clientDraftAtom} from "@/stores/order";
import {lockedQuoteAtom} from "@/stores/quote";
import {RADIUS} from "@/theme/border";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";
import {validateClientDraft} from "@/utils/clientDraft";

const TOTAL_FIELDS = 8;

/**
 * "Tu operación": the live summary on top of the chat. It reads the same
 * stores as the form, so what the assistant collects is visible as it happens.
 */
export const ChatSummary = () => {
    const t = useT();
    const language = useLanguage();
    const {surface, line, muted, success, ai} = useTheme();
    const quote = useAtomValue(lockedQuoteAtom);
    const draft = useAtomValue(clientDraftAtom);

    const missing = Object.keys(validateClientDraft(draft)).length;
    const done = TOTAL_FIELDS - missing;
    if (!quote) {
        return null;
    }

    return (
        <Surface
            fill
            direction="row"
            alignment="center"
            spacing={SPACING[2]}
            padding={SPACING[3]}
            radius={RADIUS[5] * 2}
            backgroundColor={surface}
            borderColor={line}
            borderWidth={1}
            testID="chat-summary"
        >
            <Icon name="assistant" size={ICON_SIZE.medium} color={ai} />
            <Text type="label" color={muted}>
                {t("assistant.summary")}
            </Text>
            <Spacer flexible />
            {quote && (
                <Text type="label" testID="chat-summary-amounts">
                    {`${formatMoney(quote.sendAmount, quote.sendCurrency, language)} → ${formatMoney(quote.receiveAmount, quote.receiveCurrency, language)}`}
                </Text>
            )}
            <Row alignment="center" spacing={SPACING[1]}>
                <Icon
                    name={missing === 0 ? "success" : "pending"}
                    size={ICON_SIZE.small}
                    color={missing === 0 ? success : muted}
                />
                <Text
                    type="caption"
                    color={muted}
                >{`${done}/${TOTAL_FIELDS}`}</Text>
            </Row>
        </Surface>
    );
};
