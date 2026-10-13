import {Row} from "@expo/ui";
import {useRouter} from "expo-router";
import {useState} from "react";
import {Chip} from "@/components/atoms/Chip/Chip";
import {Text} from "@/components/atoms/Text/Text";
import {Card} from "@/components/molecules/Card/Card";
import {Notice} from "@/components/molecules/Notice/Notice";
import {PATHS} from "@/constants/routes";
import {useQueuePosition} from "@/hooks/useQueue";
import {useT} from "@/hooks/useT";
import type {QueueInfo} from "@/models/handoff";
import {api} from "@/services/api";
import {reportError} from "@/services/monitoring";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type QueueCardProps = {
    queue: QueueInfo;
    onUseAssistantInstead?: () => void;
    /** Called once the client leaves the line. */
    onLeft?: () => void;
};

/**
 * "Fila de atención #14, espera estimada ≈ 35 min": where the client stands for
 * a person, with a way out to the assistant or the form at any time.
 */
export const QueueCard = ({
    queue: initial,
    onUseAssistantInstead,
    onLeft,
}: QueueCardProps) => {
    const t = useT();
    const router = useRouter();
    const {muted} = useTheme();
    const [queue, setQueue] = useQueuePosition(initial);
    const [leaving, setLeaving] = useState(false);

    if (!queue) {
        return null;
    }
    const closed = queue.status === "closed";
    const assigned = queue.status === "assigned";

    return (
        <Card spacing={SPACING[2]} testID="card-queue">
            <Text type="subtitle">{t("assistant.queueTitle")}</Text>
            {closed ? (
                <Text type="label" color={muted}>
                    {t("human.closed")}
                </Text>
            ) : assigned ? (
                <Notice tone="success" icon="person">
                    {t("human.assigned")}
                </Notice>
            ) : (
                <>
                    <Text type="title" testID="queue-position">
                        {t("human.queue", {n: queue.position})}
                    </Text>
                    <Text type="label" color={muted}>
                        {t("human.wait", {min: queue.estimatedWaitMinutes})}
                    </Text>
                    <Text type="caption" color={muted}>
                        {t("human.context")}
                    </Text>
                    <Row spacing={SPACING[2]} alignment="center">
                        {onUseAssistantInstead && (
                            <Chip
                                testID="queue-assistant"
                                icon="assistant"
                                tone="ai"
                                label={t("human.assistant")}
                                onPress={onUseAssistantInstead}
                            />
                        )}
                    </Row>
                    <Row spacing={SPACING[2]} alignment="center">
                        <Chip
                            testID="queue-form"
                            icon="orders"
                            tone="neutral"
                            label={t("human.form")}
                            onPress={() => router.push(PATHS.QUOTE)}
                        />
                        <Chip
                            testID="queue-leave"
                            icon="close"
                            tone="neutral"
                            disabled={leaving}
                            label={t("human.leave")}
                            onPress={() => {
                                setLeaving(true);
                                api.leaveQueue({handoffId: queue.handoffId})
                                    .then(() => {
                                        setQueue({...queue, status: "closed"});
                                        onLeft?.();
                                    })
                                    .catch((error) =>
                                        reportError(error, "leaveQueue")
                                    )
                                    .finally(() => setLeaving(false));
                            }}
                        />
                    </Row>
                </>
            )}
        </Card>
    );
};
