import type {Href} from "expo-router";

export const PATHS = {
    QUOTE: "/",
    ASSISTANT: "/assistant",
    ORDERS: "/orders",
    DATA: "/order/data",
    pay: (orderId: string): Href => `/order/${orderId}/pay`,
    proof: (orderId: string): Href => `/order/${orderId}/proof`,
    status: (orderId: string): Href => `/order/${orderId}`,
} as const satisfies Record<string, Href | ((orderId: string) => Href)>;
