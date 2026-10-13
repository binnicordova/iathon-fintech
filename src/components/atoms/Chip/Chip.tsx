import {Button as UIButton, type UniversalStyle} from "@expo/ui";
import {Platform} from "react-native";
import {Icon} from "@/components/atoms/Icon/Icon";
import type {IconName} from "@/components/atoms/Icon/icons";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";

/** The web button fallback pads and fixes its height; the chip draws its own box. */
const WEB_RESET: UniversalStyle | undefined =
    Platform.OS === "web"
        ? ({padding: 0, paddingHorizontal: 0, height: "auto"} as UniversalStyle)
        : undefined;

export type ChipTone = "neutral" | "accent" | "ai" | "success" | "warning";

export type ChipProps = {
    label: string;
    onPress?: () => void;
    icon?: IconName;
    selected?: boolean;
    disabled?: boolean;
    tone?: ChipTone;
    testID?: string;
};

/** Quick replies, filters and segmented choices: a tappable capsule. */
export const Chip = ({
    label,
    onPress,
    icon,
    selected,
    disabled,
    tone = "accent",
    testID,
}: ChipProps) => {
    const colors = useTheme();
    const toneColor = {
        neutral: colors.muted,
        accent: colors.accent,
        ai: colors.ai,
        success: colors.success,
        warning: colors.warning,
    }[tone];
    const filled = selected === true;

    return (
        <UIButton
            testID={testID}
            variant="text"
            style={WEB_RESET}
            disabled={disabled}
            onPress={disabled ? undefined : onPress}
        >
            <Surface
                direction="row"
                alignment="center"
                spacing={SPACING[1]}
                paddingHorizontal={SPACING[3]}
                paddingVertical={SPACING[2]}
                radius="capsule"
                interactive
                backgroundColor={filled ? toneColor : colors.surface}
                borderColor={filled ? toneColor : colors.line}
                borderWidth={1}
                opacity={disabled ? 0.5 : undefined}
            >
                {icon && (
                    <Icon
                        name={icon}
                        size={ICON_SIZE.small}
                        color={filled ? colors.onAccent : toneColor}
                    />
                )}
                <Text type="label" color={filled ? colors.onAccent : toneColor}>
                    {label}
                </Text>
            </Surface>
        </UIButton>
    );
};
