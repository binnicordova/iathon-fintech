import {Column, Row, Spacer} from "@expo/ui";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useState} from "react";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {Card} from "@/components/molecules/Card/Card";
import {AppHeader} from "@/components/organisms/AppHeader/AppHeader";
import {QuoteCalculator} from "@/components/organisms/QuoteCalculator/QuoteCalculator";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {formatNumber} from "@/domain/money";
import {QuoteError} from "@/domain/pricing";
import {useLanguage, useT} from "@/hooks/useT";
import {type ApiError, toApiError} from "@/services/api";
import {reportError} from "@/services/monitoring";
import {openWhatsApp} from "@/services/whatsapp";
import {liveQuoteAtom, lockQuoteAtom} from "@/stores/quote";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export default function QuoteScreen() {
    const t = useT();
    const language = useLanguage();
    const router = useRouter();
    const {muted} = useTheme();
    const live = useAtomValue(liveQuoteAtom);
    const lockQuote = useSetAtom(lockQuoteAtom);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requiresHuman, setRequiresHuman] = useState(false);

    const messageFor = (failure: ApiError): string => {
        switch (failure.code) {
            case "rates-unavailable":
                return t("quote.unavailable");
            case "network":
                return t("common.offline");
            case "amount-too-small":
                return t("quote.tooSmall", {min: ""}).trim();
            default:
                return t("common.error");
        }
    };

    const onContinue = async () => {
        setBusy(true);
        setError(null);
        setRequiresHuman(false);
        try {
            await lockQuote("form");
            router.push(PATHS.DATA);
        } catch (caught) {
            if (caught instanceof QuoteError) {
                setError(t("common.error"));
            } else {
                const failure = toApiError(caught);
                if (failure.code === "requires-human") {
                    setRequiresHuman(true);
                } else {
                    reportError(caught, "lockQuote");
                    setError(messageFor(failure));
                }
            }
        } finally {
            setBusy(false);
        }
    };

    const talkToPerson = () => {
        if (live.status !== "ready") {
            openWhatsApp(t("whatsapp.person"));
            return;
        }
        const {amounts} = live;
        openWhatsApp(
            `${t("whatsapp.person")}\n${t("quote.whatsappText", {
                amount: formatNumber(amounts.sendAmount, language),
                from: amounts.sendCurrency,
                to: amounts.receiveCurrency,
                rate: String(amounts.rate),
            })}`
        );
    };

    return (
        <Screen header={<AppHeader />}>
            <Column spacing={SPACING[1]}>
                <Text type="title">{t("quote.title")}</Text>
                <Text type="label" color={muted}>
                    {t("quote.subtitle")}
                </Text>
            </Column>

            <QuoteCalculator
                onContinue={onContinue}
                busy={busy}
                error={error}
                requiresHuman={requiresHuman}
                onHuman={talkToPerson}
            />

            <Card spacing={SPACING[2]}>
                <Text type="label" color={muted}>
                    {t("quote.help")}
                </Text>
                <Surface fill>
                    <Row spacing={SPACING[2]} alignment="center">
                        <Chip
                            testID="help-assistant"
                            icon="assistant"
                            label={t("quote.askAssistant")}
                            tone="ai"
                            onPress={() => router.navigate(PATHS.ASSISTANT)}
                        />
                        <Spacer flexible />
                    </Row>
                </Surface>
                <Surface fill>
                    <Row spacing={SPACING[2]} alignment="center">
                        <Chip
                            testID="help-human"
                            icon="person"
                            label={t("quote.askHuman")}
                            tone="success"
                            onPress={talkToPerson}
                        />
                        <Spacer flexible />
                    </Row>
                </Surface>
            </Card>
        </Screen>
    );
}
