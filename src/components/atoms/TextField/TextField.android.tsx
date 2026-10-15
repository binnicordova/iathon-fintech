import {
    BasicTextField,
    Box,
    type ObservableState,
    Text,
    type TextFieldImeAction,
    type TextFieldKeyboardType,
    useNativeState,
} from "@expo/ui/jetpack-compose";
import {
    fillMaxWidth,
    height,
    padding,
    testID as testIDModifier,
} from "@expo/ui/jetpack-compose/modifiers";
import {useEffect, useRef} from "react";
import type {KeyboardTypeOptions, ReturnKeyTypeOptions} from "react-native";
import {Surface} from "@/components/atoms/Surface/Surface";
import {FONT_FAMILY} from "@/theme/fonts";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";
import type {TextFieldProps} from "./TextField";

const HEIGHT = 52;
const LARGE_HEIGHT = 64;

const keyboardTypeFor = (type?: KeyboardTypeOptions): TextFieldKeyboardType => {
    switch (type) {
        case "email-address":
            return "email";
        case "numeric":
        case "decimal-pad":
            return "decimal";
        case "number-pad":
            return "number";
        case "phone-pad":
            return "phone";
        case "url":
            return "uri";
        default:
            return "text";
    }
};

const imeActionFor = (type?: ReturnKeyTypeOptions): TextFieldImeAction => {
    switch (type) {
        case "send":
        case "search":
        case "next":
        case "done":
        case "go":
        case "previous":
            return type;
        default:
            return "default";
    }
};

/**
 * The Android field. Expo UI's universal `TextInput` pins the text to the top
 * of its box; this one is a Compose `BasicTextField` whose decoration box
 * centres the text (and the placeholder) vertically, inside the same rounded
 * outline as every other control.
 */
export const TextField = ({
    value,
    onChangeText,
    large,
    invalid,
    nativeState,
    placeholder,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    returnKeyType,
    onSubmitEditing,
    secureTextEntry,
    multiline,
    maxLength,
    editable,
    textAlign,
    testID,
}: TextFieldProps) => {
    const {surface, text, muted, accent, error, fieldBorder} = useTheme();
    const ownState = useNativeState(value);
    // The parent shares the universal handle, which is this same native object on Android.
    const state = (nativeState ?? ownState) as ObservableState<string>;
    const emitted = useRef(value);

    // An outside change (a saved profile, the assistant filling a field) is pushed
    // in; a `value` that merely echoes what was just typed is not.
    useEffect(() => {
        if (value !== emitted.current && state.value !== value) {
            state.value = value;
        }
        emitted.current = value;
    }, [value, state]);

    const fieldHeight = large ? LARGE_HEIGHT : HEIGHT;
    const align =
        textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "centerEnd"
              : "centerStart";
    const textStyle = {
        color: text,
        fontFamily: large ? FONT_FAMILY.LATO_BOLD : FONT_FAMILY.LATO_REGULAR,
        fontSize: large ? 26 : 17,
        ...(textAlign && textAlign !== "auto" ? {textAlign} : null),
    };

    return (
        <Surface
            fill
            radius={14}
            backgroundColor={surface}
            borderColor={invalid ? error : fieldBorder}
            borderWidth={invalid ? 2 : 1}
            paddingHorizontal={SPACING[4]}
        >
            <BasicTextField
                value={state}
                modifiers={[
                    fillMaxWidth(),
                    multiline
                        ? padding(0, SPACING[3], 0, SPACING[3])
                        : height(fieldHeight),
                    ...(testID ? [testIDModifier(testID)] : []),
                ]}
                singleLine={!multiline}
                readOnly={editable === false}
                maxLength={maxLength}
                cursorColor={accent}
                textSelectionColors={{
                    handleColor: accent,
                    backgroundColor: accent,
                }}
                textStyle={textStyle}
                visualTransformation={secureTextEntry ? "password" : undefined}
                keyboardOptions={{
                    keyboardType: keyboardTypeFor(keyboardType),
                    imeAction: imeActionFor(returnKeyType),
                    autoCorrectEnabled: autoCorrect,
                    capitalization: autoCapitalize,
                }}
                keyboardActions={
                    onSubmitEditing
                        ? {
                              onDone: onSubmitEditing,
                              onGo: onSubmitEditing,
                              onNext: onSubmitEditing,
                              onSearch: onSubmitEditing,
                              onSend: onSubmitEditing,
                              onPrevious: onSubmitEditing,
                          }
                        : undefined
                }
                onValueChange={(next) => {
                    emitted.current = next;
                    onChangeText(next);
                }}
            >
                <BasicTextField.DecorationBox>
                    <Box
                        modifiers={[fillMaxWidth()]}
                        contentAlignment={multiline ? "topStart" : align}
                    >
                        {placeholder != null ? (
                            <BasicTextField.Placeholder>
                                <Text
                                    color={muted as string}
                                    style={textStyle}
                                    modifiers={[fillMaxWidth()]}
                                >
                                    {placeholder}
                                </Text>
                            </BasicTextField.Placeholder>
                        ) : null}
                        <BasicTextField.InnerTextField />
                    </Box>
                </BasicTextField.DecorationBox>
            </BasicTextField>
        </Surface>
    );
};
