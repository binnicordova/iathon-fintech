import Ionicons from "@react-native-vector-icons/ionicons";
import type {ComponentProps} from "react";
import {FONT_SIZE} from "@/theme/fonts";
import {useTheme} from "@/theme/useTheme";
import type {IconProps} from "./Icon.types";
import type {IconName} from "./icons";

type IonIconName = ComponentProps<typeof Ionicons>["name"];

const SYMBOL: Record<IconName, IonIconName> = {
    back: "chevron-back-outline",
    forward: "chevron-forward-outline",
    success: "checkmark-circle",
    pending: "ellipse-outline",
    failure: "close-circle",
    alert: "alert-circle",
    locked: "lock-closed",
    swap: "swap-horizontal",
    copy: "copy-outline",
    camera: "camera-outline",
    image: "image-outline",
    check: "checkmark",
    assistant: "sparkles",
    person: "person-circle-outline",
    send: "send",
    quote: "cash-outline",
    orders: "receipt-outline",
    close: "close",
    clock: "time-outline",
    download: "download-outline",
    eye: "eye-outline",
    info: "information-circle-outline",
    refresh: "refresh",
    bank: "business-outline",
    upload: "cloud-upload-outline",
    mail: "mail-outline",
};

export const Icon = ({name, size, color, testID}: IconProps) => {
    const {text} = useTheme();

    return (
        <Ionicons
            name={SYMBOL[name]}
            size={size ?? FONT_SIZE[3]}
            color={color ?? text}
            testID={testID ?? name}
        />
    );
};

export type {IconName};
