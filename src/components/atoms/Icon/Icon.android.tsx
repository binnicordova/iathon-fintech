import {Icon as UIIcon} from "@expo/ui";
import type {ImageSourcePropType} from "react-native";
import {FONT_SIZE} from "@/theme/fonts";
import {useTheme} from "@/theme/useTheme";
import type {IconProps} from "./Icon.types";
import type {IconName} from "./icons";

const SYMBOL: Record<IconName, ImageSourcePropType> = {
    back: require("@expo/material-symbols/arrow_back.xml"),
    forward: require("@expo/material-symbols/chevron_right.xml"),
    success: require("@expo/material-symbols/check_circle.xml"),
    pending: require("@expo/material-symbols/circle.xml"),
    failure: require("@expo/material-symbols/cancel.xml"),
    alert: require("@expo/material-symbols/error.xml"),
    locked: require("@expo/material-symbols/lock.xml"),
    swap: require("@expo/material-symbols/swap_horiz.xml"),
    copy: require("@expo/material-symbols/content_copy.xml"),
    camera: require("@expo/material-symbols/photo_camera.xml"),
    image: require("@expo/material-symbols/image.xml"),
    check: require("@expo/material-symbols/check.xml"),
    assistant: require("@expo/material-symbols/smart_toy.xml"),
    person: require("@expo/material-symbols/support_agent.xml"),
    send: require("@expo/material-symbols/send.xml"),
    quote: require("@expo/material-symbols/currency_exchange.xml"),
    orders: require("@expo/material-symbols/receipt_long.xml"),
    close: require("@expo/material-symbols/close.xml"),
    clock: require("@expo/material-symbols/schedule.xml"),
    download: require("@expo/material-symbols/download.xml"),
    eye: require("@expo/material-symbols/visibility.xml"),
    info: require("@expo/material-symbols/info.xml"),
    refresh: require("@expo/material-symbols/refresh.xml"),
    bank: require("@expo/material-symbols/account_balance.xml"),
    upload: require("@expo/material-symbols/upload_file.xml"),
    mail: require("@expo/material-symbols/mail.xml"),
};

export const Icon = ({name, size, color, testID}: IconProps) => {
    const {text} = useTheme();

    return (
        <UIIcon
            name={SYMBOL[name]}
            size={size ?? FONT_SIZE[3]}
            color={color ?? text}
            accessibilityLabel={name}
            testID={testID ?? name}
        />
    );
};

export type {IconName};
