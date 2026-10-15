import {Row, ScrollView} from "@expo/ui";
import type {QuickActionId} from "@/assistant/types";
import {Chip, type ChipTone} from "@/components/atoms/Chip/Chip";
import type {IconName} from "@/components/atoms/Icon/icons";
import {useT} from "@/hooks/useT";
import type {TranslationKey} from "@/i18n";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";

const ACTION: Record<
    QuickActionId,
    {label: TranslationKey; icon?: IconName; tone: ChipTone}
> = {
    continue: {
        label: "assistant.chip.continue",
        icon: "forward",
        tone: "accent",
    },
    changeAmount: {
        label: "assistant.chip.changeAmount",
        icon: "refresh",
        tone: "neutral",
    },
    human: {label: "assistant.chip.human", icon: "person", tone: "neutral"},
    form: {label: "assistant.chip.form", icon: "orders", tone: "neutral"},
    review: {label: "assistant.chip.review", icon: "check", tone: "accent"},
    paid: {label: "assistant.chip.paid", icon: "success", tone: "success"},
    proof: {label: "assistant.chip.proof", icon: "upload", tone: "accent"},
    status: {label: "assistant.chip.status", icon: "clock", tone: "ai"},
};

export type QuickRepliesProps = {
    actions: QuickActionId[];
    onAction: (action: QuickActionId) => void;
    disabled?: boolean;
};

/** One-tap answers under the latest assistant message. */
export const QuickReplies = ({
    actions,
    onAction,
    disabled,
}: QuickRepliesProps) => {
    const t = useT();

    if (actions.length === 0) {
        return null;
    }
    return (
        <ScrollView
            direction="horizontal"
            showsIndicators={false}
            {...fullWidth()}
        >
            <Row spacing={SPACING[2]} alignment="center">
                {actions.map((action) => {
                    const spec = ACTION[action];
                    return (
                        <Chip
                            key={action}
                            testID={`quick-${action}`}
                            label={t(spec.label)}
                            icon={spec.icon}
                            tone={spec.tone}
                            disabled={disabled}
                            onPress={() => onAction(action)}
                        />
                    );
                })}
            </Row>
        </ScrollView>
    );
};
