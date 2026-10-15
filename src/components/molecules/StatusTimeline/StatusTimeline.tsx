import {Row} from "@expo/ui";
import {Icon} from "@/components/atoms/Icon/Icon";
import type {IconName} from "@/components/atoms/Icon/icons";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {formatLimaDateTime} from "@/domain/hours";
import {timelineFor} from "@/domain/orders";
import {useT} from "@/hooks/useT";
import type {TranslationKey} from "@/i18n";
import type {Order, TimelineStepKey, TimelineStepState} from "@/models/order";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";

const LABEL: Record<TimelineStepKey, TranslationKey> = {
    registered: "status.step.registered",
    verifying: "status.step.verifying",
    sent: "status.step.sent",
    received: "status.step.received",
};

const ICON: Record<TimelineStepState, IconName> = {
    done: "success",
    active: "clock",
    todo: "pending",
    failed: "failure",
};

const timeFor = (key: TimelineStepKey, order: Order): string | null => {
    const at =
        key === "registered"
            ? order.createdAt
            : key === "verifying"
              ? order.proofSubmittedAt
              : key === "sent"
                ? order.validatedAt
                : null;
    return at ? formatLimaDateTime(new Date(at)) : null;
};

export type StatusTimelineProps = {
    order: Pick<
        Order,
        | "status"
        | "invoiceStatus"
        | "createdAt"
        | "proofSubmittedAt"
        | "validatedAt"
    >;
};

/**
 * Registered → verifying → money sent → money received. Derived from the order,
 * so the form and the assistant show the same story.
 */
export const StatusTimeline = ({order}: StatusTimelineProps) => {
    const t = useT();
    const {success, accent, muted, error} = useTheme();
    const steps = timelineFor(order);

    const colorFor = (state: TimelineStepState): string =>
        ({done: success, active: accent, todo: muted, failed: error})[state];

    return (
        <Surface fill spacing={SPACING[3]} testID="status-timeline">
            {steps.map((step) => {
                const time = timeFor(step.key, order as Order);
                return (
                    <Row
                        key={step.key}
                        alignment="center"
                        spacing={SPACING[3]}
                        {...fullWidth()}
                    >
                        <Icon
                            name={ICON[step.state]}
                            size={ICON_SIZE.large}
                            color={colorFor(step.state)}
                            testID={`step-${step.key}-${step.state}`}
                        />
                        <Surface spacing={0}>
                            <Text
                                type="default"
                                color={
                                    step.state === "todo" ? muted : undefined
                                }
                            >
                                {t(LABEL[step.key])}
                            </Text>
                            {step.state !== "todo" && time && (
                                <Text type="caption" color={muted}>
                                    {time}
                                </Text>
                            )}
                        </Surface>
                    </Row>
                );
            })}
        </Surface>
    );
};
