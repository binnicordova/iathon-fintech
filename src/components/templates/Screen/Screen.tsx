import {Column, Host, ScrollView, Spacer} from "@expo/ui";
import type {ReactNode} from "react";
import {StyleSheet} from "react-native";
import {Surface} from "@/components/atoms/Surface/Surface";
import {SPACING} from "@/theme/spacing";
import {surfaceModifiers, surfaceStyle} from "@/theme/surface";
import {useTheme} from "@/theme/useTheme";

export type ScreenProps = {
    children: ReactNode;
    scroll?: boolean;
    centered?: boolean;
    /**
     * Pinned to the top, outside the scroll view. Chrome that must stay put
     * while the content below sinks toward the thumb.
     */
    header?: ReactNode;
    /**
     * Pinned above the safe area, outside the scroll view, so the primary
     * action stays one thumb-tap away no matter how long the content runs.
     */
    footer?: ReactNode;
    /**
     * Remounts the scroll view when it changes, returning the reader to the
     * top instead of stranding them mid-content on the next item.
     */
    resetKey?: string | number;
    /**
     * Sinks short content toward the footer so repeated tap targets land in
     * the thumb's comfort arc rather than floating mid-screen. Longer content
     * still fills upward and scrolls.
     */
    bottomAligned?: boolean;
    /** Wider column for desktop web (the team's VIEW); phones are unaffected. */
    wide?: boolean;
};

const styles = StyleSheet.create({
    host: {
        flex: 1,
        width: "100%",
        alignSelf: "center",
        maxWidth: 560,
    },
    hostWide: {
        maxWidth: 1180,
    },
});

const CONTENT_PADDING = {
    width: "100%",
    paddingTop: SPACING[3],
    paddingBottom: SPACING[4],
    paddingLeft: SPACING[4],
    paddingRight: SPACING[4],
} as const;

export const Screen = ({
    children,
    scroll = true,
    centered = false,
    header,
    footer,
    resetKey,
    bottomAligned = false,
    wide = false,
}: ScreenProps) => {
    const {accent, background} = useTheme();

    const content = (
        <Column
            spacing={SPACING[4]}
            alignment={centered ? "center" : "start"}
            style={CONTENT_PADDING}
        >
            {centered && <Spacer flexible />}
            {children}
            {centered && <Spacer flexible />}
        </Column>
    );

    const body = scroll ? (
        <ScrollView
            key={resetKey}
            modifiers={surfaceModifiers({grow: !bottomAligned})}
            style={surfaceStyle({grow: !bottomAligned})}
        >
            {content}
        </ScrollView>
    ) : (
        content
    );

    return (
        <Host
            style={[
                styles.host,
                wide && styles.hostWide,
                {backgroundColor: background},
            ]}
            seedColor={accent}
            useViewportSizeMeasurement
        >
            <Column
                spacing={0}
                modifiers={surfaceModifiers({fillHeight: true})}
                style={surfaceStyle({fillHeight: true})}
            >
                {header && (
                    <Surface
                        fill
                        paddingHorizontal={SPACING[4]}
                        paddingTop={SPACING[3]}
                        spacing={SPACING[3]}
                        backgroundColor={background}
                    >
                        {header}
                    </Surface>
                )}

                {bottomAligned && <Spacer flexible />}
                {body}
                {footer && (
                    <Surface
                        fill
                        paddingHorizontal={SPACING[4]}
                        paddingVertical={SPACING[3]}
                        backgroundColor={background}
                    >
                        {footer}
                    </Surface>
                )}
            </Column>
        </Host>
    );
};
