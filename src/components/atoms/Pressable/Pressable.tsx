import {Button as UIButton, type UniversalStyle} from "@expo/ui";
import type {ReactNode} from "react";
import {Platform} from "react-native";

/** The web button fallback pads and fixes its height; the child draws its own box. */
const WEB_RESET: UniversalStyle | undefined =
    Platform.OS === "web"
        ? ({padding: 0, paddingHorizontal: 0, height: "auto"} as UniversalStyle)
        : undefined;

export type PressableProps = {
    children: ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    /** The corner radius of the child, so the press feedback follows its shape. */
    radius?: number | "capsule";
    testID?: string;
};

/** Makes a whole box tappable, whatever shape it is. */
export const Pressable = ({
    children,
    onPress,
    disabled,
    testID,
}: PressableProps) => (
    <UIButton
        testID={testID}
        variant="text"
        style={WEB_RESET}
        disabled={disabled}
        onPress={disabled ? undefined : onPress}
    >
        {children}
    </UIButton>
);
