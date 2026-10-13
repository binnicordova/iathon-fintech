import {Icon} from "@/components/atoms/Icon/Icon";
import type {IconName} from "@/components/atoms/Icon/icons";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";

export type NoticeTone = "info" | "warning" | "error" | "success" | "ai";

export type NoticeProps = {
    tone?: NoticeTone;
    children: string;
    icon?: IconName;
    testID?: string;
};

/** A boxed message: info, warning, error, success or from the assistant. */
export const Notice = ({
    tone = "info",
    children,
    icon,
    testID,
}: NoticeProps) => {
    const colors = useTheme();
    const palette = {
        info: {
            fg: colors.accent,
            bg: colors.lightness,
            icon: "info" as IconName,
        },
        warning: {
            fg: colors.warning,
            bg: colors.warningSurface,
            icon: "alert" as IconName,
        },
        error: {
            fg: colors.error,
            bg: colors.errorSurface,
            icon: "alert" as IconName,
        },
        success: {
            fg: colors.success,
            bg: colors.successSurface,
            icon: "success" as IconName,
        },
        ai: {
            fg: colors.ai,
            bg: colors.aiSurface,
            icon: "assistant" as IconName,
        },
    }[tone];

    return (
        <Surface
            fill
            testID={testID}
            direction="row"
            alignment="center"
            spacing={SPACING[2]}
            padding={SPACING[3]}
            radius={12}
            backgroundColor={palette.bg}
        >
            <Icon
                name={icon ?? palette.icon}
                size={ICON_SIZE.medium}
                color={palette.fg}
            />
            <Text type="label" color={palette.fg}>
                {children}
            </Text>
        </Surface>
    );
};
