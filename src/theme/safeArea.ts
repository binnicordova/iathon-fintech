import {createContext, useContext} from "react";
import {Platform} from "react-native";
import {SafeAreaInsetsContext} from "react-native-safe-area-context";
import {useKeyboard} from "@/hooks/useKeyboard";

/**
 * Whether a screen has to keep clear of the home indicator itself. Screens in
 * the tab bar do not: the bar pads for it. Stack screens (the order steps) do.
 */
export const BottomInsetContext = createContext(true);

/**
 * Space to keep free at the bottom of a screen: the keyboard while it is up
 * (it already covers the home indicator), otherwise the home indicator.
 */
export const useBottomSpace = (): number => {
    const ownsBottomInset = useContext(BottomInsetContext);
    // Not `useSafeAreaInsets`: that throws without a provider (tests, previews).
    const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
    const {inset, visible} = useKeyboard();
    if (visible && inset > 0) {
        // Android reports the keyboard without the navigation bar it replaces.
        return Platform.OS === "android" ? inset + bottom : inset;
    }
    return ownsBottomInset ? bottom : 0;
};
