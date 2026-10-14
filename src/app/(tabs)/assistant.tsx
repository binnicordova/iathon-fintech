import {Column, Host, Row, Spacer} from "@expo/ui";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useMemo} from "react";
import {FlatList, Platform, StyleSheet, View} from "react-native";
import type {ChatMessage, QuickActionId} from "@/assistant/types";
import {Icon} from "@/components/atoms/Icon/Icon";
import {IconButton} from "@/components/atoms/IconButton/IconButton";
import {Text} from "@/components/atoms/Text/Text";
import {Notice} from "@/components/molecules/Notice/Notice";
import {ChatComposer} from "@/components/organisms/ChatComposer/ChatComposer";
import {ChatMessageRow} from "@/components/organisms/ChatMessageRow/ChatMessageRow";
import {ChatSummary} from "@/components/organisms/ChatSummary/ChatSummary";
import {PATHS} from "@/constants/routes";
import {useKeyboard} from "@/hooks/useKeyboard";
import {useT} from "@/hooks/useT";
import {
    chatBusyAtom,
    chatDegradedAtom,
    chatMessagesAtom,
    handOverToWhatsApp,
    resetChatAtom,
    runActionAtom,
    sendMessageAtom,
} from "@/stores/chat";
import {lockedQuoteAtom} from "@/stores/quote";
import {useBottomSpace} from "@/theme/safeArea";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";

const styles = StyleSheet.create({
    root: {flex: 1, width: "100%", maxWidth: 560, alignSelf: "center"},
    list: {flex: 1},
});

const GREETING_ID = "greeting";

export default function AssistantScreen() {
    const t = useT();
    const router = useRouter();
    const {background, ai, muted, success, accent} = useTheme();
    const messages = useAtomValue(chatMessagesAtom);
    const busy = useAtomValue(chatBusyAtom);
    const degraded = useAtomValue(chatDegradedAtom);
    const hasQuote = useAtomValue(lockedQuoteAtom) !== null;
    const send = useSetAtom(sendMessageAtom);
    const runAction = useSetAtom(runActionAtom);
    const reset = useSetAtom(resetChatAtom);
    const {visible: typing} = useKeyboard();
    const bottomSpace = useBottomSpace();

    const onAction = useCallback(
        (action: QuickActionId) => {
            if (action === "form") {
                router.push(hasQuote ? PATHS.DATA : PATHS.QUOTE);
                return;
            }
            if (action === "human") {
                void handOverToWhatsApp(t("whatsapp.person"));
                return;
            }
            void runAction(action);
        },
        [hasQuote, router, runAction, t]
    );

    // The first message is always the greeting, drawn by the app: it costs no model call.
    const greeting = useMemo<ChatMessage>(
        () => ({
            id: GREETING_ID,
            role: "assistant",
            text: t("assistant.greeting"),
            cards: [],
            actions: messages.length === 0 ? ["human", "form"] : [],
            at: 0,
        }),
        [t, messages.length]
    );
    // FlatList is inverted: index 0 is the newest message, drawn at the bottom.
    const data = useMemo(
        () => [...messages].reverse().concat(greeting),
        [messages, greeting]
    );

    return (
        <View
            style={[
                styles.root,
                {backgroundColor: background, paddingBottom: bottomSpace},
            ]}
        >
            <Host
                matchContents={{vertical: true}}
                seedColor={accent}
                style={{width: "100%"}}
            >
                <Column
                    spacing={SPACING[2]}
                    style={{padding: SPACING[4], paddingBottom: SPACING[2]}}
                >
                    <Row alignment="center" spacing={SPACING[2]}>
                        <Icon
                            name="assistant"
                            size={ICON_SIZE.large}
                            color={ai}
                        />
                        <Column spacing={0}>
                            <Text type="subtitle">{t("assistant.title")}</Text>
                            <Row alignment="center" spacing={SPACING[1]}>
                                <Icon
                                    name="check"
                                    size={ICON_SIZE.small}
                                    color={success}
                                />
                                <Text type="caption" color={muted}>
                                    {t("assistant.online")}
                                </Text>
                            </Row>
                        </Column>
                        <Spacer flexible />
                        <IconButton
                            name="refresh"
                            testID="chat-reset"
                            onPress={() => reset()}
                        />
                    </Row>
                    {/* The summary and the notice give way to the chat while typing. */}
                    {!typing && <ChatSummary />}
                    {degraded && !typing && (
                        <Notice tone="warning">
                            {t("assistant.basicMode")}
                        </Notice>
                    )}
                </Column>
            </Host>

            <FlatList
                style={styles.list}
                inverted
                data={data}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                    Platform.OS === "ios" ? "interactive" : "on-drag"
                }
                automaticallyAdjustKeyboardInsets={false}
                ListHeaderComponent={
                    busy ? (
                        <Host
                            matchContents={{vertical: true}}
                            style={{width: "100%", padding: SPACING[4]}}
                        >
                            <Text
                                type="caption"
                                color={muted}
                                testID="chat-typing"
                            >
                                {t("assistant.thinking")}
                            </Text>
                        </Host>
                    ) : null
                }
                renderItem={({item}) => (
                    <ChatMessageRow
                        message={item}
                        busy={busy}
                        onAction={onAction}
                    />
                )}
            />

            <View>
                <Host
                    matchContents={{vertical: true}}
                    seedColor={accent}
                    style={{width: "100%"}}
                >
                    <ChatComposer
                        onSend={(text) => void send(text)}
                        disabled={busy}
                    />
                </Host>
            </View>
        </View>
    );
}
