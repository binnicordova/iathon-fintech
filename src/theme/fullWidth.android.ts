import {fillMaxWidth, padding} from "@expo/ui/jetpack-compose/modifiers";
import type {FullWidthPadding, FullWidthProps} from "./fullWidth.types";

/**
 * Expo UI turns `style.width` into a Compose `width(Int)` modifier, so a
 * `"100%"` string throws a FieldCastException in native code and kills the
 * app on launch. Android asks for the width with `fillMaxWidth()` instead,
 * and the paddings become one `padding` modifier.
 */
export const fullWidth = (spec: FullWidthPadding = {}): FullWidthProps => {
    const all = spec.padding ?? 0;
    const horizontal = spec.paddingHorizontal ?? all;
    const vertical = spec.paddingVertical ?? all;
    const top = spec.paddingTop ?? vertical;
    const bottom = spec.paddingBottom ?? vertical;
    const start = spec.paddingLeft ?? horizontal;
    const end = spec.paddingRight ?? horizontal;

    const modifiers = [fillMaxWidth()];
    if (top || bottom || start || end) {
        modifiers.push(padding(start, top, end, bottom));
    }
    return {modifiers};
};
