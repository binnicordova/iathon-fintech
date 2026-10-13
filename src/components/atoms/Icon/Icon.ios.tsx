import {Icon as UIIcon} from "@expo/ui";
import type {SFSymbol} from "sf-symbols-typescript";
import {FONT_SIZE} from "@/theme/fonts";
import {useTheme} from "@/theme/useTheme";
import type {IconProps} from "./Icon.types";
import type {IconName} from "./icons";

const SYMBOL: Record<IconName, SFSymbol> = {
    back: "chevron.backward",
    forward: "chevron.right",
    success: "checkmark.circle.fill",
    pending: "circle",
    failure: "xmark.circle.fill",
    alert: "exclamationmark.circle.fill",
    locked: "lock.fill",
    swap: "arrow.left.arrow.right",
    copy: "doc.on.doc",
    camera: "camera",
    image: "photo",
    check: "checkmark",
    assistant: "sparkles",
    person: "person.crop.circle",
    send: "paperplane.fill",
    quote: "dollarsign.arrow.circlepath",
    orders: "list.bullet.rectangle",
    close: "xmark",
    clock: "clock",
    download: "arrow.down.circle",
    eye: "eye",
    info: "info.circle",
    refresh: "arrow.clockwise",
    bank: "building.columns",
    upload: "square.and.arrow.up",
    mail: "envelope",
};

export const Icon = ({name, size, color, testID}: IconProps) => {
    const {text} = useTheme();

    return (
        <UIIcon
            name={SYMBOL[name]}
            size={size ?? FONT_SIZE[3]}
            color={color ?? text}
            testID={testID ?? name}
        />
    );
};

export type {IconName};
