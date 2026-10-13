import {
    type ObservableState,
    TextInput,
    type TextInputProps,
    useNativeState,
} from "@expo/ui";
import {useEffect, useRef} from "react";
import {Platform} from "react-native";
import {Surface} from "@/components/atoms/Surface/Surface";
import {FONT_FAMILY} from "@/theme/fonts";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type TextFieldProps = {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: TextInputProps["keyboardType"];
    autoCapitalize?: TextInputProps["autoCapitalize"];
    autoCorrect?: boolean;
    autoComplete?: TextInputProps["autoComplete"];
    returnKeyType?: TextInputProps["returnKeyType"];
    onSubmitEditing?: (text: string) => void;
    secureTextEntry?: boolean;
    multiline?: boolean;
    maxLength?: number;
    editable?: boolean;
    invalid?: boolean;
    /** Taller field with larger text, for amounts. */
    large?: boolean;
    textAlign?: TextInputProps["textAlign"];
    /**
     * Share the field's native text state with the parent, which can then read
     * the exact current value (e.g. on send) without waiting for a re-render.
     */
    nativeState?: ObservableState<string>;
    testID?: string;
};

const HEIGHT = 48;
const LARGE_HEIGHT = 60;

/** The web input ships its own box; the frame below draws the real one. */
const WEB_BARE = {
    width: "100%",
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
} as const;

/**
 * Controlled text input over Expo UI's universal `TextInput`. The native field
 * owns the text, so outside changes (a saved profile, the assistant filling a
 * field, the other side of the calculator) are pushed in through the observable.
 *
 * The box (border, radius, fill) is a `Surface` around the input rather than
 * input styling, so it renders identically on SwiftUI, Compose and the web.
 */
export const TextField = ({
    value,
    onChangeText,
    large,
    invalid,
    nativeState,
    ...props
}: TextFieldProps) => {
    const {surface, text, muted, accent, error, fieldBorder} = useTheme();
    const ownState = useNativeState(value);
    const state = nativeState ?? ownState;

    // The last text this field itself reported. A `value` that merely echoes it is
    // not an outside change; writing it back would undo characters typed since.
    const emitted = useRef(value);

    useEffect(() => {
        if (value !== emitted.current && state.value !== value) {
            state.value = value;
        }
        emitted.current = value;
    }, [value, state]);

    return (
        <Surface
            fill
            radius={12}
            backgroundColor={surface}
            borderColor={invalid ? error : fieldBorder}
            borderWidth={1}
            paddingHorizontal={SPACING[3]}
        >
            <TextInput
                {...props}
                value={state}
                onChangeText={(next) => {
                    emitted.current = next;
                    onChangeText(next);
                }}
                placeholderTextColor={muted}
                cursorColor={accent}
                selectionColor={accent}
                style={{
                    ...(Platform.OS === "web" ? WEB_BARE : null),
                    height: props.multiline
                        ? undefined
                        : large
                          ? LARGE_HEIGHT
                          : HEIGHT,
                }}
                textStyle={{
                    color: text,
                    fontFamily: large
                        ? FONT_FAMILY.LATO_BOLD
                        : FONT_FAMILY.LATO_REGULAR,
                    fontSize: large ? 26 : 17,
                }}
            />
        </Surface>
    );
};
