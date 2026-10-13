type ThemeType = "light" | "dark";

type ColorScheme = {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    onAccent: string;
    error: string;
    errorSurface: string;
    success: string;
    successSurface: string;
    warning: string;
    warningSurface: string;
    /** The assistant: purple on every plan diagram. */
    ai: string;
    aiSurface: string;
    whatsapp: string;
    /** Hairlines and card outlines. */
    line: string;
    /** Input borders: stronger than `line` so a field reads on any surface. */
    fieldBorder: string;
    lightness: string;
    darkness: string;
};

/**
 * BRASPER's palette, taken from the product plan page: a clear blue for every
 * tappable thing, purple reserved for the AI assistant, green/amber/red for
 * validation states.
 */
const Colors: Record<ThemeType, ColorScheme> = {
    light: {
        background: "#F3F6FD",
        surface: "#FFFFFF",
        text: "#0D1733",
        muted: "#55607C",
        accent: "#1A5CFF",
        onAccent: "#FFFFFF",
        error: "#9B1C1C",
        errorSurface: "#FDEBEC",
        success: "#11643A",
        successSurface: "#E2F7EA",
        warning: "#8A4A00",
        warningSurface: "#FFF3E4",
        ai: "#6D3FD1",
        aiSurface: "#F1EBFF",
        whatsapp: "#1FAA59",
        line: "#DBE2F2",
        fieldBorder: "#B4C0DD",
        lightness: "#EAF0FF",
        darkness: "#0D1733",
    },

    dark: {
        background: "#080E22",
        surface: "#101936",
        text: "#E9EEFF",
        muted: "#9AA7CC",
        accent: "#5B8BFF",
        onAccent: "#060C24",
        error: "#FFB4B4",
        errorSurface: "#3B1A1D",
        success: "#7BE6A8",
        successSurface: "#0F3322",
        warning: "#FFC98A",
        warningSurface: "#3A2A14",
        ai: "#A58BFF",
        aiSurface: "#1F1840",
        whatsapp: "#1FAA59",
        line: "#243059",
        fieldBorder: "#3A4A7C",
        lightness: "#16224B",
        darkness: "#FFFFFF",
    },
};

export const theme = (theme?: ThemeType): ColorScheme => {
    return Colors[theme || "light"];
};

export type {ColorScheme, ThemeType};
