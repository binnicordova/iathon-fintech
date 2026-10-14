import {Column} from "@expo/ui";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useState} from "react";
import type {ChatCard} from "@/assistant/types";
import {Button} from "@/components/atoms/Button/Button";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Text} from "@/components/atoms/Text/Text";
import {Card} from "@/components/molecules/Card/Card";
import {Notice} from "@/components/molecules/Notice/Notice";
import {StatusTimeline} from "@/components/molecules/StatusTimeline/StatusTimeline";
import {SummaryRow} from "@/components/molecules/SummaryRow/SummaryRow";
import {PaymentInstructions} from "@/components/organisms/PaymentInstructions/PaymentInstructions";
import {ProofForm} from "@/components/organisms/ProofForm/ProofForm";
import {PATHS} from "@/constants/routes";
import {formatLimaClock} from "@/domain/hours";
import {formatMoney, formatRate} from "@/domain/money";
import {maskAccount} from "@/domain/validators";
import {useOrder} from "@/hooks/useOrder";
import {useProofUpload} from "@/hooks/useProofUpload";
import {useLanguage, useT} from "@/hooks/useT";
import {proofSubmittedAtom} from "@/stores/chat";
import {clientDraftAtom} from "@/stores/order";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type ChatCardsProps = {
    cards: ChatCard[];
};

const cardKey = (card: ChatCard): string => {
    switch (card.kind) {
        case "quote":
        case "review":
            return `${card.kind}-${card.quote.id}`;
        default:
            return `${card.kind}-${card.orderId}`;
    }
};

/** Every figure here comes from the server's quote or order, never from model text. */
export const ChatCards = ({cards}: ChatCardsProps) => (
    <Column spacing={SPACING[2]} style={{width: "100%"}}>
        {cards.map((card) => (
            <CardView key={cardKey(card)} card={card} />
        ))}
    </Column>
);

const CardView = ({card}: {card: ChatCard}) => {
    switch (card.kind) {
        case "quote":
            return <QuoteCard quote={card.quote} />;
        case "review":
            return <ReviewCard quote={card.quote} />;
        case "payment":
            return <PaymentCard orderId={card.orderId} />;
        case "proof":
            return <ProofCard orderId={card.orderId} />;
        case "status":
            return <StatusCard orderId={card.orderId} />;
    }
};

const QuoteCard = ({
    quote,
}: {
    quote: Extract<ChatCard, {kind: "quote"}>["quote"];
}) => {
    const t = useT();
    const language = useLanguage();
    const {muted} = useTheme();

    return (
        <Card spacing={SPACING[2]} testID="card-quote">
            <SummaryRow
                label={t("quote.send")}
                value={formatMoney(
                    quote.sendAmount,
                    quote.sendCurrency,
                    language
                )}
            />
            <SummaryRow
                label={t("quote.commission")}
                value={formatMoney(
                    quote.commission + quote.tax,
                    quote.sendCurrency,
                    language
                )}
            />
            <SummaryRow
                label={t("quote.receive")}
                emphasis
                value={formatMoney(
                    quote.receiveAmount,
                    quote.receiveCurrency,
                    language
                )}
                testID="card-quote-receive"
            />
            <SummaryRow
                label={t("quote.rate")}
                value={t("quote.rateLine", {
                    from: quote.sendCurrency,
                    to: quote.receiveCurrency,
                    rate: formatRate(quote.rate, language),
                })}
            />
            <Text type="caption" color={muted}>
                {t("pay.lockedUntil", {
                    time: formatLimaClock(new Date(quote.expiresAt)),
                })}
            </Text>
        </Card>
    );
};

const ReviewCard = ({
    quote,
}: {
    quote: Extract<ChatCard, {kind: "review"}>["quote"];
}) => {
    const t = useT();
    const language = useLanguage();
    const draft = useAtomValue(clientDraftAtom);
    const router = useRouter();

    return (
        <Card spacing={SPACING[2]} testID="card-review">
            <Text type="subtitle">{t("assistant.reviewTitle")}</Text>
            <SummaryRow label={t("data.name")} value={draft.clientName} />
            <SummaryRow label={draft.docType} value={draft.docNumber} />
            <SummaryRow
                label={t("data.fundsSource")}
                value={
                    draft.fundsSource ? t(`funds.${draft.fundsSource}`) : "—"
                }
            />
            <SummaryRow
                label={t("data.sourceBank")}
                value={`${draft.sourceBank} ${maskAccount(draft.sourceAccount)}`}
            />
            <SummaryRow
                label={t("data.destBank")}
                value={`${draft.destinationBank} ${maskAccount(draft.destinationAccount)}`}
            />
            <SummaryRow
                label={t("quote.total")}
                emphasis
                value={formatMoney(quote.total, quote.sendCurrency, language)}
            />
            <Chip
                testID="review-edit"
                icon="orders"
                tone="neutral"
                label={t("assistant.chip.form")}
                onPress={() => router.push(PATHS.DATA)}
            />
        </Card>
    );
};

const PaymentCard = ({orderId}: {orderId: string}) => {
    const {data: order} = useOrder(orderId);
    return order ? <PaymentInstructions order={order} /> : null;
};

const StatusCard = ({orderId}: {orderId: string}) => {
    const t = useT();
    const router = useRouter();
    const {data: order} = useOrder(orderId);

    if (!order) {
        return null;
    }
    return (
        <Card spacing={SPACING[3]} testID="card-status">
            <Text type="subtitle">
                {t("status.title", {id: order.orderId})}
            </Text>
            <StatusTimeline order={order} />
            <Chip
                testID="status-open"
                icon="forward"
                tone="accent"
                label={t("tab.orders")}
                onPress={() => router.push(PATHS.status(order.orderId))}
            />
        </Card>
    );
};

/** The proof step inside the chat: same form and same upload as the proof screen. */
const ProofCard = ({orderId}: {orderId: string}) => {
    const t = useT();
    const {data: order} = useOrder(orderId);
    const proofSubmitted = useSetAtom(proofSubmittedAtom);
    const [operationNo, setOperationNo] = useState("");
    const {image, pick, submit, busy, issue} = useProofUpload(orderId);

    // Already sent (or the order moved on): the card has done its job.
    if (order && order.status !== "pending") {
        return (
            <Notice tone="success" icon="success">
                {t("proof.saved")}
            </Notice>
        );
    }
    return (
        <Card spacing={SPACING[3]} testID="card-proof">
            <ProofForm
                operationNo={operationNo}
                onOperationNo={setOperationNo}
                image={image}
                onPick={pick}
                issue={issue}
                disabled={busy}
            />
            <Button
                testID="chat-proof-submit"
                title={busy ? t("proof.uploading") : t("proof.submit")}
                disabled={busy}
                onPress={async () => {
                    if (await submit(operationNo)) {
                        proofSubmitted(orderId);
                    }
                }}
            />
        </Card>
    );
};
