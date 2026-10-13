import {Row, Spacer} from "@expo/ui";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type ChatBubbleProps = {
    role: "user" | "assistant";
    children: string;
    testID?: string;
};

/** A message: the client's in blue on the right, the assistant's in purple on the left. */
export const ChatBubble = ({role, children, testID}: ChatBubbleProps) => {
    const {accent, onAccent, aiSurface, text, line} = useTheme();
    const isUser = role === "user";

    return (
        <Row
            alignment="center"
            style={{
                width: "100%",
                paddingLeft: isUser ? SPACING[8] : 0,
                paddingRight: isUser ? 0 : SPACING[8],
            }}
        >
            {isUser && <Spacer flexible />}
            <Surface
                testID={testID}
                shrink
                paddingHorizontal={SPACING[3]}
                paddingVertical={SPACING[2]}
                radius={16}
                backgroundColor={isUser ? accent : aiSurface}
                borderColor={isUser ? accent : line}
                borderWidth={isUser ? 0 : 1}
            >
                <Text type="default" color={isUser ? onAccent : text}>
                    {children}
                </Text>
            </Surface>
            {!isUser && <Spacer flexible />}
        </Row>
    );
};
