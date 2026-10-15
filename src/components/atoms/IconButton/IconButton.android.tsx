import {Icon} from "@/components/atoms/Icon/Icon";
import {Pressable} from "@/components/atoms/Pressable/Pressable";
import {Surface} from "@/components/atoms/Surface/Surface";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";
import type {IconButtonProps} from "./IconButton";

/** A 48dp round touch target with a circular ripple, as Material icon buttons are. */
export const IconButton = ({
    name,
    onPress,
    size,
    color,
    disabled,
    testID,
}: IconButtonProps) => {
    const {accent} = useTheme();

    return (
        <Pressable
            testID={testID ?? `${name}-button`}
            radius="capsule"
            disabled={disabled}
            onPress={onPress}
        >
            <Surface
                alignment="center"
                padding={SPACING[3]}
                radius="capsule"
                opacity={disabled ? 0.4 : undefined}
            >
                <Icon
                    name={name}
                    size={size ?? ICON_SIZE.large}
                    color={color ?? accent}
                />
            </Surface>
        </Pressable>
    );
};
