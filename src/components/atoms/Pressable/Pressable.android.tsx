import {Box} from "@expo/ui/jetpack-compose";
import {
    clickable,
    clip,
    Shapes,
    testID as testIDModifier,
} from "@expo/ui/jetpack-compose/modifiers";
import type {PressableProps} from "./Pressable";

const CAPSULE_RADIUS = 1000;

/**
 * Compose's `TextButton` clips whatever it holds to its own pill shape, which
 * shaves the corners off a card. A `Box` clipped to the child's radius with a
 * `clickable` modifier gives the same ripple, shaped like the child.
 */
export const Pressable = ({
    children,
    onPress,
    disabled,
    radius = 0,
    testID,
}: PressableProps) => (
    <Box
        modifiers={[
            clip(
                Shapes.RoundedCorner(
                    radius === "capsule" ? CAPSULE_RADIUS : radius
                )
            ),
            ...(disabled || !onPress ? [] : [clickable(onPress)]),
            ...(testID ? [testIDModifier(testID)] : []),
        ]}
    >
        {children}
    </Box>
);
