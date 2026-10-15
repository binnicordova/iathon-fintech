import {Host} from "@expo/ui";
import {memo} from "react";
import {View} from "react-native";
import type {ChatMessage, QuickActionId} from "@/assistant/types";
import {Surface} from "@/components/atoms/Surface/Surface";
import {ChatBubble} from "@/components/molecules/ChatBubble/ChatBubble";
import {QuickReplies} from "@/components/molecules/QuickReplies/QuickReplies";
import {ChatCards} from "@/components/organisms/ChatCards/ChatCards";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type ChatMessageRowProps = {
    message: ChatMessage;
    onAction: (action: QuickActionId) => void;
    busy: boolean;
};

/**
 * One message with its cards and quick replies, in its own Expo UI host.
 *
 * The plain View around the host is for Android: a Compose host that starts at
 * zero height inside a list cell is never composed, so it never reports the
 * height of its content and the whole row stays invisible. A non-zero parent
 * lets it measure, and the View then grows to fit it.
 */
export const ChatMessageRow = memo(
    ({message, onAction, busy}: ChatMessageRowProps) => {
        const {accent} = useTheme();

        return (
            <View style={{minHeight: 1}}>
                <Host
                    matchContents={{vertical: true}}
                    seedColor={accent}
                    style={{width: "100%"}}
                >
                    <Surface
                        fill
                        spacing={SPACING[2]}
                        paddingHorizontal={SPACING[4]}
                        paddingVertical={SPACING[1]}
                    >
                        {message.text ? (
                            <ChatBubble
                                role={message.role}
                                testID={`bubble-${message.role}`}
                            >
                                {message.text}
                            </ChatBubble>
                        ) : null}
                        {message.cards.length > 0 && (
                            <ChatCards cards={message.cards} />
                        )}
                        <QuickReplies
                            actions={message.actions}
                            onAction={onAction}
                            disabled={busy}
                        />
                    </Surface>
                </Host>
            </View>
        );
    }
);
