import {
    Button as FilledButton,
    OutlinedButton,
    TextButton,
} from "@expo/ui/jetpack-compose";
import {
    fillMaxWidth,
    height,
    testID as testIDModifier,
} from "@expo/ui/jetpack-compose/modifiers";
import {Text} from "@/components/atoms/Text/Text";
import {useTheme} from "@/theme/useTheme";
import type {ButtonProps} from "./Button";

const HEIGHT = 52;

/**
 * Material buttons coloured from the palette. Left to the dynamic scheme, the
 * filled button turns a washed-out blue; the explicit colours keep it on brand,
 * and the disabled state reads as disabled rather than as a different style.
 */
export const Button = ({
    title,
    onPress,
    disabled,
    variant = "filled",
    testID,
}: ButtonProps) => {
    const {accent, onAccent, line, muted} = useTheme();

    const Component = {
        filled: FilledButton,
        outlined: OutlinedButton,
        text: TextButton,
    }[variant];

    return (
        <Component
            enabled={!disabled}
            onClick={disabled ? undefined : onPress}
            colors={
                variant === "filled"
                    ? {
                          containerColor: accent,
                          contentColor: onAccent,
                          disabledContainerColor: line,
                          disabledContentColor: muted,
                      }
                    : {contentColor: accent, disabledContentColor: muted}
            }
            modifiers={[
                fillMaxWidth(),
                height(HEIGHT),
                ...(testID ? [testIDModifier(testID)] : []),
            ]}
        >
            <Text
                type="label"
                color={
                    variant === "filled"
                        ? disabled
                            ? muted
                            : onAccent
                        : accent
                }
                align="center"
            >
                {title}
            </Text>
        </Component>
    );
};
