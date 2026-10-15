import {RNHostView} from "@expo/ui";
import {Image} from "expo-image";
import {useWindowDimensions} from "react-native";
import {Surface} from "@/components/atoms/Surface/Surface";
import {RADIUS} from "@/theme/border";
import {SPACING} from "@/theme/spacing";
import {useTheme} from "@/theme/useTheme";

export type ImagePreviewProps = {
    uri: string;
    testID?: string;
};

const MAX_WIDTH = 280;
const ASPECT = 1.25;
/** Screen gutters plus the card around the preview. */
const CHROME = SPACING[4] * 6;

/**
 * The picked photo, shown at once. The native host needs real pixel sizes:
 * a percentage width collapses to zero there and the photo never appears.
 */
export const ImagePreview = ({uri, testID}: ImagePreviewProps) => {
    const {width: screen} = useWindowDimensions();
    const {lightness, line} = useTheme();
    const width = Math.min(MAX_WIDTH, Math.max(120, screen - CHROME));
    const height = Math.round(width * ASPECT);

    return (
        <Surface
            width={width}
            radius={RADIUS[5] * 1.5}
            backgroundColor={lightness}
            borderColor={line}
            borderWidth={1}
        >
            <RNHostView matchContents>
                <Image
                    testID={testID}
                    source={{uri}}
                    contentFit="contain"
                    accessibilityIgnoresInvertColors
                    style={{width, height, borderRadius: RADIUS[5] * 1.5}}
                />
            </RNHostView>
        </Surface>
    );
};
