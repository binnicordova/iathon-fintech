import {useRouter} from "expo-router";
import {Button} from "@/components/atoms/Button/Button";
import {Text} from "@/components/atoms/Text/Text";
import {OrderListItem} from "@/components/molecules/OrderListItem/OrderListItem";
import {AppHeader} from "@/components/organisms/AppHeader/AppHeader";
import {Screen} from "@/components/templates/Screen/Screen";
import {PATHS} from "@/constants/routes";
import {useMyOrders} from "@/hooks/useOrder";
import {useT} from "@/hooks/useT";
import {useTheme} from "@/theme/useTheme";

export default function OrdersScreen() {
    const t = useT();
    const router = useRouter();
    const {muted} = useTheme();
    const {data: orders, loading} = useMyOrders();

    return (
        <Screen header={<AppHeader />}>
            <Text type="title">{t("orders.title")}</Text>
            {!loading && orders.length === 0 && (
                <>
                    <Text type="label" color={muted} testID="orders-empty">
                        {t("orders.empty")}
                    </Text>
                    <Button
                        title={t("orders.new")}
                        onPress={() => router.navigate(PATHS.QUOTE)}
                    />
                </>
            )}
            {orders.map((order) => (
                <OrderListItem
                    key={order.orderId}
                    order={order}
                    onPress={() => router.push(PATHS.status(order.orderId))}
                />
            ))}
        </Screen>
    );
}
