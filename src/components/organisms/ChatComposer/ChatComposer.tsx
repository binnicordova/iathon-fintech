import {Row, useNativeState} from "@expo/ui";
import {useState} from "react";
import {Icon} from "@/components/atoms/Icon/Icon";
import {Pressable} from "@/components/atoms/Pressable/Pressable";
import {Surface} from "@/components/atoms/Surface/Surface";
import {TextField} from "@/components/atoms/TextField/TextField";
import {useT} from "@/hooks/useT";
import {fullWidth} from "@/theme/fullWidth";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";

export type ChatComposerProps = {
    onSend: (text: string) => void;
    disabled?: boolean;
};

export const ChatComposer = ({onSend, disabled}: ChatComposerProps) => {
    const t = useT();
    const {background, accent, onAccent} = useTheme();
    const [text, setText] = useState("");
    // The native field owns the text; read it straight from there on send, so a
    // message is never cut short by a change event that has not reached React yet.
    const field = useNativeState("");

    const send = (typed?: string) => {
        const trimmed = (typed ?? field.value ?? text).trim();
        if (!trimmed || disabled) {
            return;
        }
        onSend(trimmed);
        field.value = "";
        setText("");
    };

    return (
        <Surface
            fill
            backgroundColor={background}
            paddingHorizontal={SPACING[4]}
            paddingVertical={SPACING[2]}
        >
            <Row alignment="center" spacing={SPACING[2]} {...fullWidth()}>
                <Surface grow>
                    <TextField
                        testID="chat-input"
                        value={text}
                        nativeState={field}
                        placeholder={t("assistant.placeholder")}
                        returnKeyType="send"
                        onChangeText={setText}
                        onSubmitEditing={send}
                    />
                </Surface>
                <Pressable
                    testID="chat-send"
                    radius="capsule"
                    disabled={disabled}
                    onPress={() => send()}
                >
                    <Surface
                        alignment="center"
                        padding={SPACING[3]}
                        radius="capsule"
                        backgroundColor={accent}
                        opacity={disabled ? 0.4 : undefined}
                    >
                        <Icon
                            name="send"
                            size={ICON_SIZE.large}
                            color={onAccent}
                        />
                    </Surface>
                </Pressable>
            </Row>
        </Surface>
    );
};
