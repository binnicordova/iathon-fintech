import {useRouter} from "expo-router";
import {useAtom, useAtomValue, useSetAtom} from "jotai";
import {useEffect, useRef, useState} from "react";
import {Button} from "@/components/atoms/Button/Button";
import {Card} from "@/components/molecules/Card/Card";
import {Notice} from "@/components/molecules/Notice/Notice";
import {StepHeader} from "@/components/molecules/StepHeader/StepHeader";
import {SummaryRow} from "@/components/molecules/SummaryRow/SummaryRow";
import {ClientDataForm} from "@/components/organisms/ClientDataForm/ClientDataForm";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {formatLimaClock} from "@/domain/hours";
import {formatMoney, formatRate} from "@/domain/money";
import {useLanguage, useT} from "@/hooks/useT";
import {type ApiError, toApiError} from "@/services/api";
import {reportError} from "@/services/monitoring";
import {
    clientDraftAtom,
    createOrderAtom,
    DraftIncompleteError,
} from "@/stores/order";
import {lockedQuoteAtom} from "@/stores/quote";
import {SPACING} from "@/theme/spacing";
import {type DraftErrors, validateClientDraft} from "@/utils/clientDraft";

export default function DataScreen() {
    const t = useT();
    const language = useLanguage();
    const router = useRouter();
    const storedQuote = useAtomValue(lockedQuoteAtom);
    const quoteReady = useAtomValue(lockedQuoteAtom.ready);
    const quote =
        storedQuote && new Date(storedQuote.expiresAt).getTime() > Date.now()
            ? storedQuote
            : null;
    const [draft, setDraft] = useAtom(clientDraftAtom);
    const createOrder = useSetAtom(createOrderAtom);
    const [errors, setErrors] = useState<DraftErrors>({});
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    // Creating the order clears the quote; that must not look like "no quote".
    const submitted = useRef(false);

    // Nothing was quoted (a refresh, a deep link): start from the calculator.
    useEffect(() => {
        if (quoteReady && !quote && !submitted.current) {
            router.replace(PATHS.QUOTE);
        }
    }, [quoteReady, quote, router]);

    // Brazilian clients usually bring a CPF, Peruvians a DNI.
    // biome-ignore lint/correctness/useExhaustiveDependencies: pick the document type once per quote
    useEffect(() => {
        if (quote && !draft.docNumber) {
            const docType = quote.sendCurrency === "BRL" ? "CPF" : "DNI";
            if (draft.docType !== docType) {
                setDraft((prev) => ({...prev, docType}));
            }
        }
    }, [quote?.id]);

    if (!quote) {
        return null;
    }

    const messageFor = (error: ApiError): string => {
        if (error.code === "quote-expired") {
            return t("quote.expired");
        }
        if (error.code === "network") {
            return t("common.offline");
        }
        return t("common.error");
    };

    const onContinue = async () => {
        const found = validateClientDraft(draft);
        setErrors(found);
        setFailure(null);
        if (Object.keys(found).length > 0) {
            return;
        }
        setBusy(true);
        submitted.current = true;
        try {
            const order = await createOrder();
            router.replace(PATHS.pay(order.orderId));
        } catch (caught) {
            submitted.current = false;
            if (caught instanceof DraftIncompleteError) {
                setErrors(validateClientDraft(draft));
            } else {
                reportError(caught, "createOrder");
                setFailure(messageFor(toApiError(caught)));
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen
            header={<StepHeader title={t("data.title")} step={1} />}
            footer={
                <Button
                    testID="data-continue"
                    title={busy ? t("data.creating") : t("data.continue")}
                    disabled={busy}
                    onPress={onContinue}
                />
            }
        >
            <Card spacing={SPACING[2]}>
                <SummaryRow
                    label={t("quote.send")}
                    value={formatMoney(
                        quote.sendAmount,
                        quote.sendCurrency,
                        language
                    )}
                />
                <SummaryRow
                    label={t("quote.receive")}
                    value={formatMoney(
                        quote.receiveAmount,
                        quote.receiveCurrency,
                        language
                    )}
                />
                <SummaryRow
                    label={t("quote.rate")}
                    value={t("quote.rateLine", {
                        from: quote.sendCurrency,
                        to: quote.receiveCurrency,
                        rate: formatRate(quote.rate, language),
                    })}
                />
                <SummaryRow
                    label={t("quote.total")}
                    emphasis
                    value={formatMoney(
                        quote.total,
                        quote.sendCurrency,
                        language
                    )}
                />
            </Card>
            <Notice tone="info" icon="clock">
                {t("pay.lockedUntil", {
                    time: formatLimaClock(new Date(quote.expiresAt)),
                })}
            </Notice>

            <ClientDataForm
                sendCurrency={quote.sendCurrency}
                receiveCurrency={quote.receiveCurrency}
                errors={errors}
            />
            {failure && <Notice tone="error">{failure}</Notice>}
        </Screen>
    );
}
