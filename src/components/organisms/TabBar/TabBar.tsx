import {Column, Host, Row, Button as UIButton} from "@expo/ui";
import type {BottomTabBarProps} from "expo-router/js-tabs";
import {View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Icon} from "@/components/atoms/Icon/Icon";
import type {IconName} from "@/components/atoms/Icon/icons";
import {Surface} from "@/components/atoms/Surface/Surface";
import {Text} from "@/components/atoms/Text/Text";
import {useKeyboard} from "@/hooks/useKeyboard";
import {useT} from "@/hooks/useT";
import type {TranslationKey} from "@/i18n";
import {SPACING} from "@/theme/spacing";
import {ICON_SIZE} from "@/theme/typography";
import {useTheme} from "@/theme/useTheme";

const TABS: Record<string, {icon: IconName; label: TranslationKey}> = {
    index: {icon: "quote", label: "tab.quote"},
    assistant: {icon: "assistant", label: "tab.assistant"},
    orders: {icon: "orders", label: "tab.orders"},
};

/** One bar for web, iOS and Android, so the flow looks the same everywhere. */
export const TabBar = ({state, navigation}: BottomTabBarProps) => {
    const {surface, accent, muted, line, ai} = useTheme();
    const t = useT();
    const {bottom} = useSafeAreaInsets();
    const {visible: typing} = useKeyboard();

    // The keyboard takes the bottom of the screen: the bar would only steal height.
    if (typing) {
        return null;
    }

    return (
        <View style={{backgroundColor: surface, paddingBottom: bottom}}>
            <Host
                matchContents={{vertical: true}}
                style={{
                    width: "100%",
                    alignSelf: "stretch",
                    borderTopWidth: 1,
                    borderTopColor: line,
                }}
                seedColor={accent}
            >
                <Row alignment="center" spacing={0} style={{width: "100%"}}>
                    {state.routes.map((route, index) => {
                        const tab = TABS[route.name];
                        if (!tab) {
                            return null;
                        }
                        const focused = state.index === index;
                        const color = focused
                            ? route.name === "assistant"
                                ? ai
                                : accent
                            : muted;
                        return (
                            <Surface key={route.key} grow alignment="center">
                                <UIButton
                                    testID={`tab-${route.name}`}
                                    variant="text"
                                    onPress={() => {
                                        const event = navigation.emit({
                                            type: "tabPress",
                                            target: route.key,
                                            canPreventDefault: true,
                                        });
                                        if (
                                            !focused &&
                                            !event.defaultPrevented
                                        ) {
                                            navigation.navigate(
                                                route.name,
                                                route.params
                                            );
                                        }
                                    }}
                                >
                                    <Column
                                        alignment="center"
                                        spacing={SPACING[1]}
                                        style={{
                                            paddingVertical: SPACING[2],
                                            paddingHorizontal: SPACING[3],
                                        }}
                                    >
                                        <Icon
                                            name={tab.icon}
                                            size={ICON_SIZE.large}
                                            color={color}
                                        />
                                        <Text type="caption" color={color}>
                                            {t(tab.label)}
                                        </Text>
                                    </Column>
                                </UIButton>
                            </Surface>
                        );
                    })}
                </Row>
            </Host>
        </View>
    );
};
