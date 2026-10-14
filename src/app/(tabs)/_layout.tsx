import {Tabs} from "expo-router/js-tabs";
import {TabBar} from "@/components/organisms/TabBar/TabBar";
import {BottomInsetContext} from "@/theme/safeArea";

export default function TabsLayout() {
    return (
        <BottomInsetContext.Provider value={false}>
            <Tabs
                tabBar={(props) => <TabBar {...props} />}
                screenOptions={{headerShown: false}}
            >
                <Tabs.Screen name="index" />
                <Tabs.Screen name="assistant" />
                <Tabs.Screen name="orders" />
            </Tabs>
        </BottomInsetContext.Provider>
    );
}
