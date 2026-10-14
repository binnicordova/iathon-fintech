import {Linking} from "react-native";
import {WHATSAPP_NUMBER} from "@/constants/env";
import {reportError} from "@/services/monitoring";

/** The chat link: straight to BRASPER, or WhatsApp's own chat picker if no number is set. */
export const whatsappUrl = (text: string): string =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

/** "Talk to a person": hands the client to BRASPER on WhatsApp with the context prefilled. */
export const openWhatsApp = (text: string): void => {
    Linking.openURL(whatsappUrl(text)).catch((failure) =>
        reportError(failure, "whatsapp")
    );
};
