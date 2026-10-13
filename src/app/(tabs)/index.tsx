import {Column, Row} from "@expo/ui";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useState} from "react";
import {Linking} from "react-native";
import {Chip} from "@/components/atoms/Chip/Chip";
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
import {liveQuoteAtom, lockQuoteAtom} from "@/stores/quote";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

const WHATSAPP_NUMBER = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER ?? "";

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

    const openWhatsApp = () => {
        if (live.status !== "ready") {
            return;
        }
        const {amounts} = live;
        const text = t("quote.whatsappText", {
            amount: formatNumber(amounts.sendAmount, language),
            from: amounts.sendCurrency,
            to: amounts.receiveCurrency,
            rate: String(amounts.rate),
        });
        Linking.openURL(
            `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
        ).catch((failure) => reportError(failure, "whatsapp"));
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
                onHuman={() => router.push(PATHS.HUMAN)}
            />

            <Card spacing={SPACING[2]}>
                <Text type="label" color={muted}>
                    {t("quote.help")}
                </Text>
                <Row spacing={SPACING[2]} alignment="center">
                    <Chip
                        testID="help-whatsapp"
                        icon="send"
                        label={t("quote.whatsapp")}
                        tone="success"
                        onPress={openWhatsApp}
                        disabled={live.status !== "ready"}
                    />
                </Row>
                <Row spacing={SPACING[2]} alignment="center">
                    <Chip
                        testID="help-assistant"
                        icon="assistant"
                        label={t("quote.askAssistant")}
                        tone="ai"
                        onPress={() => router.navigate(PATHS.ASSISTANT)}
                    />
                    <Chip
                        testID="help-human"
                        icon="person"
                        label={t("quote.askHuman")}
                        tone="neutral"
                        onPress={() => router.push(PATHS.HUMAN)}
                    />
                </Row>
            </Card>
        </Screen>
    );
}
