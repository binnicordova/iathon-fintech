import {useFonts} from "expo-font";
import {Stack} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {StatusBar} from "expo-status-bar";
import {getDefaultStore, Provider} from "jotai";
import {useEffect} from "react";
import {StyleSheet} from "react-native";
import {
    initialWindowMetrics,
    SafeAreaProvider,
    SafeAreaView,
} from "react-native-safe-area-context";
import {useAppBootstrap} from "@/hooks/useAppBootstrap";
import {Sentry} from "@/services/monitoring";
import {useTheme} from "@/theme/useTheme";

SplashScreen.preventAutoHideAsync();

const FONT_SETTINGS = {
    LatoLight: require("../../assets/fonts/Lato-Light.ttf"),
    LatoRegular: require("../../assets/fonts/Lato-Regular.ttf"),
    LatoBold: require("../../assets/fonts/Lato-Bold.ttf"),
};

const styles = StyleSheet.create({
    baseLayer: {
        flex: 1,
    },
});

const Bootstrap = () => {
    useAppBootstrap();
    return null;
};

const RootLayout = () => {
    const {background} = useTheme();
    const [fontsLoaded, fontError] = useFonts(FONT_SETTINGS);

    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) {
        return null;
    }

    return (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <Provider store={getDefaultStore()}>
                <SafeAreaView
                    edges={["top", "left", "right"]}
                    style={[styles.baseLayer, {backgroundColor: background}]}
                >
                    <StatusBar style="auto" />
                    <Bootstrap />
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: {backgroundColor: background},
                        }}
                    />
                </SafeAreaView>
            </Provider>
        </SafeAreaProvider>
    );
};

export default Sentry.wrap(RootLayout);
