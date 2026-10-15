import type {FullWidthPadding, FullWidthProps} from "./fullWidth.types";

/**
 * iOS and web: a plain `width: "100%"` style, which SwiftUI and the web both
 * understand. Android has its own file because Compose cannot take a string.
 */
export const fullWidth = (padding: FullWidthPadding = {}): FullWidthProps => ({
    style: {width: "100%", ...padding},
});
