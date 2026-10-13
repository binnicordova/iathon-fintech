export const CURRENCIES = ["BRL", "PEN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Country = "BR" | "PE";

export const LANGUAGES = ["es", "pt", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export type Channel = "form" | "assistant" | "whatsapp" | "human";
