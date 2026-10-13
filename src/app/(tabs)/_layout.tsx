import {Tabs} from "expo-router/js-tabs";
import {TabBar} from "@/components/organisms/TabBar/TabBar";

export default function TabsLayout() {
    return (
        <Tabs
            tabBar={(props) => <TabBar {...props} />}
            screenOptions={{headerShown: false}}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="assistant" />
            <Tabs.Screen name="orders" />
            <Tabs.Screen name="team" />
        </Tabs>
    );
}
